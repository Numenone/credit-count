import { getAuthedClient, fromPostgrest, apiError, unauthorised } from "@/lib/api";
import { COASTER_COLUMNS, type RideWithCoaster } from "@/lib/database.types";
import { csvCell } from "@/lib/csv";

/**
 * GET /api/v1/export?format=json|csv — take your data with you.
 *
 * Reads through the caller's own session, so it exports exactly what RLS lets
 * them see: their rides, and nothing of anyone else's. A product whose main
 * promise is "your history is private" should also make it portable — privacy
 * that traps your data is only half the promise.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return apiError("Bad request", 400, "format must be json or csv.");
  }

  const { data, error } = await supabase
    .from("rides")
    .select(`id, ridden_on, note, created_at, coaster:coasters(${COASTER_COLUMNS})`)
    .order("ridden_on", { ascending: false })
    .returns<RideWithCoaster[]>();

  if (error) return fromPostgrest(error);

  const rides = data ?? [];
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const headers = [
      "ridden_on", "coaster", "park", "city", "country", "manufacturer",
      "type", "height_m", "length_m", "speed_kmh", "inversions", "opened_year", "note",
    ];
    const rows = rides.map((ride) =>
      [
        ride.ridden_on, ride.coaster?.name, ride.coaster?.park, ride.coaster?.park_city,
        ride.coaster?.country, ride.coaster?.manufacturer, ride.coaster?.type,
        ride.coaster?.height_m, ride.coaster?.length_m, ride.coaster?.speed_kmh,
        ride.coaster?.inversions, ride.coaster?.opened_year, ride.note,
      ].map(csvCell).join(","),
    );

    return new Response([headers.join(","), ...rows].join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="credit-count-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(
    JSON.stringify({ exported_at: new Date().toISOString(), rides }, null, 2),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="credit-count-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
