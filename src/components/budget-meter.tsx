import { budgetUsage } from "@/lib/budget";
import { formatUsd } from "@/lib/mascot-models";

export interface BudgetState {
  daySpend: number;
  dayBudget: number;
  monthSpend: number;
  monthBudget: number;
  exhausted: boolean;
  /** What the endpoint does once a budget is gone: 'warn' or 'stop'. */
  action: string;
}

/**
 * Spend against the thresholds the endpoint itself enforces.
 *
 * This is deliberately not another line chart. The question is not "how did
 * spending move" — the charts above answer that — it is "how much of the
 * allowance is left", which is one ratio per budget, so it gets one bar per
 * budget and nothing else.
 *
 * The bar turns from the data hue to the brand hue at the threshold, but the
 * state is written out in words underneath as well. A colour change nobody can
 * see is not a warning.
 */
function Meter({
  label,
  spend,
  budget,
  note,
}: {
  label: string;
  spend: number;
  budget: number;
  note: string;
}) {
  const { percent, over } = budgetUsage(spend, budget);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-[var(--ink-2)]">{label}</span>
        <span className="tabular shrink-0 font-semibold">
          {formatUsd(spend)} <span className="font-normal text-[var(--ink-3)]">of {formatUsd(budget)}</span>
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}% of the budget used`}
        className="mt-1.5 h-[7px] w-full overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]"
      >
        <div
          className="h-full rounded-r-[3px]"
          style={{
            // Clamped so an overspend still reads as a full bar rather than
            // overflowing its track and losing the comparison entirely.
            width: `${Math.min(100, Math.max(2, percent))}%`,
            backgroundColor: over ? "var(--brand)" : "var(--data-1)",
          }}
        />
      </div>

      <p className="mt-1.5 text-xs text-[var(--ink-3)]">
        <span className="tabular font-medium text-[var(--ink-2)]">{percent}%</span> used. {note}
      </p>
    </div>
  );
}

export function BudgetMeter({ state }: { state: BudgetState }) {
  const stops = state.action === "stop";

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Budget</h3>
        <span className="text-xs text-[var(--ink-3)]">
          Checked on every call, not just on this page
        </span>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Meter
          label="Today"
          spend={state.daySpend}
          budget={state.dayBudget}
          note="Resets at midnight UTC."
        />
        <Meter
          label="This month"
          spend={state.monthSpend}
          budget={state.monthBudget}
          note="Resets on the first."
        />
      </div>

      <p
        role="status"
        className="mt-4 border-t border-[var(--line)] pt-3 text-sm"
        style={state.exhausted ? { color: "var(--brand)" } : undefined}
      >
        {state.exhausted ? (
          <>
            <strong>Budget reached.</strong>{" "}
            {stops
              ? "Rusty is refusing new questions with a 503 until spend falls back under a threshold. Raise a budget below to bring her back."
              : "New questions are still being answered, because the action is set to warn. Nothing is stopping the spend."}
          </>
        ) : (
          <>
            Within budget. When a threshold is reached the endpoint will{" "}
            <strong>{stops ? "refuse new questions" : "record it and carry on"}</strong>, which is
            the action set below.
          </>
        )}
      </p>
    </section>
  );
}
