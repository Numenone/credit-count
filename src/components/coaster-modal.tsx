"use client";

import { useEffect, useRef } from "react";
import type { Coaster, UnitSystem } from "@/lib/database.types";
import { formatHeight, formatLength, formatSpeed } from "@/lib/units";
import { PinIcon, GlobeIcon, ArrowRightIcon, RepeatIcon, CalendarIcon } from "@/components/icons";

export interface RideSummary {
  /** How many times the signed-in user has ridden this coaster. */
  count: number;
  first: string | null;
  last: string | null;
  notes: string[];
}

/**
 * Detail view for one coaster.
 *
 * Built on <dialog> so focus trapping, Escape-to-close and inertness of the page
 * behind come from the platform rather than from hand-written key handlers.
 * showModal() is called from an effect because a dialog opened declaratively
 * would not be modal.
 */
export function CoasterModal({
  coaster,
  unitSystem,
  rideSummary,
  onClose,
}: {
  coaster: Coaster;
  unitSystem: UnitSystem;
  rideSummary?: RideSummary;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const address = [coaster.park, coaster.park_city, coaster.country]
    .filter(Boolean)
    .join(", ");

  // Navigate by NAME, not by coordinate.
  //
  // A lat/long query drops a pin on exactly those numbers, so a coordinate that
  // is a few hundred metres out lands the user in the car park next door — or in
  // a field. Google's geocoder resolves "Alton Towers, Alton, Staffordshire" to
  // the actual park POI every time, which is what someone clicking this wants.
  // The stored coordinates are approximate park-level values kept for future use
  // (a map view, distance-to-park); they are deliberately not the thing that
  // decides where this link goes.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const facts = [
    { label: "Height", value: formatHeight(coaster.height_m, unitSystem) },
    { label: "Top speed", value: formatSpeed(coaster.speed_kmh, unitSystem) },
    { label: "Track length", value: formatLength(coaster.length_m, unitSystem) },
    {
      label: "Inversions",
      value: coaster.inversions == null ? null : String(coaster.inversions),
    },
    { label: "Opened", value: coaster.opened_year == null ? null : String(coaster.opened_year) },
    { label: "Type", value: coaster.type },
  ].filter((f) => f.value !== null);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click landing on the dialog element itself is a backdrop click; a click
      // on its content stops at the inner wrapper.
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="coaster-modal-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-[var(--shadow-lg)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
    >
      <div className="fade">
        <header className="flex items-start gap-4 border-b border-[var(--line)] p-5">
          <div className="min-w-0 flex-1">
            <span className="chip">{coaster.manufacturer}</span>
            <h2 id="coaster-modal-title" className="display mt-2 text-2xl font-semibold">
              {coaster.name}
            </h2>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--ink-2)]">
              <span className="mt-0.5 shrink-0 text-[var(--ink-3)]">
                <PinIcon size={13} />
              </span>
              {address}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="btn btn-ghost shrink-0 !px-2 !py-1 text-lg leading-none"
          >
            ×
          </button>
        </header>

        <div className="grid grid-cols-2 gap-px bg-[var(--line)] sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="bg-[var(--surface)] px-4 py-3.5">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                {fact.label}
              </p>
              <p className="tabular mt-1 text-lg font-semibold">{fact.value}</p>
            </div>
          ))}
        </div>

        {rideSummary && rideSummary.count > 0 && (
          <section className="border-t border-[var(--line)] p-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
              <RepeatIcon size={12} />
              Your history
            </h3>
            <p className="mt-2 text-sm">
              Ridden{" "}
              <span className="tabular font-semibold">
                {rideSummary.count} {rideSummary.count === 1 ? "time" : "times"}
              </span>
              {rideSummary.first && (
                <>
                  {" "}
                  · first on <span className="tabular">{rideSummary.first}</span>
                </>
              )}
              {rideSummary.last && rideSummary.last !== rideSummary.first && (
                <>
                  {" "}
                  · most recently <span className="tabular">{rideSummary.last}</span>
                </>
              )}
            </p>
            {rideSummary.notes.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {rideSummary.notes.map((note, i) => (
                  <li key={i} className="text-sm italic leading-relaxed text-[var(--ink-2)]">
                    “{note}”
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
              <CalendarIcon size={11} />
              Only you can see this section.
            </p>
          </section>
        )}

        <footer className="flex flex-wrap gap-2 border-t border-[var(--line)] p-5">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-quiet !text-[0.82rem]"
          >
            <PinIcon size={13} />
            Open in Google Maps
          </a>
          {coaster.park_url && (
            <a
              href={coaster.park_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-quiet !text-[0.82rem]"
            >
              <GlobeIcon size={13} />
              {coaster.park} website
              <ArrowRightIcon size={12} />
            </a>
          )}
        </footer>
      </div>
    </dialog>
  );
}
