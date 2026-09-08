"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import type { FormState } from "@/lib/actions/auth";
import type { Profile } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={profile.display_name}
          required
          minLength={2}
          maxLength={40}
          className="field"
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
          Shown on the leaderboard if you opt in. Names are not unique, so someone else may use the
          same one.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="leaderboardOptIn"
            defaultChecked={profile.leaderboard_opt_in}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span>
            <span className="block text-sm font-medium">Appear on the public leaderboard</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--color-ink-soft)]">
              Publishes your display name and credit count to anyone, signed in or not. Your ride
              history, dates and notes stay private either way. Turning this off removes you
              immediately.
            </span>
          </span>
        </label>
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  );
}
