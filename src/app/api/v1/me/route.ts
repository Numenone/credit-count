import { z } from "zod";
import { apiError, fromPostgrest, json, readJson, requireProfile, unauthorised } from "@/lib/api";
import type { Profile } from "@/lib/database.types";

const patchInput = z
  .object({
    display_name: z.string().trim().min(2).max(40),
    leaderboard_opt_in: z.boolean(),
    unit_system: z.enum(["metric", "imperial"]),
  })
  .partial();

export async function GET() {
  const { user, profile } = await requireProfile();
  if (!user) return unauthorised();
  return json({ data: { email: user.email, ...profile } });
}

/**
 * PATCH /api/v1/me — your own profile.
 *
 * `role` is not in the schema above, and adding it would not help: the
 * `authenticated` database role holds column-level UPDATE on display_name,
 * leaderboard_opt_in and unit_system only, so a request naming any other column
 * is refused by Postgres before a policy is even consulted.
 */
export async function PATCH(request: Request) {
  const { supabase, user } = await requireProfile();
  if (!user) return unauthorised();

  const body = await readJson(request);
  if (!body) return apiError("Bad request", 400, "Body must be a JSON object.");

  const parsed = patchInput.safeParse(body);
  if (!parsed.success) return apiError("Unprocessable entity", 422, parsed.error.issues[0].message);
  if (Object.keys(parsed.data).length === 0) {
    return apiError("Unprocessable entity", 422, "Nothing to update.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("*")
    .maybeSingle<Profile>();

  if (error) return fromPostgrest(error);
  return json({ data });
}
