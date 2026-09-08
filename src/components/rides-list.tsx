"use client";

import { useActionState, useState } from "react";
import { updateRide, deleteRide } from "@/lib/actions/rides";
import type { FormState } from "@/lib/actions/auth";
import type { Coaster, RideWithCoaster } from "@/lib/database.types";
import { SubmitButton } from "@/components/submit-button";
import { CoasterName } from "@/components/coaster-details";

function monthLabel(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * The whole ride history, with editing hoisted to the list.
 *
 * The catalogue is a single prop on this component rather than one copy per row:
 * with 50 coasters and a few dozen rides, per-row copies meant the same list was
 * serialised into the payload dozens of times. Only one edit form is mounted at
 * a time, which is also all a user can be doing.
 */
export function RidesList({
  rides,
  catalogue,
  today,
  creditRideIds,
}: {
  rides: RideWithCoaster[];
  catalogue: Coaster[];
  today: string;
  creditRideIds: string[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editState, editAction] = useActionState<FormState, FormData>(updateRide, {});
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(deleteRide, {});

  const credits = new Set(creditRideIds);

  // Rides arrive newest-first; group runs of the same month under one heading.
  const groups: { month: string; rides: RideWithCoaster[] }[] = [];
  for (const ride of rides) {
    const month = ride.ridden_on.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.rides.push(ride);
    else groups.push({ month, rides: [ride] });
  }

  return (
    <div className="space-y-6">
      {(editState.error || deleteState.error) && (
        <p role="alert" className="card px-4 py-2.5 text-sm" style={{ color: "var(--brand)" }}>
          {editState.error ?? deleteState.error}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.month}>
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
              {monthLabel(`${group.month}-01`)}
            </h2>
            <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
            <span className="tabular text-xs text-[var(--ink-3)]">
              {group.rides.length} {group.rides.length === 1 ? "ride" : "rides"}
            </span>
          </div>

          <ul className="card overflow-hidden">
            {group.rides.map((ride) => {
              const isEditing = editingId === ride.id;
              const isConfirming = confirmingId === ride.id;

              return (
                <li key={ride.id} className="border-b border-[var(--line)] last:border-0">
                  {!isEditing ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]">
                      <span
                        aria-hidden
                        className="h-8 w-[3px] shrink-0 rounded-full"
                        style={{
                          backgroundColor: credits.has(ride.id) ? "var(--brand)" : "var(--line)",
                        }}
                      />

                      <div className="mr-auto min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <CoasterName coaster={ride.coaster} />
                          {credits.has(ride.id) && (
                            <span className="chip chip-brand shrink-0">Credit</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-[var(--ink-3)]">
                          {ride.coaster.park} · {ride.coaster.country} ·{" "}
                          {ride.coaster.manufacturer} · {ride.coaster.type}
                        </p>
                        {ride.note && (
                          <p className="mt-1 text-xs italic text-[var(--ink-2)]">“{ride.note}”</p>
                        )}
                      </div>

                      <span className="tabular shrink-0 text-xs text-[var(--ink-3)]">
                        {dayLabel(ride.ridden_on)}
                      </span>

                      <div className="flex shrink-0 items-center gap-1">
                        {isConfirming ? (
                          <form action={deleteAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="rideId" value={ride.id} />
                            <SubmitButton
                              variant="quiet"
                              className="!px-2 !py-1 !text-[0.75rem]"
                              pendingLabel="…"
                            >
                              Delete for good
                            </SubmitButton>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="btn btn-ghost !px-2 !py-1 !text-[0.75rem]"
                            >
                              Keep
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(ride.id);
                                setConfirmingId(null);
                              }}
                              className="btn btn-ghost !px-2 !py-1 !text-[0.75rem]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(ride.id)}
                              className="btn btn-ghost !px-2 !py-1 !text-[0.75rem]"
                              style={{ color: "var(--brand)" }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form
                      action={editAction}
                      onSubmit={() => setEditingId(null)}
                      className="space-y-3 bg-[var(--surface-2)] px-5 py-4"
                    >
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
                          placeholder="Optional — only you can read this"
                          className="field"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <SubmitButton className="!py-1.5 !text-[0.82rem]" pendingLabel="Saving…">
                          Save changes
                        </SubmitButton>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="btn btn-ghost !text-[0.8rem]"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
