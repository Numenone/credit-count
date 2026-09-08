import type { RideWithCoaster } from "@/lib/database.types";

export interface Breakdown {
  label: string;
  credits: number;
}

export interface Stats {
  /** Unique coasters ridden at least once — the headline number. */
  credits: number;
  /** Every logged ride, including repeats on the same coaster. */
  rides: number;
  byCountry: Breakdown[];
  byManufacturer: Breakdown[];
  byType: Breakdown[];
  mostRidden: { name: string; park: string; rides: number } | null;
  /** Distinct parks visited — cheap to derive, nice to show. */
  parks: number;
}

/**
 * Derives every dashboard number from the user's ride rows.
 *
 * Deliberately computed from the ride history rather than stored as counters:
 * there is no denormalised total to drift out of sync, so editing or deleting a
 * ride is automatically reflected with no refresh step (SOW 5.5).
 */
export function computeStats(rides: RideWithCoaster[]): Stats {
  const creditedCoasters = new Set<string>();
  const ridesPerCoaster = new Map<string, number>();
  const parks = new Set<string>();

  // A credit counts once per coaster, so each breakdown is keyed by the set of
  // distinct coasters, not by the number of rides.
  const country = new Map<string, Set<string>>();
  const manufacturer = new Map<string, Set<string>>();
  const type = new Map<string, Set<string>>();

  const add = (map: Map<string, Set<string>>, key: string, coasterId: string) => {
    const bucket = map.get(key) ?? new Set<string>();
    bucket.add(coasterId);
    map.set(key, bucket);
  };

  for (const ride of rides) {
    if (!ride.coaster) continue;
    const id = ride.coaster.id;
    creditedCoasters.add(id);
    ridesPerCoaster.set(id, (ridesPerCoaster.get(id) ?? 0) + 1);
    parks.add(`${ride.coaster.park}|${ride.coaster.country}`);
    add(country, ride.coaster.country, id);
    add(manufacturer, ride.coaster.manufacturer, id);
    add(type, ride.coaster.type, id);
  }

  const toBreakdown = (map: Map<string, Set<string>>): Breakdown[] =>
    [...map.entries()]
      .map(([label, ids]) => ({ label, credits: ids.size }))
      .sort((a, b) => b.credits - a.credits || a.label.localeCompare(b.label));

  let mostRidden: Stats["mostRidden"] = null;
  let best = 0;
  for (const [coasterId, count] of ridesPerCoaster) {
    // Ties resolve to the first coaster encountered; with equal counts either is
    // an honest answer, and picking one keeps the dashboard readable.
    if (count > best) {
      const coaster = rides.find((r) => r.coaster?.id === coasterId)!.coaster;
      mostRidden = { name: coaster.name, park: coaster.park, rides: count };
      best = count;
    }
  }

  return {
    credits: creditedCoasters.size,
    rides: rides.length,
    parks: parks.size,
    byCountry: toBreakdown(country),
    byManufacturer: toBreakdown(manufacturer),
    byType: toBreakdown(type),
    mostRidden,
  };
}
