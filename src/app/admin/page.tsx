import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { COASTER_COLUMNS, type Coaster, type CatalogueHealth } from "@/lib/database.types";
import { StatTile } from "@/components/stat-tile";
import { BarList } from "@/components/bar-list";
import { ArrowRightIcon, LockIcon, GlobeIcon, PinIcon, TicketIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Admin overview" };

interface CommunityStats {
  riders: number;
  rides: number;
  coasters_ridden: number;
  countries: number;
}

function tally(items: string[]) {
  const map = new Map<string, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, credits]) => ({ label, credits, rides: credits }))
    .sort((a, b) => b.credits - a.credits || a.label.localeCompare(b.label));
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ data: coasters }, { data: health }, { data: community }] = await Promise.all([
    supabase.from("coasters").select(COASTER_COLUMNS).order("name").returns<Coaster[]>(),
    supabase.from("catalogue_health").select("*").single<CatalogueHealth>(),
    supabase.from("community_stats").select("*").single<CommunityStats>(),
  ]);

  const list = coasters ?? [];

  // Duplicate detection runs here rather than in SQL because the catalogue is
  // small and the rule is a judgement call: same name in two parks is usually
  // legitimate (Python exists more than once), but it is worth surfacing.
  const byName = new Map<string, Coaster[]>();
  for (const coaster of list) {
    const key = coaster.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), coaster]);
  }
  const nameClashes = [...byName.values()].filter((group) => group.length > 1);

  const decades = tally(
    list
      .filter((c) => c.opened_year != null)
      .map((c) => `${Math.floor(c.opened_year! / 10) * 10}s`),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const parks = new Set(list.map((c) => `${c.park}|${c.country}`)).size;

  const incomplete =
    (health?.missing_height ?? 0) +
    (health?.missing_speed ?? 0) +
    (health?.missing_location ?? 0) +
    (health?.missing_park_url ?? 0);

  const healthRows = [
    { label: "Height", missing: health?.missing_height ?? 0 },
    { label: "Track length", missing: health?.missing_length ?? 0 },
    { label: "Top speed", missing: health?.missing_speed ?? 0 },
    { label: "Coordinates", missing: health?.missing_location ?? 0 },
    { label: "Park website", missing: health?.missing_park_url ?? 0 },
    { label: "Opening year", missing: health?.missing_opened_year ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <section className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Catalogue"
          value={list.length}
          hint="Coasters everyone logs against"
          emphasis
          icon={<TicketIcon size={13} />}
        />
        <StatTile label="Parks" value={parks} hint="Distinct park and country pairs" icon={<PinIcon size={13} />} />
        <StatTile
          label="Countries"
          value={new Set(list.map((c) => c.country)).size}
          hint={`${new Set(list.map((c) => c.manufacturer)).size} manufacturers`}
          icon={<GlobeIcon size={13} />}
        />
        <StatTile
          label="Listed riders"
          value={community?.riders ?? 0}
          hint="Users who opted into the leaderboard"
        />
      </section>

      <section className="card p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Catalogue completeness</h2>
          <span className="text-xs text-[var(--ink-3)]">
            {incomplete === 0 ? "Every field populated" : `${incomplete} gaps across all fields`}
          </span>
        </header>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {healthRows.map((row) => {
            const filled = list.length - row.missing;
            const pct = list.length === 0 ? 0 : (filled / list.length) * 100;
            return (
              <li key={row.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-[var(--ink-2)]">{row.label}</span>
                  <span className="tabular text-xs text-[var(--ink-3)]">
                    {filled}/{list.length}
                  </span>
                </div>
                <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
                  <div
                    className="h-full rounded-r-[3px] origin-left"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: row.missing === 0 ? "var(--good)" : "var(--data-2)",
                      animation: "grow-x 640ms var(--ease-out) both",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-[var(--ink-3)]">
          Missing measurements do not break anything — they are simply omitted from a coaster&apos;s
          detail card, and from the distance and height totals on every dashboard. Filling them in
          makes those numbers more accurate for everyone.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Catalogue by country"
          subtitle={`${new Set(list.map((c) => c.country)).size} countries`}
          items={tally(list.map((c) => c.country))}
          unit="coasters"
        />
        <BarList
          title="Catalogue by manufacturer"
          subtitle={`${new Set(list.map((c) => c.manufacturer)).size} manufacturers`}
          items={tally(list.map((c) => c.manufacturer))}
          unit="coasters"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Catalogue by decade opened"
          items={decades}
          limit={8}
          unit="coasters"
        />

        <div className="card p-5">
          <h3 className="text-sm font-semibold">Possible duplicates</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-2)]">
            Names that appear more than once. Shared names between parks are common and usually
            correct — this is a prompt to check, not an error.
          </p>

          {nameClashes.length === 0 ? (
            <p className="mt-4 flex items-center gap-1.5 text-sm" style={{ color: "var(--good)" }}>
              No repeated names in the catalogue.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {nameClashes.map((group) => (
                <li key={group[0].name}>
                  <p className="text-sm font-medium">{group[0].name}</p>
                  <ul className="mt-1 space-y-0.5">
                    {group.map((coaster) => (
                      <li key={coaster.id} className="text-xs text-[var(--ink-3)]">
                        {coaster.park} · {coaster.country}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          <Link href="/admin/catalogue" className="btn btn-quiet mt-5 w-full !text-[0.82rem]">
            Open the catalogue
            <ArrowRightIcon size={13} />
          </Link>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LockIcon size={14} />
          What this console deliberately cannot do
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--ink-2)]">
          <li>
            Read anyone&apos;s ride history. No policy grants an admin access to the rides table
            beyond their own rows, so there is no query this page could run to get it — including
            through the API explorer.
          </li>
          <li>
            See who is on the leaderboard beyond the public view, or who opted out. The counts above
            come from aggregates over opted-in users only.
          </li>
          <li>
            Promote another user to admin. Roles are granted directly in the database, on purpose:
            an admin account that can mint admins is a much larger blast radius than one that
            cannot.
          </li>
        </ul>
      </section>
    </div>
  );
}
