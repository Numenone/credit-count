# Credit Count

A credit tracker for the rollercoaster enthusiast community. Enthusiasts log rides against a shared
coaster catalogue, watch their credit count and stats, and can opt in to a public leaderboard.

> A **credit** is a unique coaster ridden at least once. Riding the same coaster again increases the
> ride total, never the credit count. The app tracks both.

Built for the Koin Limited AI Product Engineer task from the accompanying Statement of Work. See
[`docs/TDD.md`](docs/TDD.md) for the technical design.

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

```bash
node --env-file=.env.local scripts/verify-security.mjs
```

Requires two enthusiast accounts and, optionally, an admin account, set in `.env.local`.

## Repository layout

```
src/app/                 routes: /, /login, /signup, /leaderboard, /dashboard, /rides, /settings, /admin
src/components/          shared UI
src/lib/actions/         server actions (auth, rides, profile, catalogue)
src/lib/supabase/        server client and session refresh
src/lib/stats.ts         credit and breakdown calculations
src/proxy.ts             session refresh + route gating (Next 16 renamed middleware to proxy)
supabase/migrations/     schema, RLS policies, leaderboard view, catalogue seed
scripts/                 database-level security verification
docs/TDD.md              technical design document
```
