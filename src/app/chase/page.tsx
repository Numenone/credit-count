import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COASTER_COLUMNS, type Coaster, type Ride } from "@/lib/database.types";
import { CoasterDetailsProvider } from "@/components/coaster-details";
import { ChaseList } from "@/components/chase-list";
import { StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { TicketIcon, PinIcon, GlobeIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Chase list" };

/**
 * What is left to ride.
 *
 * The dashboard answers "what have I done"; this answers "where should I go
 * next", which is the question a credit counter actually acts on. It is built
 * entirely from data the user can already see — the shared catalogue minus their
 * own rides — so it needs no new permissions.
 */
export default async function ChasePage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: coasters }, { data: rides }] = await Promise.all([
    supabase.from("coasters").select(COASTER_COLUMNS).order("name").returns<Coaster[]>(),
    supabase.from("rides").select("coaster_id").returns<Pick<Ride, "coaster_id">[]>(),
  ]);

  const catalogue = coasters ?? [];
  const ridden = new Set((rides ?? []).map((r) => r.coaster_id));
  const remaining = catalogue.filter((c) => !ridden.has(c.id));

  const parksLeft = new Set(remaining.map((c) => `${c.park}|${c.country}`)).size;
  const countriesLeft = new Set(remaining.map((c) => c.country)).size;
  const pct = catalogue.length === 0 ? 0 : (ridden.size / catalogue.length) * 100;

  return (
    <CoasterDetailsProvider unitSystem={profile.unit_system}>
      <div className="space-y-8">
        <header className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)]">
              Still to ride
            </p>
            <h1 className="display mt-1.5 text-3xl font-semibold sm:text-4xl">Chase list</h1>
            <p className="mt-2 max-w-lg text-sm text-[var(--ink-2)]">
              Every coaster in the catalogue you have not logged yet, grouped by park so a trip
              plans itself.
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-quiet">
            Back to dashboard
          </Link>
        </header>

        <section className="stagger grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Credits remaining"
            value={remaining.length}
            hint={`of ${catalogue.length} in the catalogue`}
            emphasis
            icon={<TicketIcon size={13} />}
          />
          <StatTile
            label="Parks to visit"
            value={parksLeft}
            hint="With at least one new credit"
            icon={<PinIcon size={13} />}
          />
          <StatTile
            label="Countries"
            value={countriesLeft}
            hint="Where credits are waiting"
            icon={<GlobeIcon size={13} />}
          />
        </section>

        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Catalogue completion</h2>
            <span className="tabular text-sm font-semibold">{Math.round(pct)}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-[4px] bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-r-[4px] origin-left"
              style={{
                width: `${Math.max(1, pct)}%`,
                backgroundColor: "var(--brand)",
                animation: "grow-x 720ms var(--ease-out) both",
              }}
            />
          </div>
          <p className="mt-2.5 text-xs text-[var(--ink-3)]">
            {ridden.size} of {catalogue.length} catalogue coasters ridden. This measures the seeded
            catalogue, not every coaster that exists — an admin adding entries will move it.
          </p>
        </section>

        {remaining.length === 0 ? (
          <div className="card p-2">
            <EmptyState
              icon={<TicketIcon size={18} />}
              title="You have ridden the entire catalogue"
              body="Every coaster currently in the catalogue is logged against your account. Ask an admin to add more, or go back and re-ride a favourite."
              action={
                <Link href="/dashboard" className="btn btn-primary">
                  Back to dashboard
                </Link>
              }
            />
          </div>
        ) : (
          <ChaseList coasters={remaining} unitSystem={profile.unit_system} />
        )}
      </div>
    </CoasterDetailsProvider>
  );
}
