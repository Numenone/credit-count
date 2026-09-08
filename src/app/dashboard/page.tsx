import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeStats, computeMilestones } from "@/lib/stats";
import { formatDistance, formatSpeed, formatVertical } from "@/lib/units";
import { COASTER_COLUMNS, type Coaster, type RideWithCoaster } from "@/lib/database.types";
import type { RideSummary } from "@/components/coaster-modal";
import { CoasterDetailsProvider } from "@/components/coaster-details";
import { StatTile } from "@/components/stat-tile";
import { BarList } from "@/components/bar-list";
import { TypeSplit } from "@/components/type-split";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { Milestones } from "@/components/milestones";
import { LogRideForm } from "@/components/log-ride-form";
import { EmptyState } from "@/components/empty-state";
import {
  TicketIcon,
  RepeatIcon,
  GlobeIcon,
  PinIcon,
  SearchIcon,
  TrophyIcon,
  ArrowRightIcon,
} from "@/components/icons";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * PostgREST `or=` filters are comma/parenthesis delimited, so those characters
 * are stripped from user input before interpolation. ILIKE wildcards are removed
 * rather than escaped: PostgREST has no portable escape for them inside `or=`,
 * and a search box that silently accepts `%` as "match anything" is a surprise,
 * not a feature.
 */
function sanitiseQuery(raw: string) {
  return raw.replace(/[(),*]/g, " ").replace(/[%_\\]/g, "").trim().slice(0, 60);
}

