import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { LeaderboardRow } from "@/lib/database.types";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const session = await getSessionUser();

  // Reads the `leaderboard` view, which is the only object in the schema that
  // aggregates across users. Visitors hit it with the anon key and get exactly
  // these two columns for opted-in users; nothing else is reachable.
  const { data, error } = await supabase
    .from("leaderboard")
    .select("display_name, credits, rank")
    .order("credits", { ascending: false })
    .order("display_name")
    .limit(100)
    .returns<LeaderboardRow[]>();

  const rows = data ?? [];

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
            Enthusiasts who have opted in, ranked by credits.
          </p>
        </div>
        {!session && (
          <Link href="/signup" className="btn btn-primary">
            Join them
          </Link>
        )}
      </div>

      {error && (
        <p className="mt-6 text-sm text-[var(--color-accent)]">
          The leaderboard could not be loaded right now.
        </p>
      )}

      {!error && rows.length === 0 && (
        <div className="card mt-6 p-8 text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Nobody has opted in yet. Turn on leaderboard visibility in Settings to be the first.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                <th className="w-16 px-5 py-3 font-semibold">Rank</th>
                <th className="px-5 py-3 font-semibold">Enthusiast</th>
                <th className="w-28 px-5 py-3 text-right font-semibold">Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.display_name}-${i}`}
                  className="border-b border-[var(--color-line)] last:border-0"
                >
                  <td className="tabular px-5 py-3 text-[var(--color-ink-faint)]">{row.rank}</td>
                  <td className="px-5 py-3 font-medium">{row.display_name}</td>
                  <td className="tabular px-5 py-3 text-right font-semibold">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[var(--color-ink-faint)]">
        Only display name and credit count appear here, and only for users who chose to be listed.
        Which coasters someone has ridden is never shown. Display names are not unique, so two
        enthusiasts may share one.
      </p>
    </div>
  );
}
