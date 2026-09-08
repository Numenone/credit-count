import { getAuthedClient, fromPostgrest, json, unauthorised } from "@/lib/api";
import { computeStats, computeMilestones } from "@/lib/stats";
import { COASTER_COLUMNS, type RideWithCoaster } from "@/lib/database.types";

/**
 * GET /api/v1/stats — your dashboard numbers, as data.
 *
 * Derived from the caller's own rides on every request, exactly like the
 * dashboard page. Same input, same function, so the API and the UI cannot
 * disagree about what a credit is.
 */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const { data, error } = await supabase
    .from("rides")
    .select(`id, coaster_id, ridden_on, note, created_at, user_id, coaster:coasters(${COASTER_COLUMNS})`)
    .order("ridden_on", { ascending: false })
    .returns<RideWithCoaster[]>();

  if (error) return fromPostgrest(error);

  const stats = computeStats(data ?? []);
  return json({
    data: {
      ...stats,
      // The heatmap map is large and rarely wanted from the API; the totals are.
      activity: undefined,
      milestones: computeMilestones(stats).filter((m) => m.earned).map((m) => m.id),
    },
  });
}
