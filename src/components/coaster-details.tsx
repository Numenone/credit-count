"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Coaster, UnitSystem } from "@/lib/database.types";
import { CoasterModal, type RideSummary } from "@/components/coaster-modal";

interface ContextValue {
  open: (coaster: Coaster) => void;
  unitSystem: UnitSystem;
}

const CoasterDetailsContext = createContext<ContextValue | null>(null);

/**
 * Holds the one coaster modal for a page.
 *
 * A single modal instance is mounted at the page level rather than one per row:
 * with 50 rows that would be 50 dialogs in the DOM, and only ever one open.
 * Ride summaries are keyed by coaster id and passed in from the server, so the
 * modal never fetches — the data is already on the page.
 */
export function CoasterDetailsProvider({
  unitSystem,
  rideSummaries = {},
  children,
}: {
  unitSystem: UnitSystem;
  rideSummaries?: Record<string, RideSummary>;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<Coaster | null>(null);

  const open = useCallback((coaster: Coaster) => setActive(coaster), []);
  const value = useMemo(() => ({ open, unitSystem }), [open, unitSystem]);

  return (
    <CoasterDetailsContext.Provider value={value}>
      {children}
      {active && (
        <CoasterModal
          key={active.id}
          coaster={active}
          unitSystem={unitSystem}
          rideSummary={rideSummaries[active.id]}
          onClose={() => setActive(null)}
        />
      )}
    </CoasterDetailsContext.Provider>
  );
}

export function useCoasterDetails() {
  const ctx = useContext(CoasterDetailsContext);
  if (!ctx) throw new Error("useCoasterDetails must be used inside CoasterDetailsProvider");
  return ctx;
}

/**
 * A coaster name that opens its detail modal.
 *
 * Rendered as a real button so it is keyboard reachable and announced as a
 * control, with a dotted underline that reads as "there is more here" without
 * looking like a navigation link.
 */
export function CoasterName({
  coaster,
  className = "",
}: {
  coaster: Coaster;
  className?: string;
}) {
  const { open } = useCoasterDetails();

  return (
    <button
      type="button"
      onClick={() => open(coaster)}
      aria-haspopup="dialog"
      className={`truncate text-left underline decoration-dotted decoration-[var(--ink-3)] underline-offset-[3px] transition-colors hover:decoration-[var(--brand)] hover:text-[var(--brand)] ${className}`}
    >
      {coaster.name}
    </button>
  );
}
