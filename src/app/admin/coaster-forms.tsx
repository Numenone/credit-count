"use client";

import { useActionState, useId, useState } from "react";
import { createCoaster, updateCoaster, deleteCoaster } from "@/lib/actions/catalogue";
import type { FormState } from "@/lib/actions/auth";
import type { Coaster } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { CoasterName } from "@/components/coaster-details";
import { PlusIcon } from "@/components/icons";

const TYPES = ["Steel", "Wooden", "Hybrid"] as const;

interface FieldSpec {
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "number" | "url";
  step?: string;
  max?: number;
  required?: boolean;
  span?: boolean;
}

const IDENTITY: FieldSpec[] = [
  { name: "name", label: "Name", max: 120, required: true, span: true },
  { name: "park", label: "Park", max: 120, required: true },
  { name: "country", label: "Country", max: 60, required: true },
  { name: "manufacturer", label: "Manufacturer", max: 80, required: true },
  { name: "park_city", label: "City or region", max: 120, hint: "Shown on the coaster card" },
];

const MEASUREMENTS: FieldSpec[] = [
  { name: "height_m", label: "Height (m)", type: "number", step: "0.1", hint: "Always metric — display units are per-user" },
  { name: "length_m", label: "Track length (m)", type: "number", step: "1" },
  { name: "speed_kmh", label: "Top speed (km/h)", type: "number", step: "0.1" },
  { name: "inversions", label: "Inversions", type: "number", step: "1" },
  { name: "opened_year", label: "Opened", type: "number", step: "1", hint: "1884 or later" },
];

const LOCATION: FieldSpec[] = [
  { name: "park_url", label: "Park website", type: "url", hint: "https:// only", span: true },
  { name: "latitude", label: "Latitude", type: "number", step: "0.000001", hint: "Approximate park location. The Maps link resolves the park by name, so this does not steer it." },
  { name: "longitude", label: "Longitude", type: "number", step: "0.000001" },
];

/**
 * The shared field set for adding and editing.
 *
 * Every label is bound to its control with a generated id — these were bare
 * <label> elements with no `htmlFor`, so screen readers announced the inputs
 * unlabelled and clicking a label did not focus its field.
 */
function CoasterFields({ coaster }: { coaster?: Coaster }) {
  const uid = useId();

  const render = (field: FieldSpec) => {
    const value = coaster?.[field.name as keyof Coaster];
    return (
      <div key={field.name} className={field.span ? "sm:col-span-2" : undefined}>
        <label className="label" htmlFor={`${uid}-${field.name}`}>
          {field.label}
        </label>
        <input
          id={`${uid}-${field.name}`}
          name={field.name}
          type={field.type ?? "text"}
          step={field.step}
          defaultValue={value == null ? "" : String(value)}
          required={field.required}
          maxLength={field.max}
          className="field"
        />
        {field.hint && <p className="mt-1 text-[0.7rem] text-[var(--ink-3)]">{field.hint}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
          Identity
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {IDENTITY.map(render)}
          <div>
            <label className="label" htmlFor={`${uid}-type`}>
              Type
            </label>
            <select
              id={`${uid}-type`}
              name="type"
              defaultValue={coaster?.type ?? "Steel"}
              className="field"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
          Measurements
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MEASUREMENTS.map(render)}</div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
          Location
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">{LOCATION.map(render)}</div>
      </fieldset>
    </div>
  );
}

export function AddCoasterForm() {
  const [state, action] = useActionState<FormState, FormData>(createCoaster, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <PlusIcon size={14} />
        Add a coaster
      </button>
    );
  }

  return (
    <form action={action} className="card rise w-full space-y-4 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">New catalogue entry</h2>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost !text-xs">
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
  const [confirming, setConfirming] = useState(false);
  const [editState, editAction] = useActionState<FormState, FormData>(updateCoaster, {});
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(deleteCoaster, {});

  const incomplete =
    coaster.height_m == null ||
    coaster.speed_kmh == null ||
    coaster.latitude == null ||
    coaster.park_url == null;

  return (
    <li className="border-b border-[var(--line)] last:border-0">
      {!editing ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]">
          <div className="mr-auto min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CoasterName coaster={coaster} />
              {incomplete && (
                <span className="chip shrink-0" title="Some detail fields are empty">
                  Incomplete
                </span>
              )}
            </p>
            <p className="truncate text-xs text-[var(--ink-3)]">
              {coaster.park} · {coaster.country} · {coaster.manufacturer}
              {coaster.opened_year ? ` · ${coaster.opened_year}` : ""}
            </p>
          </div>

          <span className="chip shrink-0">{coaster.type}</span>

          <div className="flex shrink-0 items-center gap-1">
            {confirming ? (
              <form action={deleteAction} className="flex items-center gap-1.5">
                <input type="hidden" name="coasterId" value={coaster.id} />
                <SubmitButton variant="quiet" className="!px-2 !py-1 !text-[0.75rem]" pendingLabel="…">
                  Remove for good
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="btn btn-ghost !px-2 !py-1 !text-[0.75rem]"
                >
                  Keep
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn btn-ghost !px-2 !py-1 !text-[0.75rem]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="btn btn-ghost !px-2 !py-1 !text-[0.75rem]"
                  style={{ color: "var(--brand)" }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <form
          action={editAction}
          onSubmit={() => setEditing(false)}
          className="space-y-4 bg-[var(--surface-2)] px-5 py-4"
        >
          <input type="hidden" name="coasterId" value={coaster.id} />
          <CoasterFields coaster={coaster} />
          <div className="flex items-center gap-2">
            <SubmitButton className="!py-1.5 !text-[0.82rem]" pendingLabel="Saving…">
              Save changes
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost !text-[0.8rem]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {(editState.error || deleteState.error) && (
        <p role="alert" className="px-5 pb-3 text-xs" style={{ color: "var(--brand)" }}>
          {editState.error ?? deleteState.error}
        </p>
      )}
      {editState.message && (
        <p role="status" className="px-5 pb-3 text-xs" style={{ color: "var(--good)" }}>
          {editState.message}
        </p>
      )}
    </li>
  );
}
