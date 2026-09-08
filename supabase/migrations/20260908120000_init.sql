-- Credit Count — core schema, RLS, and leaderboard.
-- Security model: every table is RLS-protected; privacy is enforced in Postgres,
-- not in the Next.js layer, so direct PostgREST calls are covered too.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null check (char_length(trim(display_name)) between 2 and 40),
  role               text not null default 'enthusiast' check (role in ('enthusiast', 'admin')),
  leaderboard_opt_in boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------- coasters --
create table public.coasters (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 1 and 120),
  park         text not null check (char_length(trim(park)) between 1 and 120),
  country      text not null check (char_length(trim(country)) between 1 and 60),
  manufacturer text not null check (char_length(trim(manufacturer)) between 1 and 80),
  type         text not null check (type in ('Steel', 'Wooden', 'Hybrid')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Catalogue integrity: the same coaster cannot be entered twice for a park.
-- Guards the "duplicate entries corrupt cross-user comparison" risk in the SOW.
create unique index coasters_name_park_uniq
  on public.coasters (lower(trim(name)), lower(trim(park)));
create index coasters_name_idx on public.coasters using gin (to_tsvector('simple', name || ' ' || park));

-- ------------------------------------------------------------------- rides --
create table public.rides (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coaster_id uuid not null references public.coasters (id) on delete restrict,
  ridden_on  date not null check (ridden_on >= '1884-01-01' and ridden_on <= current_date),
  note       text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

create index rides_user_idx on public.rides (user_id, ridden_on desc);
create index rides_user_coaster_idx on public.rides (user_id, coaster_id);

-- ---------------------------------------------------------------- triggers --
-- A profile is created for every new auth user, with the display name captured
-- at sign-up. Runs as definer because auth.users inserts happen as supabase_auth_admin.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Enthusiast')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger coasters_touch_updated_at
  before update on public.coasters
  for each row execute function public.touch_updated_at();

-- Admin lookup. SECURITY DEFINER so the policies below do not recurse into
-- the profiles RLS policy that calls them.
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- --------------------------------------------------------------------- RLS --
alter table public.profiles enable row level security;
alter table public.coasters enable row level security;
alter table public.rides    enable row level security;

-- profiles: a user sees and edits only their own row.
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Role escalation is blocked at the column level: even a valid UPDATE from the
-- owner cannot touch `role`, so a hand-crafted PostgREST call cannot self-promote.
revoke update on public.profiles from authenticated;
grant update (display_name, leaderboard_opt_in) on public.profiles to authenticated;

-- coasters: readable by signed-in users only (visitors get the leaderboard, nothing else);
-- writable by admins only, enforced in the database.
create policy "coasters: read when signed in"
  on public.coasters for select to authenticated
  using (true);

create policy "coasters: admin insert"
  on public.coasters for insert to authenticated
  with check ((select public.is_admin()));

create policy "coasters: admin update"
  on public.coasters for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "coasters: admin delete"
  on public.coasters for delete to authenticated
  using ((select public.is_admin()));

-- rides: fully private. No policy grants any user access to another user's rows,
-- so admins cannot read ride histories either — matching the SOW role table.
create policy "rides: read own"
  on public.rides for select to authenticated
  using (user_id = (select auth.uid()));

create policy "rides: insert own"
  on public.rides for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "rides: update own"
  on public.rides for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "rides: delete own"
  on public.rides for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------- leaderboard --
-- The only aggregate that crosses user boundaries. It is a SECURITY DEFINER view
-- (security_invoker = off) so it can count rides the caller cannot read, and its
-- projection is fixed: display name and credit count. There is no column, filter,
-- or join path from here back to which coasters anyone rode.
create view public.leaderboard
with (security_invoker = off) as
  select
    p.display_name,
    count(distinct r.coaster_id)::int as credits,
    rank() over (order by count(distinct r.coaster_id) desc)::int as rank
  from public.profiles p
  left join public.rides r on r.user_id = p.id
  where p.leaderboard_opt_in
  group by p.id, p.display_name;

revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
