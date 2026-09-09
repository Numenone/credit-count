-- Move the reporting window from "an instant the caller computed" to "how far
-- back to look".
--
-- Two reasons, and the second is the real one:
--
--  1. Reading the clock while rendering is impure, and the React compiler is
--    right to refuse it — a re-render would silently move the window.
--  2. The database already knows what time it is, and it is the same clock the
--    rows were stamped with. Passing an instant from elsewhere makes every
--    chart quietly dependent on two clocks agreeing.
--
-- Dropped and recreated rather than overloaded: two signatures differing only
-- in a defaulted parameter make every existing call ambiguous at runtime.

drop function if exists public.mascot_usage_series(text, timestamptz);
drop function if exists public.mascot_emotion_counts(timestamptz);

create function public.mascot_usage_series(
  p_bucket text,
  p_hours  int
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

  -- Bounded so a caller cannot ask for an unbounded scan of the whole table.
  if p_hours is null or p_hours < 1 or p_hours > 24 * 365 * 10 then
    raise exception 'window out of range' using errcode = '22023';
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
  where c.created_at >= now() - make_interval(hours => p_hours)
  group by 1
  order by 1;
end;
$$;

revoke all on function public.mascot_usage_series(text, int) from public;
grant execute on function public.mascot_usage_series(text, int) to authenticated;

create function public.mascot_emotion_counts(p_hours int)
returns table (emotion text, calls bigint)
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
  select c.emotion, count(*) as calls
  from public.mascot_calls c
  where c.created_at >= now() - make_interval(hours => p_hours)
    and c.emotion is not null
  group by 1
  order by 2 desc, 1;
end;
$$;

revoke all on function public.mascot_emotion_counts(int) from public;
grant execute on function public.mascot_emotion_counts(int) to authenticated;
