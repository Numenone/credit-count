-- Security hardening.

-- ---------------------------------------------------------------- search --
-- Catalogue search was built by interpolating the user's term into a PostgREST
-- `or=` filter string. supabase-js never concatenates SQL, so this was never a
-- SQL injection — but it WAS injection into PostgREST's own filter grammar, and
-- it was defended by stripping characters, which is the weakest kind of defence:
-- it fails open the day someone finds a character you forgot.
--
-- The term is now a bound parameter. There is no string to break out of.
-- ILIKE's own wildcards are escaped so searching for "%" finds a literal per
-- cent sign instead of matching every row.
create or replace function public.search_coasters(term text, max_results int default 50)
returns setof public.coasters
language sql
stable
security invoker
set search_path = public
as $$
  with needle as (
    select '%' ||
      replace(replace(replace(btrim(coalesce(term, '')), '\', '\\'), '%', '\%'), '_', '\_')
      || '%' as pattern
  )
  select c.*
  from public.coasters c, needle n
  where btrim(coalesce(term, '')) <> ''
    and (
      c.name         ilike n.pattern escape '\'
      or c.park         ilike n.pattern escape '\'
      or c.country      ilike n.pattern escape '\'
      or c.manufacturer ilike n.pattern escape '\'
    )
  order by c.name
  limit greatest(1, least(coalesce(max_results, 50), 200));
$$;

-- SECURITY INVOKER, so the coasters RLS policy still decides who sees rows: a
-- signed-out caller gets nothing from this function, exactly as from the table.
revoke all on function public.search_coasters(text, int) from public;
grant execute on function public.search_coasters(text, int) to authenticated;

-- ------------------------------------------------------- catalogue health --
-- This was readable by any authenticated user. The numbers are harmless, but
-- "harmless" is a judgement that has to be re-made every time a column is added,
-- and an admin-console view should simply be admin-only.
create or replace view public.catalogue_health
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
  from public.coasters
  where public.is_admin();

revoke all on public.catalogue_health from anon, authenticated;
grant select on public.catalogue_health to authenticated;
