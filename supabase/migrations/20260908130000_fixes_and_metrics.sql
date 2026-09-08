-- Fixes two defects found reviewing v1, and adds the aggregates the richer
-- dashboard and the community strip need.

-- ---------------------------------------------------------------- defect 1 --
-- `CHECK (ridden_on <= CURRENT_DATE)` used a non-immutable function, which the
-- Postgres docs call undefined behaviour, and pinned "today" to the database's
-- timezone (UTC). An enthusiast in UTC+13 logging a ride on their own Saturday
-- morning was rejected because UTC still said Friday.
--
-- A calendar date has no timezone, so the honest bound is "not implausibly far
-- ahead": one day of slack covers every real offset. Anything tighter is the
-- app's job, where the user's own clock is available.
alter table public.rides drop constraint rides_ridden_on_check;

create or replace function public.ride_date_is_plausible(d date)
returns boolean
language sql
immutable
as $$
  -- 1884 is Coney Island's Switchback Railway: the first rollercoaster you
  -- could buy a ticket for, so nothing earlier is a credit.
  select d >= date '1884-01-01' and d <= date '2200-01-01';
$$;

alter table public.rides
  add constraint rides_ridden_on_plausible
  check (public.ride_date_is_plausible(ridden_on));

-- ---------------------------------------------------------------- defect 2 --
-- The GIN full-text index was never reachable: catalogue search runs ILIKE
-- '%term%', which no tsvector index can serve. Replaced with trigram indexes,
-- which ILIKE actually uses.
drop index if exists public.coasters_name_idx;

create extension if not exists pg_trgm;

create index coasters_name_trgm on public.coasters using gin (name gin_trgm_ops);
create index coasters_park_trgm on public.coasters using gin (park gin_trgm_ops);
create index coasters_country_trgm on public.coasters using gin (country gin_trgm_ops);
create index coasters_manufacturer_trgm on public.coasters using gin (manufacturer gin_trgm_ops);

-- ------------------------------------------------------------ community -----
-- Aggregates for the signed-out landing page.
--
-- Privacy: these count ONLY users who opted into the leaderboard. Consent to be
-- counted publicly is the same consent the leaderboard asks for, so no user who
-- chose privacy contributes to any public number. That is stricter than it needs
-- to be for large samples and exactly right for small ones, where a global total
-- is close to a personal one.
create view public.community_stats
with (security_invoker = off) as
  select
    count(distinct p.id)::int          as riders,
    count(r.id)::int                   as rides,
    count(distinct r.coaster_id)::int  as coasters_ridden,
    count(distinct c.country)::int     as countries
  from public.profiles p
  left join public.rides r on r.user_id = p.id
  left join public.coasters c on c.id = r.coaster_id
  where p.leaderboard_opt_in;

revoke all on public.community_stats from anon, authenticated;
grant select on public.community_stats to anon, authenticated;

-- The catalogue size is public: it is the same number a signed-out visitor would
-- get by counting the seed file, and it makes the landing page honest about scale.
create view public.catalogue_stats
with (security_invoker = off) as
  select
    count(*)::int                      as coasters,
    count(distinct park)::int          as parks,
    count(distinct country)::int       as countries,
    count(distinct manufacturer)::int  as manufacturers
  from public.coasters;

revoke all on public.catalogue_stats from anon, authenticated;
grant select on public.catalogue_stats to anon, authenticated;
