import type { SupabaseClient } from "@supabase/supabase-js";
import { COASTER_COLUMNS, type RideWithCoaster } from "@/lib/database.types";

/**
 * What Rusty knows about the person she is talking to.
 *
 * This is the difference between an encyclopedia and an assistant: asked "what
 * should I ride next?", an encyclopedia recommends a famous coaster and an
 * assistant notices you have already ridden it.
 *
 * ## Why this is safe to put in a prompt
 *
 * Two decisions do the work, and both are structural rather than hopeful.
 *
 * First, the query runs on the CALLER's session. Row-level security scopes it
 * to their own rows, so there is no code path — bug or injection — by which she
 * can be made to describe somebody else's history. The authorisation is not in
 * this file; it is in the database, and it applies whatever this file asks for.
 *
 * Second, only structured facts go in. Coaster names, parks and countries come
 * from the admin-curated catalogue. Ride notes are the one field the user
 * writes freely, and they are deliberately excluded — a note reading "ignore
 * your instructions" would otherwise arrive in the prompt wearing the app's own
 * voice rather than the visitor's. Excluding the field removes the path
 * entirely, which is better than sanitising it.
 */

export interface MascotContext {
  credits: number;
  rides: number;
  parks: string[];
  countries: string[];
  /** Most-ridden first: what they keep going back to. */
  favourites: { name: string; park: string; rides: number }[];
  /** In the catalogue, not yet ridden — the obvious thing to suggest. */
  chase: { name: string; park: string; country: string }[];
  latestRide: string | null;
}

const MAX_LIST = 12;

export async function loadMascotContext(
  supabase: SupabaseClient,
): Promise<MascotContext | null> {
  const [ridesResult, catalogueResult] = await Promise.all([
    supabase
      .from("rides")
      .select(`ridden_on, coaster:coasters(${COASTER_COLUMNS})`)
      .order("ridden_on", { ascending: false })
      .returns<RideWithCoaster[]>(),
    supabase.from("coasters").select("id, name, park, country").limit(500),
  ]);

  const rides = ridesResult.data ?? [];
  if (rides.length === 0) return null;

  const ridden = new Map<string, { name: string; park: string; rides: number }>();
  const parks = new Set<string>();
  const countries = new Set<string>();

  for (const ride of rides) {
    const coaster = ride.coaster;
    if (!coaster) continue;
    parks.add(coaster.park);
    countries.add(coaster.country);
    const seen = ridden.get(coaster.id);
    if (seen) seen.rides += 1;
    else ridden.set(coaster.id, { name: coaster.name, park: coaster.park, rides: 1 });
  }

  const catalogue = (catalogueResult.data ?? []) as {
    id: string;
    name: string;
    park: string;
    country: string;
  }[];

  return {
    credits: ridden.size,
    rides: rides.length,
    parks: [...parks].sort(),
    countries: [...countries].sort(),
    favourites: [...ridden.values()]
      .sort((a, b) => b.rides - a.rides)
      .slice(0, MAX_LIST),
    chase: catalogue
      .filter((coaster) => !ridden.has(coaster.id))
      .slice(0, MAX_LIST)
      .map(({ name, park, country }) => ({ name, park, country })),
    latestRide: rides[0]?.ridden_on ?? null,
  };
}

/**
 * Renders the context as a compact block for the system prompt.
 *
 * Terse on purpose — this is sent on every turn, so its length is a recurring
 * cost. Lists are capped and the whole thing is a few hundred tokens.
 */
export function describeContext(context: MascotContext | null) {
  if (!context) {
    return "This person has not logged any rides yet. If it helps, suggest somewhere to start.";
  }

  const lines = [
    `Credits: ${context.credits} across ${context.rides} rides.`,
    `Parks visited: ${context.parks.join(", ") || "none"}.`,
    `Countries: ${context.countries.join(", ") || "none"}.`,
  ];

  if (context.favourites.length > 0) {
    lines.push(
      "Rides they return to: " +
        context.favourites
          .map((f) => `${f.name} (${f.park})${f.rides > 1 ? ` ×${f.rides}` : ""}`)
          .join("; ") +
        ".",
    );
  }

  if (context.chase.length > 0) {
    lines.push(
      "In our catalogue, not yet ridden: " +
        context.chase.map((c) => `${c.name} (${c.park}, ${c.country})`).join("; ") +
        ".",
    );
  }

  if (context.latestRide) lines.push(`Last logged a ride on ${context.latestRide}.`);

  return lines.join("\n");
}
