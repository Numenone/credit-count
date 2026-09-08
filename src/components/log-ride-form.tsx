"use client";

import { useActionState, useState } from "react";
import { logRide } from "@/lib/actions/rides";
import type { FormState } from "@/lib/actions/auth";
import type { Coaster } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";

/**
 * One catalogue result with an inline "log it" form.
 *
 * Interaction budget from the dashboard (SOW 5.2): type a search (1), press
 * Log ride (2). Date and note are optional refinements, not required steps.
 */
export function LogRideForm({ coaster, today }: { coaster: Coaster; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(logRide, {});
  const [expanded, setExpanded] = useState(false);
  const logged = Boolean(state.message);

  return (
    <li className="border-b border-[var(--color-line)] px-5 py-3.5 last:border-0">
      <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input type="hidden" name="coasterId" value={coaster.id} />

        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-medium">{coaster.name}</p>
          <p className="truncate text-xs text-[var(--color-ink-faint)]">
            {coaster.park} · {coaster.country} · {coaster.manufacturer} · {coaster.type}
          </p>
        </div>

        {expanded ? (
          <>
            <input
              type="date"
              name="riddenOn"
              defaultValue={today}
              max={today}
              aria-label={`Date ridden for ${coaster.name}`}
              className="field !w-auto !py-1.5 !text-[0.82rem]"
            />
            <input
              type="text"
              name="note"
              maxLength={280}
              placeholder="Note (optional)"
              aria-label={`Note for ${coaster.name}`}
              className="field !w-44 !py-1.5 !text-[0.82rem]"
            />
          </>
        ) : (
          <>
            <input type="hidden" name="riddenOn" value={today} />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs font-medium text-[var(--color-ink-faint)] underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              Add date or note
            </button>
          </>
        )}

        <SubmitButton
          variant={logged ? "quiet" : "primary"}
          className="!py-1.5 !text-[0.82rem]"
          pendingLabel="Logging…"
        >
          {logged ? "Log again" : "Log ride"}
        </SubmitButton>
      </form>

      {state.error && <p className="mt-1.5 text-xs text-[var(--color-accent)]">{state.error}</p>}
      {state.message && <p className="mt-1.5 text-xs text-emerald-700">{state.message}</p>}
    </li>
  );
}
