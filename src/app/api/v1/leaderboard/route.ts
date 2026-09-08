import { createClient } from "@/lib/supabase/server";
import { fromPostgrest, json } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/database.types";

/**
 * GET /api/v1/leaderboard — the only public endpoint.
 *
 * Reads the `leaderboard` view, whose projection is fixed at display name,
 * credit count and rank for opted-in users. There is no parameter here that
 * could widen it, because the view has no other columns to widen to.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));

  const { data, error } = await supabase
    .from("leaderboard")
    .select("display_name, credits, rank")
    .order("credits", { ascending: false })
    .order("display_name")
    .limit(limit)
    .returns<LeaderboardRow[]>();

  if (error) return fromPostgrest(error);
  return json({ data, meta: { limit, public: true } });
}
