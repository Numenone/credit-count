# Credit Count

A credit tracker for the rollercoaster enthusiast community. Enthusiasts log rides against a shared
coaster catalogue, watch their credit count and stats, and can opt in to a public leaderboard.

> A **credit** is a unique coaster ridden at least once. Riding the same coaster again increases the
> ride total, never the credit count. The app tracks both.

Built for the Koin Limited AI Product Engineer task from the accompanying Statement of Work. See
[`docs/TDD.md`](docs/TDD.md) for the technical design.

## Live app

**https://credit-count-iota.vercel.app**

| Role       | Email                        | Password             | State                          |
| ---------- | ---------------------------- | -------------------- | ------------------------------ |
| Enthusiast | `enthusiast@creditcount.app` | `[rotated, removed from history]` | 18 credits / 23 rides, opted in |
| Enthusiast | `rival@creditcount.app`      | `[rotated, removed from history]` | 15 credits / 18 rides, opted in |
| Admin      | `admin@creditcount.app`      | `[rotated, removed from history]`  | 5 credits, **not** opted in     |

The second enthusiast exists so the privacy boundary can be demonstrated rather than described: sign
in as one and try to reach the other's rides. The admin is deliberately left off the leaderboard —
toggling it on in Settings shows opt-in working live.

## Stack

| Layer     | Choice                                                   |
| --------- | -------------------------------------------------------- |
| Front end | Next.js 16 (App Router, Server Components, Server Actions) |
| Styling   | Tailwind CSS v4                                            |
| Data      | Supabase Postgres, accessed through PostgREST              |
| Auth      | Supabase Auth (email + password)                           |
| Hosting   | Vercel                                                     |

## Security model in one paragraph

Every query runs as the signed-in user with the anon key. The service-role key is not used anywhere
in this repository, so there is no code path that can bypass Row Level Security. Ride history is
private to its owner — no policy grants read access to anyone else, admins included. Catalogue
writes are gated by an `is_admin()` check in the RLS policies, not by a UI condition. Role
escalation is blocked by column-level grants: the `authenticated` role can only update
`display_name` and `leaderboard_opt_in` on its own profile row. The single cross-user aggregate is
the `leaderboard` view, which is `security_invoker = off` and projects exactly display name, credit
count and rank for opted-in users.

`scripts/verify-security.mjs` proves all of the above by calling the database directly, without
going through the app.

## Local development

```bash
npm install
cp .env.example .env.local        # fill in the two NEXT_PUBLIC_ values
npm run dev
```

Apply the schema to a fresh Supabase project by running the two files in `supabase/migrations/` in
order, in the SQL editor or via `supabase db push`.

Grant admin to an account after it has signed up:

```sql
update public.profiles set role = 'admin' where id = (
  select id from auth.users where email = 'admin@example.com'
);
```

## Verifying the security model

Two suites, run against the live system:

```bash
node --env-file=.env.local scripts/verify-security.mjs       # 23 checks, database layer
node --env-file=.env.local scripts/verify-http-security.mjs  # 44 checks, deployed app over HTTP
```

The HTTP suite signs each role in for real and encodes the session into the
cookie the app expects, so its requests are indistinguishable from that user
driving a browser. It covers admin page gating, API authorisation, cross-user
access, hostile query strings, and response headers.

Requires two enthusiast accounts and, optionally, an admin account, set in `.env.local`.

## Repository layout

```
src/app/                 routes: /, /login, /signup, /leaderboard, /dashboard, /rides, /chase, /settings
src/app/admin/           admin console: overview, catalogue CRUD, API explorer
src/app/api/v1/          REST API — coasters, rides, me, stats, leaderboard, export
src/components/          shared UI
src/lib/actions/         server actions (auth, rides, profile, catalogue)
src/lib/supabase/        server client and session refresh
src/lib/stats.ts         credit, breakdown, distance and milestone calculations
src/lib/units.ts         metric/imperial formatting (SI is the only stored unit)
src/lib/api-spec.ts      endpoint descriptions the explorer renders
src/proxy.ts             session refresh + route gating (Next 16 renamed middleware to proxy)
supabase/migrations/     schema, RLS policies, leaderboard view, catalogue seed
scripts/                 database-level security verification
docs/TDD.md              technical design document
```

## Beyond the SOW

The brief asked for a credit tracker. These went in on top, and each is flagged in the TDD:

| Feature | Why |
| --- | --- |
| Coaster measurements, coordinates and park links | A catalogue that only identifies a coaster cannot describe one. These make the detail modal, the map link and the physical stats possible. |
| Metric / imperial preference | Stored in SI, converted at render. Two users with different settings still compare like for like. |
| Chase list (`/chase`) | The dashboard answers "what have I ridden". This answers "where do I go next", grouped by park, which is the question a credit counter actually acts on. |
| REST API (`/api/v1`) | The same data as the pages, through the same RLS. No handler contains a role check. |
| API explorer (`/admin/api`) | A hand-built request runner in the site's own theme. Sends real requests with your real session, so an enthusiast watching a 403 arrive is watching Postgres refuse them. |
| Admin overview | Catalogue completeness, distributions and possible duplicates — all aggregates, none of it anyone's ride history. |
| Data export | CSV and JSON of your own rides. Privacy that traps your data is only half a promise. |

## Verifying the security model

```bash
node --env-file=.env.local scripts/verify-security.mjs
```

23 checks run against the live database with the anon key, bypassing the UI entirely: what a
visitor can read, that one enthusiast cannot touch another's rides, that an enthusiast can set
their own unit preference but cannot name `role` in the same update, and that an admin can curate
the catalogue while still being unable to read anyone's history.
