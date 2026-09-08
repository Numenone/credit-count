import type { RideWithCoaster } from "@/lib/database.types";

export interface Breakdown {
  label: string;
  credits: number;
  rides: number;
}

export interface RiddenCoaster {
  id: string;
  name: string;
  park: string;
  country: string;
  rides: number;
}

export interface Stats {
  /** Unique coasters ridden at least once — the headline number. */
  credits: number;
  /** Every logged ride, including repeats on the same coaster. */
  rides: number;
  parks: number;
  countries: number;
  manufacturers: number;
  /** Rides per credit. 1.0 means never a repeat; higher means a loyal rider. */
  repeatRatio: number;
  /** Credits ridden more than once. */
  reRidden: number;

  byCountry: Breakdown[];
  byManufacturer: Breakdown[];
  byType: Breakdown[];

  topCoasters: RiddenCoaster[];
  mostRidden: RiddenCoaster | null;

  /** Track metres covered: each coaster's length counted once per ride taken. */
  distanceM: number;
  /** Lift-hill metres climbed: each coaster's height counted once per ride. */
  verticalM: number;
  /** Inversions gone through, counted per ride rather than per credit. */
  inversions: number;
  fastest: { name: string; speedKmh: number } | null;
  tallest: { name: string; heightM: number } | null;
  /** Oldest and newest coaster in the collection, by opening year. */
  oldest: { name: string; year: number } | null;
  newest: { name: string; year: number } | null;

  firstRide: string | null;
  latestRide: string | null;
  /** ISO date -> ride count, for the activity heatmap. */
  activity: Record<string, number>;
  busiestDay: { date: string; rides: number } | null;
  busiestMonth: { month: string; rides: number } | null;
  /** Distinct calendar days with at least one ride. */
  ridingDays: number;
}

const EMPTY: Stats = {
  credits: 0,
  rides: 0,
  parks: 0,
  countries: 0,
  manufacturers: 0,
  repeatRatio: 0,
  reRidden: 0,
  byCountry: [],
  byManufacturer: [],
  byType: [],
  topCoasters: [],
  mostRidden: null,
  distanceM: 0,
  verticalM: 0,
  inversions: 0,
  fastest: null,
  tallest: null,
  oldest: null,
  newest: null,
  firstRide: null,
  latestRide: null,
  activity: {},
  busiestDay: null,
  busiestMonth: null,
  ridingDays: 0,
};

/**
 * Derives every dashboard number from the user's ride rows.
 *
 * Deliberately computed from the ride history rather than stored as counters:
 * there is no denormalised total to drift out of sync, so editing or deleting a
 * ride is automatically reflected with no refresh step (SOW 5.5).
 */
