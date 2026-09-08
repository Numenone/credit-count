import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeStats } from "@/lib/stats";
import { COASTER_COLUMNS, type Coaster, type RideWithCoaster } from "@/lib/database.types";
import type { RideSummary } from "@/components/coaster-modal";
import { CoasterDetailsProvider } from "@/components/coaster-details";
import { RidesList } from "@/components/rides-list";
import { EmptyState } from "@/components/empty-state";
import { TicketIcon, LockIcon, PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "My rides" };

export default async function RidesPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rides }, { data: catalogue }] = await Promise.all([
    supabase
      .from("rides")
      .select(`id, coaster_id, ridden_on, note, created_at, user_id, coaster:coasters(${COASTER_COLUMNS})`)
      .order("ridden_on", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<RideWithCoaster[]>(),
    supabase.from("coasters").select(COASTER_COLUMNS).order("name").returns<Coaster[]>(),
  ]);

  const list = rides ?? [];
  const stats = computeStats(list);

  // The earliest ride on each coaster is the one that earned the credit; later
  // rides on the same coaster add to the ride total only. Rides come back newest
  // first, so walking backwards finds the earliest occurrence per coaster.
  const creditRideIds: string[] = [];
  const seen = new Set<string>();
  for (let i = list.length - 1; i >= 0; i--) {
    const ride = list[i];
    if (!seen.has(ride.coaster_id)) {
      seen.add(ride.coaster_id);
      creditRideIds.push(ride.id);
    }
  }

  const summaries: Record<string, RideSummary> = {};
  for (const ride of list) {
    const summary = (summaries[ride.coaster_id] ??= { count: 0, first: null, last: null, notes: [] });
    summary.count += 1;
    summary.last ??= ride.ridden_on;
    summary.first = ride.ridden_on;
    if (ride.note && summary.notes.length < 3) summary.notes.push(ride.note);
  }

  return (
    <CoasterDetailsProvider unitSystem={profile.unit_system} rideSummaries={summaries}>
    <div className="space-y-8">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="chip">
              <LockIcon size={11} />
              Only you can see this
            </span>
          </div>
          <h1 className="display mt-2.5 text-3xl font-semibold sm:text-4xl">My rides</h1>
          <p className="mt-2 text-sm text-[var(--ink-2)]">
            <span className="tabular font-semibold text-[var(--ink)]">{stats.rides}</span>{" "}
            {stats.rides === 1 ? "ride" : "rides"} ·{" "}
            <span className="tabular font-semibold text-[var(--ink)]">{stats.credits}</span>{" "}
            {stats.credits === 1 ? "credit" : "credits"}
            {stats.firstRide && (
              <> · riding since {stats.firstRide.slice(0, 4)}</>
            )}
          </p>
        </div>

        <Link href="/dashboard" className="btn btn-primary">
          <PlusIcon size={14} />
          Log a ride
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="card rise p-2">
          <EmptyState
            icon={<TicketIcon size={18} />}
            title="No rides logged yet"
            body="Search the catalogue from your dashboard and log the first coaster you have ridden. Every credit you add builds the stats there."
            action={
              <Link href="/dashboard" className="btn btn-primary">
                Log your first credit
              </Link>
            }
          />
        </div>
      ) : (
        <RidesList
          rides={list}
          catalogue={catalogue ?? []}
          today={today}
          creditRideIds={creditRideIds}
        />
      )}
    </div>
    </CoasterDetailsProvider>
  );
}
