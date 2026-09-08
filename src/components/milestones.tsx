import type { Milestone } from "@/lib/stats";

export function Milestones({ milestones }: { milestones: Milestone[] }) {
  const earned = milestones.filter((m) => m.earned);
  const next = milestones.filter((m) => !m.earned).slice(0, 4);

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Milestones</h3>
        <span className="text-xs text-[var(--ink-3)]">
          <span className="tabular font-medium text-[var(--ink-2)]">{earned.length}</span> of{" "}
          {milestones.length} earned
        </span>
      </header>

      {earned.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {earned.map((m) => (
            <li
              key={m.id}
              title={m.detail}
              className="chip chip-brand"
              style={{ animation: "pop 380ms var(--ease-out) both" }}
            >
              <CheckIcon />
              {m.label}
            </li>
          ))}
        </ul>
      )}

      {next.length > 0 && (
        <ul className={`space-y-2.5 ${earned.length > 0 ? "mt-5 border-t border-[var(--line)] pt-4" : "mt-4"}`}>
          {next.map((m) => (
            <li key={m.id}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-[var(--ink-2)]">{m.detail}</span>
                <span className="tabular shrink-0 text-[var(--ink-3)]">
                  {Math.round(m.progress * 100)}%
                </span>
              </div>
              <div className="mt-1 h-[5px] w-full overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
                <div
                  className="h-full rounded-r-[3px] origin-left"
                  style={{
                    width: `${Math.max(2, m.progress * 100)}%`,
                    backgroundColor: "var(--ink-3)",
                    animation: "grow-x 640ms var(--ease-out) both",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {earned.length === milestones.length && (
        <p className="mt-4 text-sm text-[var(--ink-3)]">Every milestone earned. Go find more credits.</p>
      )}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}
