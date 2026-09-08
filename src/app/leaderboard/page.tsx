import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { LeaderboardRow, RideWithCoaster } from "@/lib/database.types";
import { EmptyState } from "@/components/empty-state";
import { CountUp } from "@/components/count-up";
import { TrophyIcon, LockIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const session = await getSessionUser();

  // The `leaderboard` view is the only object in the schema that aggregates
  // across users. Visitors hit it with the anon key and get exactly these
  // columns, for opted-in users only; nothing else is reachable from here.
  const { data, error } = await supabase
    .from("leaderboard")
    .select("display_name, credits, rank")
    .order("credits", { ascending: false })
    .order("display_name")
    .limit(100)
    .returns<LeaderboardRow[]>();

  const rows = data ?? [];

  // "Your position" is derived from the signed-in user's OWN rides — which RLS
  // already lets them read — and then compared against the public credit counts.
  // Matching on display name would be wrong: names are not unique.
  let mine: { credits: number; rank: number } | null = null;
  if (session?.profile.leaderboard_opt_in) {
    const { data: ownRides } = await supabase
      .from("rides")
      .select("coaster_id")
      .returns<Pick<RideWithCoaster, "coaster_id">[]>();
    const credits = new Set((ownRides ?? []).map((r) => r.coaster_id)).size;
    mine = { credits, rank: rows.filter((r) => r.credits > credits).length + 1 };
  }

  // A podium needs three places to be a podium. With one or two opted-in users
  // it reads as a broken chart, so below three everyone goes in the table.
  const hasPodium = rows.length >= 3;
  const podium = hasPodium ? rows.slice(0, 3) : [];
  const rest = hasPodium ? rows.slice(3) : rows;

  // Indexed by finishing position, so first place is always the tallest block.
  const heights = ["h-28", "h-20", "h-14"];
  const order = [1, 0, 2]; // silver, gold, bronze — gold in the middle

  return (
    <div className="space-y-8">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)]">
            Opt-in only
          </p>
          <h1 className="display mt-1.5 text-3xl font-semibold sm:text-4xl">Leaderboard</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--ink-2)]">
            Enthusiasts who chose to be listed, ranked by credits. Everyone else stays private.
          </p>
        </div>

        {!session && (
          <Link href="/signup" className="btn btn-primary">
            <TrophyIcon size={14} />
            Join them
          </Link>
        )}
        {session && !session.profile.leaderboard_opt_in && (
          <Link href="/settings" className="btn btn-quiet">
            <LockIcon size={13} />
            You are not listed
          </Link>
        )}
      </header>

      {error && (
        <p role="alert" className="card px-4 py-3 text-sm" style={{ color: "var(--brand)" }}>
          The leaderboard could not be loaded right now.
        </p>
      )}

      {!error && rows.length === 0 && (
        <div className="card rise p-2">
          <EmptyState
            icon={<TrophyIcon size={18} />}
            title="Nobody has opted in yet"
            body="The leaderboard stays empty until someone chooses to appear on it. Turn on leaderboard visibility in Settings to be the first."
            action={
              <Link href={session ? "/settings" : "/signup"} className="btn btn-primary">
                {session ? "Open settings" : "Create an account"}
              </Link>
            }
          />
        </div>
      )}

      {podium.length > 0 && (
        <section aria-label="Top three" className="rise">
          <div className="card grid grid-cols-3 items-end gap-3 p-6 sm:gap-6 sm:p-8">
            {order.map((slot) => {
              const row = podium[slot];
              if (!row) return <div key={slot} />;
              return (
                <div key={slot} className="flex flex-col items-center text-center">
                  <span
                    className="tabular text-xs font-semibold"
                    style={{ color: slot === 0 ? "var(--brand)" : "var(--ink-3)" }}
                  >
                    #{row.rank}
                  </span>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold">{row.display_name}</p>
                  <p
                    className="display tabular mt-1.5 font-semibold"
                    style={{
                      fontSize: slot === 0 ? "2rem" : "1.5rem",
                      color: slot === 0 ? "var(--brand)" : "var(--ink)",
                    }}
                  >
                    <CountUp value={row.credits} />
                  </p>
                  <div
                    className={`mt-3 w-full rounded-t-lg ${heights[slot]}`}
                    style={{
                      // --surface-sunken sits a hair off the card in light mode,
                      // which made the runner-up blocks invisible. The runners-up
                      // need a fill that reads as a block, just quieter than first.
                      backgroundColor: slot === 0 ? "var(--brand)" : "var(--line-strong)",
                      transformOrigin: "bottom",
                      animation: `grow-y 620ms var(--ease-out) ${slot * 90}ms both`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="card overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Leaderboard positions four and below, by credit count
            </caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-3)]">
                <th scope="col" className="w-20 px-5 py-3 font-semibold">
                  Rank
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Enthusiast
                </th>
                <th scope="col" className="w-28 px-5 py-3 text-right font-semibold">
                  Credits
                </th>
              </tr>
            </thead>
            <tbody>
              {rest.map((row, i) => (
                <tr
                  key={`${row.display_name}-${i}`}
                  className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="tabular px-5 py-3 text-[var(--ink-3)]">{row.rank}</td>
                  <td className="px-5 py-3 font-medium">{row.display_name}</td>
                  <td className="tabular px-5 py-3 text-right font-semibold">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {mine && (
        <aside
          className="card flex flex-wrap items-center justify-between gap-3 border-[var(--brand-line)] px-5 py-4"
          style={{ backgroundColor: "var(--brand-soft)" }}
        >
          <p className="text-sm font-medium">
            You are ranked{" "}
            <span className="tabular font-semibold" style={{ color: "var(--brand)" }}>
              #{mine.rank}
            </span>{" "}
            with{" "}
            <span className="tabular font-semibold" style={{ color: "var(--brand)" }}>
              {mine.credits}
            </span>{" "}
            {mine.credits === 1 ? "credit" : "credits"}.
          </p>
          <Link href="/dashboard" className="btn btn-primary !py-1.5 !text-[0.82rem]">
            Log another
          </Link>
        </aside>
      )}

      <p className="text-xs leading-relaxed text-[var(--ink-3)]">
        Only display name and credit count appear here, and only for users who chose to be listed.
        Which coasters someone has ridden is never shown, to anyone. Display names are not unique,
        so two enthusiasts may share one — your own position above is worked out from your account,
        not from the name.
      </p>
    </div>
  );
}
