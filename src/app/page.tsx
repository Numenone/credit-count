import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  if (await getSessionUser()) redirect("/dashboard");

  const supabase = await createClient();
  const { count } = await supabase
    .from("leaderboard")
    .select("display_name", { count: "exact", head: true });

  return (
    <div className="py-8">
      <section className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          For rollercoaster enthusiasts
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Every credit, in one place.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--color-ink-soft)]">
          A credit is a coaster you have ridden at least once. Log every ride against a shared
          catalogue, watch your credit count climb, and break your riding down by country,
          manufacturer and type.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-primary">
            Start counting
          </Link>
          <Link href="/leaderboard" className="btn btn-quiet">
            View the leaderboard
            {typeof count === "number" && count > 0 && (
              <span className="tabular text-[var(--color-ink-faint)]">({count})</span>
            )}
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Rides and credits, counted separately",
            body: "Re-riding a favourite adds to your ride total without inflating your credit count. Both numbers are always on your dashboard.",
          },
          {
            title: "Private by default",
            body: "Your ride history and notes are yours alone. Appearing on the leaderboard is opt-in, and it only ever shows a name and a number.",
          },
          {
            title: "One shared catalogue",
            body: "Everyone logs against the same curated coaster list, so credit counts actually mean the same thing between users.",
          },
        ].map((item) => (
          <div key={item.title} className="card p-5">
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
