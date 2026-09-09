-- Observability and runtime configuration for the mascot.
--
-- A feature that spends money and has no record of what it spent is a feature
-- nobody can defend in a review. Two tables:
--
--   mascot_calls  — one row per model call, admin-readable, nobody-writable
--   mascot_config — the model and gateway, changeable by an admin without a
--                   deploy
--
-- Neither is writable through PostgREST by anyone. Rows arrive only through the
-- SECURITY DEFINER functions below, which is what stops a user inventing usage
-- to bury their own, or an admin's console being one fetch() away from
-- rewriting the billing record.

/* ------------------------------------------------------------- the ledger -- */

create table public.mascot_calls (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),

  gateway        text        not null,
  model          text        not null,

  input_tokens   int         not null default 0,
  output_tokens  int         not null default 0,

  -- Priced when the call is made, not when the chart is drawn. Prices change;
  -- recomputing history against today's rate card would quietly rewrite what
  -- last month actually cost.
  cost_usd       numeric(12, 6) not null default 0,

  latency_ms     int         not null default 0,
  -- Null when the call did not produce one — a refusal, or an error.
  emotion        text,
  outcome        text        not null check (outcome in ('ok', 'refusal', 'error', 'rate_limited')),
  -- A short machine-readable reason. Never the provider's message, which can
  -- name the model, the account and the prompt.
  error_kind     text
);

create index mascot_calls_created_at_idx on public.mascot_calls (created_at desc);
create index mascot_calls_user_idx on public.mascot_calls (user_id, created_at desc);

alter table public.mascot_calls enable row level security;

-- Read-only, and only for admins. There is deliberately no insert, update or
-- delete policy: the ledger is append-only from the function below.
create policy "admins read the mascot ledger"
  on public.mascot_calls for select
  using (public.is_admin());

comment on table public.mascot_calls is
  'One row per model call. Admin-readable; writable only via record_mascot_call().';

/**
 * Appends one call to the ledger.
 *
 * SECURITY DEFINER so the caller's own session can write a row it cannot then
 * read or alter. The user_id is taken from auth.uid() rather than from an
 * argument, so a caller cannot attribute their spending to somebody else.
 */
create function public.record_mascot_call(
  p_gateway       text,
  p_model         text,
  p_input_tokens  int,
  p_output_tokens int,
  p_cost_usd      numeric,
  p_latency_ms    int,
  p_emotion       text,
  p_outcome       text,
  p_error_kind    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.mascot_calls (
    user_id, gateway, model, input_tokens, output_tokens,
    cost_usd, latency_ms, emotion, outcome, error_kind
  )
  values (
    auth.uid(), p_gateway, p_model, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0),
    greatest(p_cost_usd, 0), greatest(p_latency_ms, 0), p_emotion, p_outcome, p_error_kind
  );
end;
$$;

revoke all on function public.record_mascot_call(text, text, int, int, numeric, int, text, text, text) from public;
grant execute on function public.record_mascot_call(text, text, int, int, numeric, int, text, text, text) to authenticated;

/* ------------------------------------------------------- the configuration -- */

-- One row, enforced by the primary key. A settings table that can grow a second
-- row grows an ambiguity about which one is live.
create table public.mascot_config (
  id          boolean     primary key default true check (id),
  gateway     text        not null default 'anthropic',
  model       text        not null default 'claude-opus-5',
  max_tokens  int         not null default 500 check (max_tokens between 64 and 4000),
  effort      text        not null default 'low' check (effort in ('low', 'medium', 'high')),
  burst_cap   int         not null default 8  check (burst_cap between 1 and 100),
  daily_cap   int         not null default 60 check (daily_cap between 1 and 5000),
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users (id) on delete set null
);

insert into public.mascot_config (id) values (true);

alter table public.mascot_config enable row level security;

-- Everyone signed in reads it, because the endpoint runs as the caller and has
-- to know which model to use. There is nothing sensitive in it — the model name
-- is not a secret, and the API key lives in the environment, never here.
create policy "signed-in users read the mascot config"
  on public.mascot_config for select
  to authenticated
  using (true);

-- No update policy. Changes go through the function below, which is what keeps
-- the check constraints and the audit stamp on the only path in.
comment on table public.mascot_config is
  'Single row. Readable by any signed-in user; changed only via set_mascot_config().';

create function public.set_mascot_config(
  p_gateway    text,
  p_model      text,
  p_max_tokens int,
  p_effort     text,
  p_burst_cap  int,
  p_daily_cap  int
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
  set gateway    = p_gateway,
      model      = p_model,
      max_tokens = p_max_tokens,
      effort     = p_effort,
      burst_cap  = p_burst_cap,
      daily_cap  = p_daily_cap,
      updated_at = now(),
      updated_by = auth.uid()
  where id;
end;
$$;

revoke all on function public.set_mascot_config(text, text, int, text, int, int) from public;
grant execute on function public.set_mascot_config(text, text, int, text, int, int) to authenticated;

/* ------------------------------------------------------------ the rollups -- */

/**
 * Spend and volume bucketed by an arbitrary period.
 *
 * Aggregating in Postgres rather than shipping every row to the browser: a busy
 * month is tens of thousands of rows, and the dashboard needs about sixty
 * points. date_trunc takes the period name directly, so minute through year is
 * one function rather than six.
 *
 * SECURITY DEFINER with an explicit admin check, because the underlying table's
 * policy would otherwise be re-evaluated per row for no benefit.
 */
create function public.mascot_usage_series(
  p_bucket text,
  p_since  timestamptz
)
returns table (
  bucket        timestamptz,
  calls         bigint,
  input_tokens  bigint,
  output_tokens bigint,
  cost_usd      numeric,
  errors        bigint,
  p50_latency   int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  if p_bucket not in ('minute', 'hour', 'day', 'week', 'month', 'year') then
    raise exception 'unsupported bucket %', p_bucket using errcode = '22023';
  end if;

  return query
  select
    date_trunc(p_bucket, c.created_at)                              as bucket,
    count(*)                                                        as calls,
    sum(c.input_tokens)::bigint                                     as input_tokens,
    sum(c.output_tokens)::bigint                                    as output_tokens,
    sum(c.cost_usd)                                                 as cost_usd,
    count(*) filter (where c.outcome <> 'ok')                       as errors,
    coalesce(
      percentile_disc(0.5) within group (order by c.latency_ms), 0
    )::int                                                          as p50_latency
  from public.mascot_calls c
  where c.created_at >= p_since
  group by 1
  order by 1;
end;
$$;

revoke all on function public.mascot_usage_series(text, timestamptz) from public;
grant execute on function public.mascot_usage_series(text, timestamptz) to authenticated;

/** How often each expression came back, for the same window. */
create function public.mascot_emotion_counts(p_since timestamptz)
returns table (emotion text, calls bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  return query
  select c.emotion, count(*) as calls
  from public.mascot_calls c
  where c.created_at >= p_since and c.emotion is not null
  group by 1
  order by 2 desc, 1;
end;
$$;

revoke all on function public.mascot_emotion_counts(timestamptz) from public;
grant execute on function public.mascot_emotion_counts(timestamptz) to authenticated;
