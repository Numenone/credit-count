"use client";

import { useActionState, useState } from "react";
import { createCoaster, updateCoaster, deleteCoaster } from "@/lib/actions/catalogue";
import type { FormState } from "@/lib/actions/auth";
import type { Coaster } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

const TYPES = ["Steel", "Wooden", "Hybrid"] as const;

function CoasterFields({ coaster }: { coaster?: Coaster }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Name</label>
        <input name="name" defaultValue={coaster?.name} required maxLength={120} className="field" />
      </div>
      <div>
        <label className="label">Park</label>
        <input name="park" defaultValue={coaster?.park} required maxLength={120} className="field" />
      </div>
      <div>
        <label className="label">Country</label>
        <input
          name="country"
          defaultValue={coaster?.country}
          required
          maxLength={60}
          className="field"
        />
      </div>
      <div>
        <label className="label">Manufacturer</label>
        <input
          name="manufacturer"
          defaultValue={coaster?.manufacturer}
          required
          maxLength={80}
          className="field"
        />
      </div>
      <div>
        <label className="label">Type</label>
        <select name="type" defaultValue={coaster?.type ?? "Steel"} className="field">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function AddCoasterForm() {
  const [state, action] = useActionState<FormState, FormData>(createCoaster, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        Add a coaster
      </button>
    );
  }

  return (
    <form action={action} className="card w-full space-y-4 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">New catalogue entry</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--color-ink-faint)] underline underline-offset-2"
        >
          Close
        </button>
      </div>
      <CoasterFields />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Adding…">Add coaster</SubmitButton>
    </form>
  );
}

export function CoasterRow({ coaster }: { coaster: Coaster }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useActionState<FormState, FormData>(updateCoaster, {});
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(deleteCoaster, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="border-b border-[var(--color-line)] px-5 py-3.5 last:border-0">
      {!editing ? (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div className="mr-auto min-w-0">
            <p className="truncate text-sm font-medium">{coaster.name}</p>
            <p className="truncate text-xs text-[var(--color-ink-faint)]">
              {coaster.park} · {coaster.country} · {coaster.manufacturer} · {coaster.type}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-[var(--color-ink-soft)] underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              Edit
            </button>
            {confirming ? (
              <form action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="coasterId" value={coaster.id} />
                <SubmitButton variant="quiet" className="!py-1 !text-[0.75rem]" pendingLabel="…">
                  Confirm remove
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-xs text-[var(--color-ink-faint)] underline underline-offset-2"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-xs font-medium text-[var(--color-accent)] underline underline-offset-2"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="coasterId" value={coaster.id} />
          <CoasterFields coaster={coaster} />
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
