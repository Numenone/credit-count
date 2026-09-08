-- Richer catalogue + a unit preference.
--
-- v1 stored only enough to identify a coaster. These columns make the catalogue
-- describe one: how big it is, where it physically is, and when it opened. That
-- is what lets the app show a location, offer a map link, and derive distance
-- and height figures from a ride history.
--
-- Everything is stored in SI (metres, km/h). Imperial is a presentation choice
-- applied at render time — storing both, or storing the user's preferred unit,
-- would let the two drift apart and make cross-user comparison unsafe.

alter table public.coasters
  add column height_m      numeric(6, 2) check (height_m    is null or (height_m    > 0 and height_m    < 1000)),
  add column length_m      numeric(8, 2) check (length_m    is null or (length_m    > 0 and length_m    < 100000)),
  add column speed_kmh     numeric(6, 2) check (speed_kmh   is null or (speed_kmh   > 0 and speed_kmh   < 1000)),
  add column inversions    smallint      check (inversions  is null or (inversions >= 0 and inversions  < 100)),
  add column opened_year   smallint      check (opened_year is null or (opened_year between 1884 and 2100)),
  add column park_city     text          check (park_city   is null or char_length(park_city) <= 120),
  add column park_url      text          check (park_url    is null or park_url ~ '^https://[^\s]+$'),
  add column latitude      numeric(9, 6) check (latitude    is null or latitude  between -90  and 90),
  add column longitude     numeric(9, 6) check (longitude   is null or longitude between -180 and 180);

comment on column public.coasters.height_m is 'Maximum height in metres. SI is the stored unit; imperial is a display preference.';
comment on column public.coasters.park_url is 'Official park website. https only — the value is rendered as a link.';

-- Unit preference lives on the profile so it follows the user between devices.
alter table public.profiles
  add column unit_system text not null default 'metric'
    check (unit_system in ('metric', 'imperial'));

-- The column-level grant is the escalation guard, so a new writable column has
-- to be added to it explicitly. `role` is still absent, and still unwritable.
grant update (display_name, leaderboard_opt_in, unit_system) on public.profiles to authenticated;

-- Catalogue completeness, for the admin console. Aggregate only: it counts rows
-- with missing fields, and exposes nothing about any user.
create view public.catalogue_health
with (security_invoker = on) as
  select
    count(*)::int                                              as total,
    count(*) filter (where height_m is null)::int              as missing_height,
    count(*) filter (where length_m is null)::int              as missing_length,
    count(*) filter (where speed_kmh is null)::int             as missing_speed,
    count(*) filter (where latitude is null
                        or longitude is null)::int             as missing_location,
    count(*) filter (where park_url is null)::int              as missing_park_url,
    count(*) filter (where opened_year is null)::int           as missing_opened_year
  from public.coasters;

revoke all on public.catalogue_health from anon, authenticated;
grant select on public.catalogue_health to authenticated;
