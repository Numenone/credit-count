import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { LeaderboardRow, RideWithCoaster } from "@/lib/database.types";
import { EmptyState } from "@/components/empty-state";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { Avatar, LeaderboardTable } from "@/components/leaderboard-table";
import { TrophyIcon, LockIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Leaderboard" };

/** Podium furniture, indexed by finishing position. */
const PODIUM = [
  { height: "h-28", medal: "#c9971f", label: "1st" },
  { height: "h-20", medal: "#9aa2ad", label: "2nd" },
  { height: "h-14", medal: "#a9744a", label: "3rd" },
];

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
  const topCredits = rows[0]?.credits ?? 0;
  const totalCredits = rows.reduce((sum, row) => sum + row.credits, 0);

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

      {rows.length > 0 && (
        <section className="rise grid gap-4 sm:grid-cols-3">
          {[
            { label: "Enthusiasts listed", value: rows.length },
            { label: "Credits between them", value: totalCredits },
            { label: "Leader", value: topCredits },
          ].map((item) => (
            <div key={item.label} className="card px-5 py-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                {item.label}
              </p>
              <p className="display tabular mt-1.5 text-2xl font-semibold">
                <CountUp value={item.value} />
              </p>
            </div>
          ))}
        </section>
      )}

      {podium.length > 0 && (
        <Reveal>
          <section aria-label="Top three" className="card overflow-hidden">
            <div className="grid grid-cols-3 items-end gap-3 px-6 pt-8 sm:gap-8 sm:px-10">
              {order.map((slot) => {
                const row = podium[slot];
                if (!row) return <div key={slot} />;
                const style = PODIUM[slot];
                return (
                  <div key={slot} className="flex flex-col items-center text-center">
                    <span
                      className="mb-2 grid h-6 w-6 place-items-center rounded-full text-[0.6rem] font-bold"
                      style={{ backgroundColor: style.medal, color: "#1a1508" }}
                      aria-hidden
                    >
                      {slot + 1}
                    </span>

                    <Avatar name={row.display_name} size={slot === 0 ? 48 : 38} />

                    <p className="mt-2 line-clamp-2 text-sm font-semibold">{row.display_name}</p>
                    <p className="sr-only">{style.label} place</p>

                    <p
                      className="display tabular mt-1 font-semibold"
                      style={{
                        fontSize: slot === 0 ? "2.25rem" : "1.6rem",
                        color: slot === 0 ? "var(--brand)" : "var(--ink)",
                      }}
                    >
                      <CountUp value={row.credits} />
                    </p>
                    <p className="text-[0.7rem] uppercase tracking-wide text-[var(--ink-3)]">
                      credits
                    </p>

                    <div
                      className={`mt-4 w-full rounded-t-lg ${style.height}`}
                      style={{
                        backgroundColor: slot === 0 ? "var(--brand)" : "var(--line-strong)",
                        transformOrigin: "bottom",
                        animation: `grow-y 640ms var(--ease-out) ${slot * 110}ms both`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>
      )}

      {rest.length > 0 && (
        <Reveal>
          <LeaderboardTable rows={rest} topCredits={topCredits} />
        </Reveal>
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
            {mine.rank > 1 && topCredits > mine.credits && (
              <> {topCredits - mine.credits} more would take the lead.</>
            )}
          </p>
          <Link href="/chase" className="btn btn-primary !py-1.5 !text-[0.82rem]">
            Find your next credit
            <ArrowRightIcon size={13} />
          </Link>
        </aside>
      )}

      <p className="text-xs leading-relaxed text-[var(--ink-3)]">
        Only display name and credit count appear here, and only for users who chose to be listed.
        Which coasters someone has ridden is never shown, to anyone. The badge colours are derived
        from the display name and mean nothing. Display names are not unique, so two enthusiasts may
        share one — your own position above is worked out from your account, not from the name.
      </p>
    </div>
  );
}