export function computeStats(rides: RideWithCoaster[]): Stats {
  const usable = rides.filter((r) => r.coaster);
  if (usable.length === 0) return EMPTY;

  const ridesPerCoaster = new Map<string, number>();
  const parks = new Set<string>();
  const countries = new Set<string>();
  const manufacturers = new Set<string>();
  const activity: Record<string, number> = {};
  const perMonth = new Map<string, number>();

  // A credit counts once per coaster, so each breakdown is keyed by the set of
  // distinct coasters, not by the number of rides. Ride totals are tracked
  // alongside so a bar can show both without a second pass.
  const country = new Map<string, { credits: Set<string>; rides: number }>();
  const manufacturer = new Map<string, { credits: Set<string>; rides: number }>();
  const type = new Map<string, { credits: Set<string>; rides: number }>();

  const bump = (
    map: Map<string, { credits: Set<string>; rides: number }>,
    key: string,
    coasterId: string,
  ) => {
    const bucket = map.get(key) ?? { credits: new Set<string>(), rides: 0 };
    bucket.credits.add(coasterId);
    bucket.rides += 1;
    map.set(key, bucket);
  };

  // Physical totals accumulate per RIDE, not per credit: riding Nemesis three
  // times really is three laps of track, even though it is still one credit.
  let distanceM = 0;
  let verticalM = 0;
  let inversions = 0;
  let fastest: Stats["fastest"] = null;
  let tallest: Stats["tallest"] = null;
  let oldest: Stats["oldest"] = null;
  let newest: Stats["newest"] = null;

  for (const ride of usable) {
    const c = ride.coaster;
    ridesPerCoaster.set(c.id, (ridesPerCoaster.get(c.id) ?? 0) + 1);

    if (c.length_m != null) distanceM += Number(c.length_m);
    if (c.height_m != null) verticalM += Number(c.height_m);
    if (c.inversions != null) inversions += c.inversions;

    const speed = c.speed_kmh == null ? null : Number(c.speed_kmh);
    if (speed != null && (!fastest || speed > fastest.speedKmh)) {
      fastest = { name: c.name, speedKmh: speed };
    }
    const height = c.height_m == null ? null : Number(c.height_m);
    if (height != null && (!tallest || height > tallest.heightM)) {
      tallest = { name: c.name, heightM: height };
    }
    if (c.opened_year != null) {
      if (!oldest || c.opened_year < oldest.year) oldest = { name: c.name, year: c.opened_year };
      if (!newest || c.opened_year > newest.year) newest = { name: c.name, year: c.opened_year };
    }
    parks.add(`${c.park}|${c.country}`);
    countries.add(c.country);
    manufacturers.add(c.manufacturer);

    activity[ride.ridden_on] = (activity[ride.ridden_on] ?? 0) + 1;
    const month = ride.ridden_on.slice(0, 7);
    perMonth.set(month, (perMonth.get(month) ?? 0) + 1);

    bump(country, c.country, c.id);
    bump(manufacturer, c.manufacturer, c.id);
    bump(type, c.type, c.id);
  }

  const toBreakdown = (
    map: Map<string, { credits: Set<string>; rides: number }>,
  ): Breakdown[] =>
    [...map.entries()]
      .map(([label, v]) => ({ label, credits: v.credits.size, rides: v.rides }))
      .sort((a, b) => b.credits - a.credits || a.label.localeCompare(b.label));

  // One entry per distinct coaster, ranked by how often it was ridden.
  const coasterById = new Map(usable.map((r) => [r.coaster.id, r.coaster]));
  const ranked: RiddenCoaster[] = [...ridesPerCoaster.entries()]
    .map(([id, count]) => {
      const c = coasterById.get(id)!;
      return { id, name: c.name, park: c.park, country: c.country, rides: count };
    })
    .sort((a, b) => b.rides - a.rides || a.name.localeCompare(b.name));

  const dates = usable.map((r) => r.ridden_on).sort();

  let busiestDay: Stats["busiestDay"] = null;
  for (const [date, count] of Object.entries(activity)) {
    if (!busiestDay || count > busiestDay.rides) busiestDay = { date, rides: count };
  }

  let busiestMonth: Stats["busiestMonth"] = null;
  for (const [month, count] of perMonth) {
    if (!busiestMonth || count > busiestMonth.rides) busiestMonth = { month, rides: count };
  }

  const credits = ridesPerCoaster.size;

  return {
    credits,
    rides: usable.length,
    parks: parks.size,
    countries: countries.size,
    manufacturers: manufacturers.size,
    repeatRatio: credits === 0 ? 0 : usable.length / credits,
    reRidden: [...ridesPerCoaster.values()].filter((n) => n > 1).length,
    byCountry: toBreakdown(country),
    byManufacturer: toBreakdown(manufacturer),
    byType: toBreakdown(type),
    topCoasters: ranked.slice(0, 5),
    mostRidden: ranked[0] ?? null,
    distanceM,
    verticalM,
    inversions,
    fastest,
    tallest,
    oldest,
    newest,
    firstRide: dates[0] ?? null,
    latestRide: dates[dates.length - 1] ?? null,
    activity,
    busiestDay,
    busiestMonth,
    ridingDays: Object.keys(activity).length,
  };
}

/* ------------------------------------------------------------ milestones -- */

export interface Milestone {
  id: string;
  label: string;
  detail: string;
  earned: boolean;
  /** 0–1 progress towards earning it, for the ones that are counted. */
  progress: number;
}

/**
 * Milestones are read off the same derived stats — nothing is stored, so they
 * cannot disagree with the dashboard above them. Each one names what it wants,
 * so an unearned milestone doubles as a suggestion for where to ride next.
 */
export function computeMilestones(stats: Stats): Milestone[] {
  const counted = (
    id: string,
    label: string,
    detail: string,
    value: number,
    target: number,
  ): Milestone => ({
    id,
    label,
    detail,
    earned: value >= target,
    progress: Math.min(1, target === 0 ? 1 : value / target),
  });

  return [
    counted("first", "First credit", "Log your first ride", stats.credits, 1),
    counted("ten", "Double figures", "Reach 10 credits", stats.credits, 10),
    counted("quarter", "Twenty-five", "Reach 25 credits", stats.credits, 25),
    counted("fifty", "Half century", "Reach 50 credits", stats.credits, 50),
    counted("passport", "Passport", "Ride in 3 different countries", stats.countries, 3),
    counted("grand-tour", "Grand tour", "Ride in 6 different countries", stats.countries, 6),
    counted(
      "materials",
      "All three materials",
      "Ride a steel, a wooden and a hybrid coaster",
      stats.byType.length,
      3,
    ),
    counted("regular", "Regular", "Ride the same coaster 3 times", stats.mostRidden?.rides ?? 0, 3),
    counted("collector", "Collector", "Visit 10 different parks", stats.parks, 10),
    counted("marathon", "Marathon", "Cover 25 km of track", stats.distanceM, 25_000),
    counted("skyward", "Skyward", "Climb 1 km of lift hill", stats.verticalM, 1_000),
    counted("upside-down", "Upside down", "Go through 25 inversions", stats.inversions, 25),
    counted(
      "engineer",
      "Spotter",
      "Ride coasters from 5 manufacturers",
      stats.manufacturers,
      5,
    ),
  ];
}
