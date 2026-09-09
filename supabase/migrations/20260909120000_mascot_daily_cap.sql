-- A daily ceiling on the mascot, on top of the burst limit.
--
-- The five-minute window stops someone hammering the endpoint, but it does not
-- stop them spending all day at twelve turns every five minutes — which is 3400
-- model calls, and the whole budget, from one account. A burst limit is not a
-- budget; this adds the budget.
--
-- The old two-argument function is dropped rather than overloaded. Adding a
-- third parameter with a default would leave both signatures resolvable and
-- make every two-argument call ambiguous, which fails at runtime rather than at
-- deploy time — the worst place to find it.

drop function if exists public.claim_mascot_turn(int, int);

create function public.claim_mascot_turn(
  max_turns      int default 8,
  window_minutes int default 5,
  max_per_day    int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket    timestamptz;
  used      int;
  today     int;
begin
  if auth.uid() is null then
    return false;
  end if;

  bucket := date_trunc('hour', now())
          + make_interval(mins => (extract(minute from now())::int / window_minutes) * window_minutes);

  -- The counter increments BEFORE the check, so a caller who blows through the
  -- limit keeps being counted rather than being handed a fresh allowance the
  -- moment they stop.
  insert into public.mascot_usage as u (user_id, window_start, turns)
  values (auth.uid(), bucket, 1)
  on conflict (user_id, window_start)
    do update set turns = u.turns + 1
  returning u.turns into used;

  -- Cheap: the rows are indexed by the primary key's leading column, and the
  -- sweep below keeps at most a day of them per caller.
  select coalesce(sum(turns), 0) into today
  from public.mascot_usage
  where user_id = auth.uid()
    and window_start >= date_trunc('day', now());

  delete from public.mascot_usage
  where user_id = auth.uid() and window_start < now() - interval '1 day';

  return used <= max_turns and today <= max_per_day;
end;
$$;

revoke all on function public.claim_mascot_turn(int, int, int) from public;
grant execute on function public.claim_mascot_turn(int, int, int) to authenticated;

comment on function public.claim_mascot_turn(int, int, int) is
  'Claims one mascot turn against both a burst window and a daily ceiling. '
  'Returns false when either is spent. The only way to touch mascot_usage: '
  'that table has RLS enabled and no policies at all.';
