-- A personal top ten.
--
-- Counting credits is what the app does; RANKING them is what enthusiasts
-- actually argue about. The two are different data — a count is derived from
-- rides, an ordering is an opinion — so it gets its own table rather than a
-- column on rides.
--
-- Deliberately capped at ten. An unbounded ranked list is a chore to maintain
-- and nobody reads past the top of it.

create table public.rankings (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  coaster_id uuid        not null references public.coasters (id) on delete cascade,
  position   int         not null check (position between 1 and 10),
  created_at timestamptz not null default now(),

  primary key (user_id, coaster_id),
  -- One coaster per slot, and one slot per coaster. Both are enforced here
  -- rather than in the application, because a ranking with two number threes is
  -- a bug that survives every code review and no constraint.
  unique (user_id, position) deferrable initially deferred
);

create index rankings_user_position_idx on public.rankings (user_id, position);

alter table public.rankings enable row level security;

-- Owner-only, in all four directions. A ranking is more personal than a ride
-- count: it is a stated opinion.
create policy "users read their own ranking"
  on public.rankings for select
  using (user_id = auth.uid());

create policy "users build their own ranking"
  on public.rankings for insert
  with check (user_id = auth.uid());

create policy "users change their own ranking"
  on public.rankings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users clear their own ranking"
  on public.rankings for delete
  using (user_id = auth.uid());

comment on table public.rankings is
  'A user''s personal top ten. Owner-only; the unique constraint on (user_id, position) is deferrable so a reorder can swap two rows in one statement.';

/**
 * Rewrites the whole ranking in one transaction.
 *
 * Reordering by updating rows one at a time transiently violates the unique
 * constraint — moving #3 to #2 collides with the existing #2 before that row
 * has moved. The constraint is deferrable so the check happens at commit, and
 * doing the whole list at once means the intermediate state never has to be
 * valid.
 *
 * Not SECURITY DEFINER: this runs as the caller, so the policies above are what
 * authorise every row it touches. The function is here for atomicity, not for
 * privilege.
 */
create function public.set_ranking(p_coaster_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  if array_length(p_coaster_ids, 1) > 10 then
    raise exception 'a top ten holds ten' using errcode = '22023';
  end if;

  delete from public.rankings where user_id = auth.uid();

  insert into public.rankings (user_id, coaster_id, position)
  select auth.uid(), id, ordinality::int
  from unnest(p_coaster_ids) with ordinality as t(id, ordinality)
  -- Only coasters they have actually ridden. Ranking something you have not
  -- been on is the one thing the hobby genuinely frowns upon.
  where exists (
    select 1 from public.rides r
    where r.user_id = auth.uid() and r.coaster_id = t.id
  );
end;
$$;

revoke all on function public.set_ranking(uuid[]) from public;
grant execute on function public.set_ranking(uuid[]) to authenticated;

/**
 * Park completion: how much of each park's catalogue a user has ridden.
 *
 * A view rather than a stored count, because it is entirely derived — and
 * security_invoker so the rides half is scoped to the caller by their own
 * policies while the catalogue half stays shared.
 */
create view public.park_completion
with (security_invoker = on) as
select
  c.park,
  c.country,
  count(distinct c.id)                                as total,
  count(distinct r.coaster_id)                        as ridden
from public.coasters c
left join public.rides r
  on r.coaster_id = c.id and r.user_id = auth.uid()
group by c.park, c.country;

comment on view public.park_completion is
  'Per-park catalogue completion for the calling user. security_invoker, so the rides side is scoped by the caller''s own policies.';
