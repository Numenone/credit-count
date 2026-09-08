import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeStats } from "@/lib/stats";
import type { Coaster, RideWithCoaster } from "@/lib/database.types";
import { StatTile } from "@/components/stat-tile";
import { BreakdownList } from "@/components/breakdown-list";
import { LogRideForm } from "@/components/log-ride-form";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * PostgREST `or=` filters are comma/parenthesis delimited, so those characters
 * are stripped from user input before interpolation. `%` and `_` are escaped so
 * they are matched literally instead of acting as ILIKE wildcards.
 */
function sanitiseQuery(raw: string) {
  return raw.replace(/[(),*]/g, " ").replace(/[%_\\]/g, "\\$&").trim().slice(0, 60);
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = sanitiseQuery(rawQuery);
  const today = new Date().toISOString().slice(0, 10);

  // RLS restricts this to the caller's own rides; no user_id filter is required
  // and adding one would not change what comes back.
  const ridesPromise = supabase
    .from("rides")
    .select("id, coaster_id, ridden_on, note, created_at, user_id, coaster:coasters(*)")
    .order("ridden_on", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<RideWithCoaster[]>();

  const cataloguePromise = (
    query
      ? supabase
          .from("coasters")
          .select("*")
          .or(`name.ilike.%${query}%,park.ilike.%${query}%,country.ilike.%${query}%`)
          .order("name")
          .limit(8)
      : supabase
          .from("coasters")
          .select("*")
          .order("created_at", { ascending: false })
          .order("name")
          .limit(5)
  ).returns<Coaster[]>();

  const [{ data: rides }, { data: catalogue }] = await Promise.all([
    ridesPromise,
    cataloguePromise,
  ]);

  const stats = computeStats(rides ?? []);
  const recent = (rides ?? []).slice(0, 5);

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stats.credits === 0 ? `Welcome, ${profile.display_name}` : profile.display_name}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
            {profile.leaderboard_opt_in
              ? "You appear on the public leaderboard."
              : "You are not on the public leaderboard."}{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Change
            </Link>
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Credits"
          value={stats.credits}
          hint="Unique coasters ridden"
          emphasis
        />
        <StatTile label="Total rides" value={stats.rides} hint="Including repeat rides" />
        <StatTile
          label="Most ridden"
          value={stats.mostRidden ? `${stats.mostRidden.rides}×` : "—"}
          hint={stats.mostRidden ? `${stats.mostRidden.name} · ${stats.mostRidden.park}` : "No rides yet"}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Log a ride</h2>
          <p className="text-xs text-[var(--color-ink-faint)]">
            {stats.parks > 0 && `${stats.parks} ${stats.parks === 1 ? "park" : "parks"} visited`}
          </p>
        </div>

        <div className="card overflow-hidden">
          <form method="get" className="flex gap-2 border-b border-[var(--color-line)] p-4">
            <input
              type="search"
              name="q"
              defaultValue={rawQuery}
              placeholder="Search the catalogue by coaster, park or country…"
              aria-label="Search the coaster catalogue"
              className="field"
            />
            <button type="submit" className="btn btn-quiet shrink-0">
              Search
            </button>
          </form>

          {catalogue && catalogue.length > 0 ? (
            <ul>
              {catalogue.map((coaster) => (
                <LogRideForm key={coaster.id} coaster={coaster} today={today} />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-[var(--color-ink-faint)]">
              No coasters match “{rawQuery}”. Try a park or country, or ask an admin to add it.
            </p>
          )}

          {!query && (
            <p className="border-t border-[var(--color-line)] px-5 py-3 text-xs text-[var(--color-ink-faint)]">
              Showing the newest catalogue entries. Search to find any of the others.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <BreakdownList title="Credits by country" items={stats.byCountry} />
        <BreakdownList title="Credits by manufacturer" items={stats.byManufacturer} />
        <BreakdownList title="Credits by type" items={stats.byType} limit={3} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent rides</h2>
          <Link href="/rides" className="text-sm text-[var(--color-ink-soft)] underline underline-offset-2">
            Full history
          </Link>
        </div>
        <div className="card overflow-hidden">
          {recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-ink-faint)]">
              Nothing logged yet. Search above and log your first credit.
            </p>
          ) : (
            <ul>
              {recent.map((ride) => (
                <li
                  key={ride.id}
                  className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ride.coaster.name}</p>
                    <p className="truncate text-xs text-[var(--color-ink-faint)]">
                      {ride.coaster.park}
                      {ride.note ? ` · ${ride.note}` : ""}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-xs text-[var(--color-ink-faint)]">
                    {ride.ridden_on}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
