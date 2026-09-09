-- Rate limiting for the mascot's model calls.
--
-- An LLM endpoint that anyone signed in can hammer is a billing denial-of-service
-- waiting to happen, so the limit has to be enforced somewhere the caller cannot
-- reach. This table has RLS enabled and NO policies at all: PostgREST can see it
-- but every statement against it matches zero rows, for every role. The only way
-- in is the SECURITY DEFINER function below.
--
-- Rate limit state a user can delete is not a rate limit.

create table public.mascot_usage (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  turns        int         not null default 0,
  primary key (user_id, window_start)
);

alter table public.mascot_usage enable row level security;

comment on table public.mascot_usage is
  'Deliberately has no RLS policies: reachable only via claim_mascot_turn().';

/**
 * Claims one mascot turn for the caller, returning whether it is allowed.
 *
 * The counter increments BEFORE the check, so a caller who blows through the
 * limit keeps being counted rather than being handed a fresh allowance the
 * moment they stop. Buckets are fixed windows, which is coarser than a sliding
 * window and much cheaper — the worst case is a caller getting two windows'
 * worth of turns across a boundary, which is an acceptable trade here.
 */
create function public.claim_mascot_turn(max_turns int default 12, window_minutes int default 5)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz;
  used   int;
begin
  if auth.uid() is null then
    return false;
  end if;

  bucket := date_trunc('hour', now())
          + make_interval(mins => (extract(minute from now())::int / window_minutes) * window_minutes);

  insert into public.mascot_usage as u (user_id, window_start, turns)
  values (auth.uid(), bucket, 1)
  on conflict (user_id, window_start)
    do update set turns = u.turns + 1
  returning u.turns into used;

  -- Keep the caller's own history from growing without bound. Cheap because it
  -- is indexed by the primary key's leading column.
  delete from public.mascot_usage
  where user_id = auth.uid() and window_start < now() - interval '1 day';

  return used <= max_turns;
end;
$$;

revoke all on function public.claim_mascot_turn(int, int) from public;
grant execute on function public.claim_mascot_turn(int, int) to authenticated;
