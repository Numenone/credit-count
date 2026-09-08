"use client";

import { useActionState, useState } from "react";
import { logRide } from "@/lib/actions/rides";
import type { FormState } from "@/lib/actions/auth";
import type { Coaster } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";
import { CoasterName } from "@/components/coaster-details";
import { CalendarIcon, PlusIcon } from "@/components/icons";

/**
 * One catalogue result with an inline "log it" form.
 *
 * Interaction budget from the dashboard (SOW 5.2): type a search (1), press
 * Log ride (2). Date and note are optional refinements behind a disclosure, so
 * the fast path never grows a third required step.
 */
export function LogRideForm({
  coaster,
  today,
  alreadyRidden,
}: {
  coaster: Coaster;
  today: string;
  alreadyRidden: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(logRide, {});
  const [expanded, setExpanded] = useState(false);
  const justLogged = Boolean(state.message);

  return (
    <li className="border-b border-[var(--line)] px-5 py-3 transition-colors last:border-0 hover:bg-[var(--surface-2)]">
      <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input type="hidden" name="coasterId" value={coaster.id} />

        <div className="mr-auto min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CoasterName coaster={coaster} />
            {alreadyRidden > 0 && (
              <span className="chip shrink-0" title="You already have this credit">
                ×{alreadyRidden}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-[var(--ink-3)]">
            {coaster.park} · {coaster.country} · {coaster.manufacturer} · {coaster.type}
          </p>
        </div>

        {expanded ? (
          <div className="flex flex-wrap items-center gap-2">
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
              className="field !w-48 !py-1.5 !text-[0.82rem]"
            />
          </div>
        ) : (
          <>
            <input type="hidden" name="riddenOn" value={today} />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="btn btn-ghost !py-1 !text-[0.78rem]"
            >
              <CalendarIcon size={13} />
              Date or note
            </button>
          </>
        )}

        <SubmitButton
          variant={justLogged ? "quiet" : "primary"}
          className="!py-1.5 !text-[0.82rem]"
          pendingLabel="Logging…"
        >
          <PlusIcon size={13} />
          {justLogged ? "Log again" : "Log ride"}
        </SubmitButton>
      </form>

      {state.error && (
        <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--brand)" }}>
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="mt-1.5 text-xs" style={{ color: "var(--good)" }}>
          {state.message}
        </p>
      )}
    </li>
  );
}
