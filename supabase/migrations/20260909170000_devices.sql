-- Connected devices: see them, and sign them out.
--
-- This closes the one thing local JWT verification gave up. Verifying the
-- signature in-process removed a ~250ms round trip per request, at the cost of
-- not noticing a session revoked elsewhere until the access token expired.
--
-- The fix is not to go back to asking Supabase Auth on every request. It is to
-- check the ONE thing that actually changes — whether the session still exists
-- — in the query the page was already making. session_user() below returns the
-- profile and that liveness flag in a single round trip, so revocation is
-- immediate again and the round trip count is unchanged.
--
-- Supabase already records user_agent and ip per session in auth.sessions, so
-- none of that is duplicated here. Only the place is ours to record, because
-- sign-in happens directly against Supabase and our servers never see it.

/* -------------------------------------------------------------- location -- */

create table public.session_places (
  session_id uuid        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  country    text,
  city       text,
  region     text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create index session_places_user_idx on public.session_places (user_id);

alter table public.session_places enable row level security;

-- Readable by its owner. Deliberately no insert or update policy: rows arrive
-- through record_session_place(), which takes the user id from the session
-- rather than from an argument.
create policy "users read their own device locations"
  on public.session_places for select
  using (user_id = auth.uid());

comment on table public.session_places is
  'Where each session was last seen, from the edge''s geo headers. Sign-in happens directly against Supabase, so this is the only place the app can learn it.';

/**
 * Records where a session is being used from.
 *
 * Called on navigation, so it has to be nearly free. The update only fires when
 * the row is stale, which makes the common case an index hit and a no-op rather
 * than a write on every page view.
 */
create function public.record_session_place(
  p_session_id uuid,
  p_country    text,
  p_city       text,
  p_region     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_session_id is null then
    return;
  end if;

  insert into public.session_places (session_id, user_id, country, city, region)
  values (p_session_id, auth.uid(), p_country, p_city, p_region)
  on conflict (session_id) do update
    set last_seen = now(),
        country   = coalesce(excluded.country, session_places.country),
        city      = coalesce(excluded.city, session_places.city),
        region    = coalesce(excluded.region, session_places.region)
    where session_places.last_seen < now() - interval '15 minutes';
end;
$$;

revoke all on function public.record_session_place(uuid, text, text, text) from public;
grant execute on function public.record_session_place(uuid, text, text, text) to authenticated;

/* ------------------------------------------------------ profile + session -- */

/**
 * The caller's profile, plus whether the session that signed the request is
 * still live.
 *
 * One function rather than two queries because it runs on every page render.
 * `session_live` is what makes signing a device out take effect immediately:
 * deleting the session revokes its refresh token straight away, but the access
 * token it already holds stays cryptographically valid until it expires, and
 * local verification alone cannot tell.
 */
create function public.session_user(p_session_id uuid)
returns table (
  id                 uuid,
  display_name       text,
  role               text,
  leaderboard_opt_in boolean,
  unit_system        text,
  created_at         timestamptz,
  session_live       boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.display_name, p.role::text, p.leaderboard_opt_in,
    p.unit_system::text, p.created_at,
    -- A null session id means a token minted before sessions were tracked, or
    -- a service context. Treated as live: this is a revocation check, not a
    -- second authentication, and the signature has already been verified.
    (p_session_id is null or exists (
      select 1 from auth.sessions s
      where s.id = p_session_id and s.user_id = auth.uid()
    )) as session_live
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.session_user(uuid) from public;
grant execute on function public.session_user(uuid) to authenticated;

/* ---------------------------------------------------------------- devices -- */

/**
 * Every session the caller has open.
 *
 * auth.sessions is not reachable through PostgREST, and should not be: it holds
 * every user's sessions. This exposes exactly the caller's own, and only the
 * columns a person needs to recognise their own devices.
 */
create function public.my_devices()
returns table (
  session_id   uuid,
  created_at   timestamptz,
  last_active  timestamptz,
  user_agent   text,
  ip           text,
  country      text,
  city         text,
  region       text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at),
    s.user_agent,
    host(s.ip),
    pl.country,
    pl.city,
    pl.region
  from auth.sessions s
  left join public.session_places pl on pl.session_id = s.id
  where s.user_id = auth.uid()
  order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) desc;
$$;

revoke all on function public.my_devices() from public;
grant execute on function public.my_devices() to authenticated;

/**
 * Signs one device out.
 *
 * Deleting the session invalidates its refresh token immediately, so the device
 * cannot mint another access token. The one it already holds is dead on the
 * next request too, because session_user() reports session_live = false and the
 * app treats that as no session.
 *
 * The ownership check is the whole point: without `s.user_id = auth.uid()` this
 * function would let any signed-in user end anyone's session.
 */
create function public.revoke_device(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  if auth.uid() is null then
    return false;
  end if;

  delete from auth.sessions s
  where s.id = p_session_id and s.user_id = auth.uid();

  get diagnostics removed = row_count;

  delete from public.session_places
  where session_id = p_session_id and user_id = auth.uid();

  return removed > 0;
end;
$$;

revoke all on function public.revoke_device(uuid) from public;
grant execute on function public.revoke_device(uuid) to authenticated;
