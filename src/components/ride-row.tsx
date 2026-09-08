"use client";

import { useActionState, useState } from "react";
import { updateRide, deleteRide } from "@/lib/actions/rides";
import type { FormState } from "@/lib/actions/auth";
import type { Coaster, RideWithCoaster } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";

export function RideRow({
  ride,
  catalogue,
  today,
  isNewCredit,
}: {
  ride: RideWithCoaster;
  catalogue: Coaster[];
  today: string;
  isNewCredit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useActionState<FormState, FormData>(updateRide, {});
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(deleteRide, {});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li className="border-b border-[var(--color-line)] px-5 py-4 last:border-0">
      {!editing ? (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div className="mr-auto min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{ride.coaster.name}</span>
              {isNewCredit && (
                <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                  Credit
                </span>
              )}
            </p>
            <p className="truncate text-xs text-[var(--color-ink-faint)]">
              {ride.coaster.park} · {ride.coaster.country} · {ride.coaster.manufacturer} ·{" "}
              {ride.coaster.type}
            </p>
            {ride.note && (
              <p className="mt-1 text-xs italic text-[var(--color-ink-soft)]">“{ride.note}”</p>
            )}
          </div>

          <span className="tabular shrink-0 text-xs text-[var(--color-ink-faint)]">
            {ride.ridden_on}
          </span>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-[var(--color-ink-soft)] underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              Edit
            </button>
            {confirmingDelete ? (
              <form action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="rideId" value={ride.id} />
                <SubmitButton variant="quiet" className="!py-1 !text-[0.75rem]" pendingLabel="…">
                  Confirm delete
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs text-[var(--color-ink-faint)] underline underline-offset-2"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-medium text-[var(--color-accent)] underline underline-offset-2"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : (
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="rideId" value={ride.id} />
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="label" htmlFor={`coaster-${ride.id}`}>
                Coaster
              </label>
              <select
                id={`coaster-${ride.id}`}
                name="coasterId"
                defaultValue={ride.coaster_id}
                className="field"
              >
                {catalogue.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.park}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`date-${ride.id}`}>
                Date ridden
              </label>
              <input
                id={`date-${ride.id}`}
                type="date"
                name="riddenOn"
                defaultValue={ride.ridden_on}
                max={today}
                className="field"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor={`note-${ride.id}`}>
              Note
            </label>
            <input
              id={`note-${ride.id}`}
              type="text"
              name="note"
              maxLength={280}
              defaultValue={ride.note ?? ""}
              placeholder="Optional"
              className="field"
            />
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton className="!py-1.5 !text-[0.82rem]" pendingLabel="Saving…">
              Save changes
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-[var(--color-ink-soft)] underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {(editState.error || deleteState.error) && (
        <p className="mt-2 text-xs text-[var(--color-accent)]">
          {editState.error ?? deleteState.error}
        </p>
      )}
      {editState.message && <p className="mt-2 text-xs text-emerald-700">{editState.message}</p>}
    </li>
  );
}
