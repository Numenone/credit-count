import { z } from "zod";
import { apiError, fromPostgrest, getAuthedClient, json, readJson, unauthorised } from "@/lib/api";
import { COASTER_COLUMNS, type RideWithCoaster } from "@/lib/database.types";

const rideInput = z.object({
  coaster_id: z.uuid(),
  ridden_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ridden_on must be YYYY-MM-DD"),
  note: z.string().trim().max(280).nullish(),
});

/**
 * GET /api/v1/rides — the caller's own rides.
 *
 * No user_id filter is applied, and none is accepted. RLS scopes the result to
 * the caller, so passing someone else's id would change nothing: this endpoint
 * physically cannot return another user's history.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  const { data, error, count } = await supabase
    .from("rides")
    .select(`id, coaster_id, ridden_on, note, created_at, user_id, coaster:coasters(${COASTER_COLUMNS})`, {
      count: "exact",
    })
    .order("ridden_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<RideWithCoaster[]>();

  if (error) return fromPostgrest(error);
  return json({ data, meta: { total: count ?? 0, limit, offset } });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const body = await readJson(request);
  if (!body) return apiError("Bad request", 400, "Body must be a JSON object.");

  const parsed = rideInput.safeParse(body);
  if (!parsed.success) return apiError("Unprocessable entity", 422, parsed.error.issues[0].message);

  // user_id is deliberately not taken from the body. It defaults to auth.uid()
  // in the schema, and the RLS insert policy requires it to match the caller.
  const { data, error } = await supabase
    .from("rides")
    .insert({
      coaster_id: parsed.data.coaster_id,
      ridden_on: parsed.data.ridden_on,
      note: parsed.data.note || null,
    })
    .select("id, coaster_id, ridden_on, note, created_at, user_id")
    .single();

  if (error) return fromPostgrest(error);
  return json({ data }, 201);
}
