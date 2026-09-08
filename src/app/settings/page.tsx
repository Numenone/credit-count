import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { MotionToggle } from "@/components/motion-toggle";
import { LockIcon, TrophyIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireUser();

  return (
    <div className="rise mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="display text-3xl font-semibold">Settings</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-2)]">
          Signed in as {user.email}
          {profile.role === "admin" && <span className="chip chip-brand">Admin</span>}
        </p>
      </header>

      <div className="card p-6">
        <SettingsForm profile={profile} />
      </div>

      <section className="card p-6">
        <h2 className="text-sm font-semibold">Motion</h2>
        <div className="mt-3">
          <MotionToggle />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-sm font-semibold">Export your data</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-2)]">
          Download every ride you have logged, with the full catalogue details attached. Privacy
          that traps your data is only half a promise — this is the other half.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/v1/export?format=csv" className="btn btn-quiet !text-[0.82rem]" download>
            Download CSV
            <ArrowRightIcon size={13} />
          </a>
          <a href="/api/v1/export?format=json" className="btn btn-quiet !text-[0.82rem]" download>
            Download JSON
            <ArrowRightIcon size={13} />
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--ink-3)]">
          The export runs through your own session, so it contains your rides and nobody
          else&apos;s — the same boundary that applies everywhere else in the app.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LockIcon size={14} />
          What stays private
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--ink-2)]">
          <li>
            Your ride history, the dates you rode and every note you write are readable only by
            this account. That is enforced by row-level security in the database, so it holds for
            direct API calls too — not only inside this interface.
          </li>
          <li>
            Administrators manage the coaster catalogue. They cannot read your rides either.
          </li>
          <li className="flex gap-2">
            <TrophyIcon size={14} />
            <span>
              The leaderboard publishes a display name and a credit count. It never reveals which
              coasters anyone has ridden.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
