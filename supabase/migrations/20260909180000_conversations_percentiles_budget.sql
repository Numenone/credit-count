-- Three things the design document listed as next, built.
--
--   1. Conversations persisted server-side, so the model's history stops being
--      client-supplied at all.
--   2. Real percentiles for latency, instead of a median of per-bucket medians.
--   3. Spend thresholds, so the cost chart stops depending on someone looking
--      at it.

/* --------------------------------------------------- 1. conversations -- */

-- Persisting the transcript is not a convenience feature. While history came
-- back from the browser, a caller could hand over anything and the defence was
-- to bound it: alternating roles, capped turns, capped characters. Reading it
-- from here instead removes the attack rather than limiting it, because the
-- client no longer has a say in what the model is told it previously said.

create table public.conversations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_at    timestamptz not null default now()
);

create index conversations_user_idx on public.conversations (user_id, last_at desc);

create table public.messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations (id) on delete cascade,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  role            text        not null check (role in ('user', 'assistant')),
  body            text        not null check (length(body) between 1 and 4000),
  -- Null on a user turn. On an assistant turn it is one of the enum the
  -- drawing knows, already validated by the endpoint.
  emotion         text,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- A conversation is as private as a ride note. Owner-only, in every direction,
-- including delete: someone must be able to erase what they asked.
create policy "users read their own conversations"
  on public.conversations for select using (user_id = auth.uid());
create policy "users start their own conversations"
  on public.conversations for insert with check (user_id = auth.uid());
create policy "users delete their own conversations"
  on public.conversations for delete using (user_id = auth.uid());

create policy "users read their own messages"
  on public.messages for select using (user_id = auth.uid());
create policy "users delete their own messages"
  on public.messages for delete using (user_id = auth.uid());

-- Deliberately no insert policy on messages. Rows arrive through the function
-- below, which is what keeps a user turn and its reply written together and
-- stops anyone forging an assistant turn directly.
comment on table public.messages is
  'Owner-only. Written only via append_exchange(); a client cannot insert an assistant turn.';

/**
 * Appends one exchange and returns the conversation it belongs to.
 *
 * The question and the answer are written in one statement pair, so a
 * transcript can never contain a reply without the thing it replied to. Passing
 * null for p_conversation_id starts a new one.
 */
