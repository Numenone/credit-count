import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireUser();

  return (
    <div className="mx-auto max-w-lg py-2">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1.5 mb-6 text-sm text-[var(--color-ink-soft)]">
        Signed in as {user.email}
        {profile.role === "admin" && (
          <span className="ml-2 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Admin
          </span>
        )}
      </p>

      <div className="card p-6">
        <SettingsForm profile={profile} />
      </div>
    </div>
  );
}
