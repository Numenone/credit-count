-- A refused attempt must not spend the day.
--
-- The burst window and the daily ceiling shared one counter, and every attempt
-- incremented it, refusals included. Counting refusals against the burst window
-- is deliberate: it stops a caller who blows through the limit being handed a
-- fresh allowance the moment they pause. Counting them against the *day* is a
-- trap, because the burst refusal says "try again shortly" and trying again is
-- what spends the day. Eight questions and a handful of retries could cost
-- someone sixty.
--
-- Found the way these things are found: a person asked one question, was told
-- to wait, and was still being told to wait long after the five-minute window
-- had rolled over.
--
-- The fix separates the two counts. `turns` keeps counting every attempt and
-- keeps governing the burst window, unchanged. `granted` counts only the
-- attempts that were actually allowed, and that is what the daily ceiling
-- measures. The ceiling now means what its name says: how many answers one
-- person may have in a day.

alter table public.mascot_usage
  add column granted int not null default 0;

comment on column public.mascot_usage.turns is
  'Every claim attempt in this window, refusals included. Governs the burst limit.';
comment on column public.mascot_usage.granted is
  'Only the attempts that were allowed. Governs the daily ceiling, so that '
  'retrying after a burst refusal cannot spend a day''s allowance.';

/**
 * Claims one mascot turn against both a burst window and a daily ceiling.
 *
 * Returns false when either is spent. Still the only way to touch
 * mascot_usage: that table has RLS enabled and no policies at all.
 */
create or replace function public.claim_mascot_turn(
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
  allowed   boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  bucket := date_trunc('hour', now())
          + make_interval(mins => (extract(minute from now())::int / window_minutes) * window_minutes);

  -- Counts before it checks, so a caller who blows through the burst limit
  -- keeps being counted rather than being handed a fresh allowance the moment
  -- they stop.
  insert into public.mascot_usage as u (user_id, window_start, turns)
  values (auth.uid(), bucket, 1)
  on conflict (user_id, window_start)
    do update set turns = u.turns + 1
  returning u.turns into used;

  -- Read before the increment below, so the comparison is "have they already
  -- had their day's worth" rather than "would this one put them over".
  select coalesce(sum(granted), 0) into today
  from public.mascot_usage
  where user_id = auth.uid()
    and window_start >= date_trunc('day', now());

  allowed := used <= max_turns and today < max_per_day;

  -- Only a granted turn is charged to the day.
  if allowed then
    update public.mascot_usage
    set granted = granted + 1
    where user_id = auth.uid() and window_start = bucket;
  end if;

  -- Cheap: indexed by the primary key's leading column, and this sweep keeps at
  -- most a day of rows per caller.
  delete from public.mascot_usage
  where user_id = auth.uid() and window_start < now() - interval '1 day';

  return allowed;
end;
$$;

revoke all on function public.claim_mascot_turn(int, int, int) from public;
grant execute on function public.claim_mascot_turn(int, int, int) to authenticated;

comment on function public.claim_mascot_turn(int, int, int) is
  'Claims one mascot turn against both a burst window and a daily ceiling. '
  'Refusals count against the window but not against the day, because the '
  'burst refusal invites a retry and a retry must not cost an answer.';