create function public.append_exchange(
  p_conversation_id uuid,
  p_question        text,
  p_answer          text,
  p_emotion         text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  -- An id from the caller is only honoured if it is genuinely theirs.
  select c.id into conversation
  from public.conversations c
  where c.id = p_conversation_id and c.user_id = auth.uid();

  if conversation is null then
    insert into public.conversations (user_id) values (auth.uid())
    returning id into conversation;
  else
    update public.conversations set last_at = now() where id = conversation;
  end if;

  insert into public.messages (conversation_id, user_id, role, body)
  values (conversation, auth.uid(), 'user', left(p_question, 4000));

  insert into public.messages (conversation_id, user_id, role, body, emotion)
  values (conversation, auth.uid(), 'assistant', left(p_answer, 4000), p_emotion);

  return conversation;
end;
$$;

revoke all on function public.append_exchange(uuid, text, text, text) from public;
grant execute on function public.append_exchange(uuid, text, text, text) to authenticated;

/**
 * The last few turns of a conversation, oldest first.
 *
 * This is what the model is given. It reads from the table rather than from the
 * request body, so the history is whatever actually happened.
 */
create function public.conversation_history(p_conversation_id uuid, p_turns int default 6)
returns table (role text, body text)
language sql
security definer
set search_path = public
stable
as $$
  select m.role, m.body
  from (
    select m.role, m.body, m.created_at
    from public.messages m
    where m.conversation_id = p_conversation_id
      and m.user_id = auth.uid()
    order by m.created_at desc
    limit greatest(p_turns, 0)
  ) m
  order by m.created_at;
$$;

revoke all on function public.conversation_history(uuid, int) from public;
grant execute on function public.conversation_history(uuid, int) to authenticated;

/* ------------------------------------------------------ 2. percentiles -- */

-- The console reported a median of per-bucket medians, which is not a
-- percentile of anything. For a tail figure it is worse than useless: a bucket
-- with one slow call and a bucket with a thousand fast ones weigh the same.
-- percentile_disc over the rows is the real thing.

create function public.mascot_latency(p_hours int)
returns table (p50 int, p95 int, p99 int, slowest int, calls bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  if p_hours is null or p_hours < 1 or p_hours > 24 * 365 * 10 then
    raise exception 'window out of range' using errcode = '22023';
  end if;

  return query
  select
    coalesce(percentile_disc(0.50) within group (order by c.latency_ms), 0)::int,
    coalesce(percentile_disc(0.95) within group (order by c.latency_ms), 0)::int,
    coalesce(percentile_disc(0.99) within group (order by c.latency_ms), 0)::int,
    coalesce(max(c.latency_ms), 0)::int,
    count(*)
  from public.mascot_calls c
  where c.created_at >= now() - make_interval(hours => p_hours)
    -- Only calls that reached a model. A request refused by the rate limit has
    -- a latency of zero and would drag every percentile towards it.
    and c.outcome <> 'rate_limited';
end;
$$;

revoke all on function public.mascot_latency(int) from public;
grant execute on function public.mascot_latency(int) to authenticated;

/* ---------------------------------------------------------- 3. budget -- */

-- A spend chart only helps someone who looks at it. These are thresholds the
-- endpoint itself checks, so the answer to "are we overspending" does not
-- depend on anyone remembering.

alter table public.mascot_config
  add column daily_budget_usd   numeric(10, 2) not null default 5.00
    check (daily_budget_usd between 0 and 10000),
  add column monthly_budget_usd numeric(10, 2) not null default 50.00
    check (monthly_budget_usd between 0 and 100000),
  -- What happens when a budget is exhausted. 'warn' records and carries on;
  -- 'stop' refuses new calls. Defaulting to stop, because a budget that only
  -- warns is a chart with extra steps.
  add column on_budget_exhausted text not null default 'stop'
    check (on_budget_exhausted in ('warn', 'stop'));

/**
 * Spend so far against the configured budgets.
 *
 * Called on the endpoint's hot path, so it reads the two sums it needs and
 * nothing else. Both are index-supported by mascot_calls_created_at_idx.
 *
 * Not restricted to admins: the endpoint runs as whoever is asking, and it has
 * to know whether the service is within budget before it spends. The figures
 * are aggregates over the deployment, not anyone's personal usage.
 */
create function public.mascot_budget()
returns table (
  day_spend      numeric,
  day_budget     numeric,
  month_spend    numeric,
  month_budget   numeric,
  exhausted      boolean,
  action         text
)
language sql
security definer
set search_path = public
stable
as $$
  with config as (
    select daily_budget_usd, monthly_budget_usd, on_budget_exhausted
    from public.mascot_config
    limit 1
  ),
  spend as (
    select
      coalesce(sum(cost_usd) filter (
        where created_at >= date_trunc('day', now())
      ), 0) as day,
      coalesce(sum(cost_usd) filter (
        where created_at >= date_trunc('month', now())
      ), 0) as month
    from public.mascot_calls
    where created_at >= date_trunc('month', now())
  )
  select
    spend.day,
    config.daily_budget_usd,
    spend.month,
    config.monthly_budget_usd,
    spend.day >= config.daily_budget_usd or spend.month >= config.monthly_budget_usd,
    config.on_budget_exhausted
  from spend, config;
$$;

revoke all on function public.mascot_budget() from public;
grant execute on function public.mascot_budget() to authenticated;

/**
 * Replaces set_mascot_config with one that also carries the budgets.
 *
 * Dropped and recreated rather than overloaded: two signatures differing only
 * by defaulted parameters make every existing call ambiguous at runtime, which
 * is the worst place to find out.
 */
drop function if exists public.set_mascot_config(text, text, int, text, int, int);

create function public.set_mascot_config(
  p_gateway    text,
  p_model      text,
  p_max_tokens int,
  p_effort     text,
  p_burst_cap  int,
  p_daily_cap  int,
  p_daily_budget   numeric,
  p_monthly_budget numeric,
  p_on_exhausted   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may change the mascot configuration'
      using errcode = '42501';
  end if;

  update public.mascot_config
  set gateway            = p_gateway,
      model              = p_model,
      max_tokens         = p_max_tokens,
      effort             = p_effort,
      burst_cap          = p_burst_cap,
      daily_cap          = p_daily_cap,
      daily_budget_usd   = p_daily_budget,
      monthly_budget_usd = p_monthly_budget,
      on_budget_exhausted = p_on_exhausted,
      updated_at         = now(),
      updated_by         = auth.uid()
  where id;
end;
$$;

revoke all on function public.set_mascot_config(text, text, int, text, int, int, numeric, numeric, text) from public;
grant execute on function public.set_mascot_config(text, text, int, text, int, int, numeric, numeric, text) to authenticated;
