import { z } from "zod";
import {
  apiError,
  fromPostgrest,
  getAuthedClient,
  json,
  readJson,
  unauthorised,
} from "@/lib/api";
import { COASTER_COLUMNS, type Coaster } from "@/lib/database.types";

const coasterInput = z.object({
  name: z.string().trim().min(1).max(120),
  park: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(60),
  manufacturer: z.string().trim().min(1).max(80),
  type: z.enum(["Steel", "Wooden", "Hybrid"]),
  height_m: z.number().positive().max(999).nullish(),
  length_m: z.number().positive().max(99999).nullish(),
  speed_kmh: z.number().positive().max(999).nullish(),
  inversions: z.number().int().min(0).max(99).nullish(),
  opened_year: z.number().int().min(1884).max(2100).nullish(),
  park_city: z.string().trim().max(120).nullish(),
  park_url: z.url().startsWith("https://").nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
});

/** Bound parameter downstream, so this only caps the length. */
function sanitise(raw: string) {
  return raw.trim().slice(0, 60);
}

/** GET /api/v1/coasters — the shared catalogue. Any signed-in user may read it. */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const url = new URL(request.url);
  const q = sanitise(url.searchParams.get("q") ?? "");
  const country = url.searchParams.get("country");
  const type = url.searchParams.get("type");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  // Free-text search runs through search_coasters(), which binds the term rather
  // than interpolating it. country and type are exact-match filters, passed as
  // values by supabase-js, so neither is a string-building surface either.
  if (q) {
    // No .returns<Coaster[]>() here: supabase-js types rpc() as returning a
    // single value and rejects an array cast, so the shape is asserted after.
    const { data, error } = await supabase.rpc("search_coasters", {
      term: q,
      max_results: 200,
    });

    if (error) return fromPostgrest(error);

    const rows = (data ?? []) as Coaster[];
    const filtered = rows.filter(
      (c) => (!country || c.country === country) && (!type || c.type === type),
    );
    return json({
      data: filtered.slice(offset, offset + limit),
      meta: { total: filtered.length, limit, offset },
    });
  }

  let query = supabase.from("coasters").select(COASTER_COLUMNS, { count: "exact" });
  if (country) query = query.eq("country", country);
  if (type) query = query.eq("type", type);

  const { data, error, count } = await query
    .order("name")
    .range(offset, offset + limit - 1)
    .returns<Coaster[]>();

  if (error) return fromPostgrest(error);
  return json({ data, meta: { total: count ?? 0, limit, offset } });
}

/**
 * POST /api/v1/coasters — admin only.
 *
 * There is no role check in this handler on purpose. The "coasters: admin insert"
 * RLS policy is the only thing that decides, so calling this endpoint directly as
 * an enthusiast fails for exactly the same reason the UI button would.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const body = await readJson(request);
  if (!body) return apiError("Bad request", 400, "Body must be a JSON object.");

  const parsed = coasterInput.safeParse(body);
  if (!parsed.success) {
    return apiError("Unprocessable entity", 422, parsed.error.issues[0].message);
  }

  const { data, error } = await supabase
    .from("coasters")
    .insert(parsed.data)
    .select(COASTER_COLUMNS)
    .single<Coaster>();

  if (error) return fromPostgrest(error);
  return json({ data }, 201);
}
