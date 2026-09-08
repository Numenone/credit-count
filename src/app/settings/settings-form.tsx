"use client";

import { useActionState, useState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import type { FormState } from "@/lib/actions/auth";
import type { Profile, UnitSystem } from "@/lib/database.types";
import { unitLabels } from "@/lib/units";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

const SYSTEMS: UnitSystem[] = ["metric", "imperial"];

/** Live sample so the choice is concrete rather than a word. */
const SAMPLE: Record<UnitSystem, string> = {
  metric: "Nemesis · 13 m tall · 80 km/h · 716 m of track",
  imperial: "Nemesis · 43 ft tall · 50 mph · 2,349 ft of track",
};

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const [units, setUnits] = useState<UnitSystem>(profile.unit_system);

  return (
    <form action={action} className="space-y-6">
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
        <p className="mt-1.5 text-xs text-[var(--ink-3)]">
          Shown on the leaderboard if you opt in. Names are not unique, so someone else may use the
          same one.
        </p>
      </div>

      <fieldset>
        <legend className="label">Units</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SYSTEMS.map((system) => {
            const active = units === system;
            return (
              <label
                key={system}
                className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border p-3.5 transition-colors"
                style={{
                  borderColor: active ? "var(--brand)" : "var(--line)",
                  backgroundColor: active ? "var(--brand-soft)" : "var(--surface)",
                }}
              >
                <input
                  type="radio"
                  name="unitSystem"
                  value={system}
                  checked={active}
                  onChange={() => setUnits(system)}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                />
                <span>
                  <span className="block text-sm font-medium">{unitLabels[system].name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink-3)]">
                    {unitLabels[system].detail}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="tabular mt-2 text-xs text-[var(--ink-3)]">{SAMPLE[units]}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-3)]">
          A display preference only. Measurements are stored in metric for everyone, so switching
          never changes anyone&apos;s data or how two riders compare.
        </p>
      </fieldset>

      <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="leaderboardOptIn"
            defaultChecked={profile.leaderboard_opt_in}
            className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
          />
          <span>
            <span className="block text-sm font-medium">Appear on the public leaderboard</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--ink-2)]">
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
