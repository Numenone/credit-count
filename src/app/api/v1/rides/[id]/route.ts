import { z } from "zod";
import { apiError, fromPostgrest, getAuthedClient, json, readJson, unauthorised } from "@/lib/api";

const patchInput = z
  .object({
    coaster_id: z.uuid(),
    ridden_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ridden_on must be YYYY-MM-DD"),
    note: z.string().trim().max(280).nullable(),
  })
  .partial();

const idSchema = z.uuid();

/**
 * PATCH /api/v1/rides/[id] — edit your own ride.
 *
 * A ride belonging to someone else matches zero rows under the RLS update
 * policy, so the 403 below is the database's answer, not a check written here.
 */
export async function PATCH(request: Request, { params }: RouteContext<"/api/v1/rides/[id]">) {
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
    .from("rides")
    .update(parsed.data)
    .eq("id", id)
    .select("id, coaster_id, ridden_on, note, created_at, user_id")
    .maybeSingle();

  if (error) return fromPostgrest(error);
  if (!data) return apiError("Forbidden", 403, "Not your ride, or no ride with that id.");
  return json({ data });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/v1/rides/[id]">) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError("Bad request", 400, "id must be a UUID.");

  const { error, count } = await supabase.from("rides").delete({ count: "exact" }).eq("id", id);

  if (error) return fromPostgrest(error);
  if (!count) return apiError("Forbidden", 403, "Not your ride, or no ride with that id.");
  return json({ data: { id, deleted: true } });
}