function monthName(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { profile } = await requireUser();
  const units = profile.unit_system;
  const supabase = await createClient();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = sanitiseQuery(rawQuery);
  const today = new Date().toISOString().slice(0, 10);

  // RLS restricts this to the caller's own rides; no user_id filter is required
  // and adding one would not change what comes back.
  const ridesPromise = supabase
    .from("rides")
    .select(`id, coaster_id, ridden_on, note, created_at, user_id, coaster:coasters(${COASTER_COLUMNS})`)
    .order("ridden_on", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<RideWithCoaster[]>();

  const cataloguePromise = (
    query
      ? supabase
          .from("coasters")
          .select(COASTER_COLUMNS)
          .or(`name.ilike.%${query}%,park.ilike.%${query}%,country.ilike.%${query}%`)
          .order("name")
          .limit(8)
      : supabase
          .from("coasters")
          .select(COASTER_COLUMNS)
          .order("created_at", { ascending: false })
          .order("name")
          .limit(5)
  ).returns<Coaster[]>();

  const [{ data: rides }, { data: catalogue }] = await Promise.all([
    ridesPromise,
    cataloguePromise,
  ]);

  const rideList = rides ?? [];
  const stats = computeStats(rideList);
  const milestones = computeMilestones(stats);
  const isNewUser = stats.rides === 0;

  // Per-coaster history, used by the detail modal and by the "×3" chips in the
  // log panel. Built once here rather than queried again from the client.
  const ridesByCoaster = new Map<string, number>();
  const summaries: Record<string, RideSummary> = {};
  for (const ride of rideList) {
    ridesByCoaster.set(ride.coaster_id, (ridesByCoaster.get(ride.coaster_id) ?? 0) + 1);
    const summary = (summaries[ride.coaster_id] ??= {
      count: 0,
      first: null,
      last: null,
      notes: [],
    });
    summary.count += 1;
    // Rides arrive newest-first, so the last one seen is the earliest.
    summary.last ??= ride.ridden_on;
    summary.first = ride.ridden_on;
    if (ride.note && summary.notes.length < 3) summary.notes.push(ride.note);
  }

  return (
    <CoasterDetailsProvider unitSystem={units} rideSummaries={summaries}>
      <div className="space-y-10">
        {/* -------------------------------------------------------- header -- */}
        <header className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)]">
              {isNewUser ? "Welcome" : "Your credits"}
            </p>
            <h1 className="display mt-1.5 text-3xl font-semibold sm:text-4xl">
              {profile.display_name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/chase" className="btn btn-quiet !py-1.5 !text-[0.82rem]">
              Chase list
              <ArrowRightIcon size={13} />
            </Link>
            <Link
              href="/settings"
              className={`chip ${profile.leaderboard_opt_in ? "chip-brand" : ""} !py-1 hover:opacity-80`}
            >
              {profile.leaderboard_opt_in ? <TrophyIcon size={11} /> : null}
              {profile.leaderboard_opt_in ? "On the leaderboard" : "Private — not listed"}
            </Link>
          </div>
        </header>

        {/* ------------------------------------------------------- headline -- */}
        <section className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Credits"
            value={stats.credits}
            hint="Unique coasters ridden"
            emphasis
            icon={<TicketIcon size={13} />}
          />
          <StatTile
            label="Total rides"
            value={stats.rides}
            hint={
              stats.reRidden > 0
                ? `${stats.reRidden} ${stats.reRidden === 1 ? "coaster" : "coasters"} ridden more than once`
                : "Including repeat rides"
            }
            icon={<RepeatIcon size={13} />}
          />
          <StatTile
            label="Parks"
            value={stats.parks}
            hint={stats.ridingDays > 0 ? `Across ${stats.ridingDays} riding days` : "Parks visited"}
            icon={<PinIcon size={13} />}
          />
          <StatTile
            label="Countries"
            value={stats.countries}
            hint={
              stats.manufacturers > 0
                ? `${stats.manufacturers} ${stats.manufacturers === 1 ? "manufacturer" : "manufacturers"} ridden`
                : "Countries ridden in"
            }
            icon={<GlobeIcon size={13} />}
          />
        </section>

        {/* ------------------------------------------------------ log panel -- */}
        <section className="rise">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Log a ride</h2>
            <p className="text-xs text-[var(--ink-3)]">
              Search, then log. The date defaults to today; tap a name for details.
            </p>
          </div>

          <div className="card overflow-hidden">
            <form method="get" className="flex gap-2 border-b border-[var(--line)] p-4">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  name="q"
                  defaultValue={rawQuery}
                  placeholder="Search by coaster, park or country…"
                  aria-label="Search the coaster catalogue"
                  className="field !pl-9"
                />
              </div>
              <button type="submit" className="btn btn-quiet shrink-0">
                Search
              </button>
            </form>

            {catalogue && catalogue.length > 0 ? (
              <ul>
                {catalogue.map((coaster) => (
                  <LogRideForm
                    key={coaster.id}
                    coaster={coaster}
                    today={today}
                    alreadyRidden={ridesByCoaster.get(coaster.id) ?? 0}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<SearchIcon size={18} />}
                title={query ? `Nothing matches “${rawQuery}”` : "The catalogue is empty"}
                body={
                  query
                    ? "Try a park or a country instead. If the coaster genuinely is not here, an admin can add it."
                    : "No coasters have been added yet. An admin needs to populate the catalogue before rides can be logged."
                }
              />
            )}

            {!query && catalogue && catalogue.length > 0 && (
              <p className="border-t border-[var(--line)] px-5 py-2.5 text-xs text-[var(--ink-3)]">
                Showing the newest catalogue entries — search to reach the rest.
              </p>
            )}
          </div>
        </section>

        {isNewUser ? (
          <section className="card rise p-2">
            <EmptyState
              icon={<TicketIcon size={18} />}
              title="Your stats appear as soon as you log a ride"
              body="Credits by country, manufacturer and type, distance covered, a year of riding activity, and your milestones all build from your ride history. Nothing to configure."
            />
          </section>
        ) : (
          <>
            {/* ------------------------------------------------- distances -- */}
            <section className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Track covered"
                value={formatDistance(stats.distanceM, units)}
                hint="Every lap of every ride added up"
              />
              <StatTile
                label="Height climbed"
                value={formatVertical(stats.verticalM, units)}
                hint="Lift hills, cumulative"
              />
              <StatTile
                label="Inversions"
                value={stats.inversions}
                hint="Counted per ride, not per credit"
              />
              <StatTile
                label="Fastest ridden"
                value={stats.fastest ? formatSpeed(stats.fastest.speedKmh, units)! : "—"}
                hint={stats.fastest ? stats.fastest.name : "No speeds recorded"}
              />
            </section>

            {/* ------------------------------------------------- secondary -- */}
            <section className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Most ridden"
                value={stats.mostRidden ? `${stats.mostRidden.rides}×` : "—"}
                hint={
                  stats.mostRidden
                    ? `${stats.mostRidden.name} · ${stats.mostRidden.park}`
                    : "No rides yet"
                }
              />
              <StatTile
                label="Rides per credit"
                value={stats.repeatRatio}
                decimals={2}
                hint={
                  stats.repeatRatio > 1.4
                    ? "You re-ride your favourites"
                    : "Mostly chasing new credits"
                }
              />
              <StatTile
                label="Busiest month"
                value={stats.busiestMonth ? stats.busiestMonth.rides : 0}
                hint={stats.busiestMonth ? monthName(stats.busiestMonth.month) : "No rides yet"}
              />
              <StatTile
                label="Oldest credit"
                value={stats.oldest ? stats.oldest.year : "—"}
                hint={
                  stats.oldest && stats.newest
                    ? `${stats.oldest.name} · newest is ${stats.newest.year}`
                    : "No opening years recorded"
                }
              />
            </section>

            {/* -------------------------------------------------- activity -- */}
            <section className="rise">
              <ActivityHeatmap activity={stats.activity} today={today} />
            </section>

            {/* ------------------------------------------------ breakdowns -- */}
            <section className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <BarList
                  title="Credits by country"
                  subtitle={`${stats.countries} total`}
                  items={stats.byCountry}
                />
                <BarList
                  title="Credits by manufacturer"
                  subtitle={`${stats.manufacturers} total`}
                  items={stats.byManufacturer}
                />
              </div>
              <TypeSplit items={stats.byType} />
            </section>

            {/* ----------------------------------- milestones + top coasters -- */}
            <section className="grid gap-4 lg:grid-cols-2">
              <Milestones milestones={milestones} />

              <div className="card p-5">
                <header className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">Most ridden coasters</h3>
                  <Link href="/rides" className="link-quiet text-xs">
                    Full history
                  </Link>
                </header>

                <ol className="mt-4 space-y-2.5">
                  {stats.topCoasters.map((coaster, i) => (
                    <li key={coaster.id} className="flex items-center gap-3">
                      <span className="tabular w-4 shrink-0 text-xs text-[var(--ink-3)]">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{coaster.name}</p>
                        <p className="truncate text-xs text-[var(--ink-3)]">
                          {coaster.park} · {coaster.country}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold">
                        {coaster.rides}×
                      </span>
                    </li>
                  ))}
                </ol>

                <Link href="/rides" className="btn btn-quiet mt-5 w-full !text-[0.82rem]">
                  Edit your ride history
                  <ArrowRightIcon size={13} />
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </CoasterDetailsProvider>
  );
}
