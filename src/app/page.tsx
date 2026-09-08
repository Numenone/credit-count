import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CountUp } from "@/components/count-up";
import { TicketIcon, LockIcon, GlobeIcon, ArrowRightIcon } from "@/components/icons";

interface CommunityStats {
  riders: number;
  rides: number;
  coasters_ridden: number;
  countries: number;
}

interface CatalogueStats {
  coasters: number;
  parks: number;
  countries: number;
  manufacturers: number;
}

export default async function HomePage() {
  if (await getSessionUser()) redirect("/dashboard");

  const supabase = await createClient();

  // Both views are aggregate-only and readable by anon. `community_stats`
  // counts opted-in users exclusively, so a visitor's view of "the community"
  // is built entirely from people who consented to be counted publicly.
  const [{ data: community }, { data: catalogue }] = await Promise.all([
    supabase.from("community_stats").select("*").single<CommunityStats>(),
    supabase.from("catalogue_stats").select("*").single<CatalogueStats>(),
  ]);

  return (
    <div className="space-y-20 py-6">
      {/* -------------------------------------------------------------- hero -- */}
      <section className="rise">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
          <TicketIcon size={13} />
          For rollercoaster enthusiasts
        </p>

        <h1 className="display mt-4 max-w-3xl text-[clamp(2.5rem,7vw,4.25rem)] font-semibold">
          Every credit,
          <br />
          in one place.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-2)]">
          A credit is a coaster you have ridden at least once. Log every ride against a shared
          catalogue, watch your count climb, and break your riding down by country, manufacturer
          and type.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-primary !px-5 !py-2.5">
            Start counting
            <ArrowRightIcon size={14} />
          </Link>
          <Link href="/leaderboard" className="btn btn-quiet !px-5 !py-2.5">
            View the leaderboard
          </Link>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
          <LockIcon size={12} />
          Private by default — you appear on the leaderboard only if you turn it on.
        </p>
      </section>

      {/* ------------------------------------------------------------ counts -- */}
      {catalogue && (
        <section
          aria-label="Catalogue at a glance"
          className="card stagger grid grid-cols-2 divide-x divide-[var(--line)] overflow-hidden sm:grid-cols-4"
        >
          {[
            { value: catalogue.coasters, label: "coasters" },
            { value: catalogue.parks, label: "parks" },
            { value: catalogue.countries, label: "countries" },
            { value: catalogue.manufacturers, label: "manufacturers" },
          ].map((item) => (
            <div key={item.label} className="px-5 py-6 text-center">
              <p className="display tabular text-3xl font-semibold">
                <CountUp value={item.value} />
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--ink-3)]">
                {item.label}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* ------------------------------------------------------------- value -- */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: <TicketIcon size={16} />,
            title: "Rides and credits, counted separately",
            body: "Re-riding a favourite adds to your ride total without inflating your credit count. Both numbers sit side by side on your dashboard, so neither has to be explained.",
          },
          {
            icon: <LockIcon size={16} />,
            title: "Private by default",
            body: "Your ride history, dates and notes are yours alone — enforced in the database, not just hidden in the interface. Even administrators cannot read them.",
          },
          {
            icon: <GlobeIcon size={16} />,
            title: "One shared catalogue",
            body: "Everyone logs against the same curated coaster list, maintained centrally, so a credit count actually means the same thing from one enthusiast to the next.",
          },
        ].map((item) => (
          <article key={item.title} className="card card-lift p-6">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg"
              style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
              aria-hidden
            >
              {item.icon}
            </span>
            <h2 className="mt-4 text-sm font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-2)]">{item.body}</p>
          </article>
        ))}
      </section>

      {/* --------------------------------------------------------- community -- */}
      {community && community.riders > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold tracking-tight">The community so far</h2>
            <p className="mt-1.5 text-sm text-[var(--ink-2)]">
              Counted from enthusiasts who opted into the leaderboard. Nobody who chose privacy
              contributes to these numbers.
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0">
            {[
              { value: community.riders, label: "enthusiasts listed" },
              { value: community.rides, label: "rides logged" },
              { value: community.coasters_ridden, label: "coasters ridden" },
              { value: community.countries, label: "countries covered" },
            ].map((item) => (
              <div key={item.label} className="px-5 py-6 text-center">
                <p className="display tabular text-3xl font-semibold">
                  <CountUp value={item.value} />
                </p>
                <p className="mt-1 text-xs text-[var(--ink-3)]">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- cta -- */}
      <section className="card flex flex-wrap items-center justify-between gap-5 p-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Start your count</h2>
          <p className="mt-1.5 text-sm text-[var(--ink-2)]">
            Email and a display name. No import, no setup — your first credit is three clicks away.
          </p>
        </div>
        <Link href="/signup" className="btn btn-primary !px-5 !py-2.5">
          Create an account
          <ArrowRightIcon size={14} />
        </Link>
      </section>
    </div>
  );
}
