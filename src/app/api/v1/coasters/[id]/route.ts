import { z } from "zod";
import { apiError, fromPostgrest, getAuthedClient, json, readJson, unauthorised } from "@/lib/api";
import { COASTER_COLUMNS, type Coaster } from "@/lib/database.types";

const patchInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    park: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(60),
    manufacturer: z.string().trim().min(1).max(80),
    type: z.enum(["Steel", "Wooden", "Hybrid"]),
    height_m: z.number().positive().max(999).nullable(),
    length_m: z.number().positive().max(99999).nullable(),
    speed_kmh: z.number().positive().max(999).nullable(),
    inversions: z.number().int().min(0).max(99).nullable(),
    opened_year: z.number().int().min(1884).max(2100).nullable(),
    park_city: z.string().trim().max(120).nullable(),
    park_url: z.url().startsWith("https://").nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .partial();

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: RouteContext<"/api/v1/coasters/[id]">) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("Bad request", 400, "id must be a UUID.");

  const { data, error } = await supabase
    .from("coasters")
    .select(COASTER_COLUMNS)
    .eq("id", id)
    .maybeSingle<Coaster>();

  if (error) return fromPostgrest(error);
  if (!data) return apiError("Not found", 404, "No coaster with that id.");
  return json({ data });
}

/** Admin only, enforced by the RLS policy rather than by a check here. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/v1/coasters/[id]">) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("Bad request", 400, "id must be a UUID.");

  const body = await readJson(request);
  if (!body) return apiError("Bad request", 400, "Body must be a JSON object.");

  const parsed = patchInput.safeParse(body);
  if (!parsed.success) return apiError("Unprocessable entity", 422, parsed.error.issues[0].message);
  if (Object.keys(parsed.data).length === 0) {
    return apiError("Unprocessable entity", 422, "Nothing to update.");
  }

  const { data, error } = await supabase
    .from("coasters")
    .update(parsed.data)
    .eq("id", id)
    .select(COASTER_COLUMNS)
    .maybeSingle<Coaster>();

  if (error) return fromPostgrest(error);
  // An enthusiast's UPDATE matches no rows rather than erroring, so "no row came
  // back" is the RLS refusal, not a missing record.
  if (!data) return apiError("Forbidden", 403, "Not permitted, or no coaster with that id.");
  return json({ data });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/v1/coasters/[id]">) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("Bad request", 400, "id must be a UUID.");

  const { error, count } = await supabase
    .from("coasters")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return fromPostgrest(error);
  if (!count) return apiError("Forbidden", 403, "Not permitted, or no coaster with that id.");
  return json({ data: { id, deleted: true } });
}
