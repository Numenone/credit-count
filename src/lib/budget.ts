/**
 * How much of a budget has been spent.
 *
 * Extracted from the meter that draws it because the interesting cases are
 * arithmetic, not layout: a budget of zero, a spend that has run past its
 * budget, and the boundary where "at the budget" has to count as exhausted
 * rather than as one cent short. Postgres decides whether the endpoint refuses
 * a call; this decides what the console says about it, and the two agree on
 * `>=` so the page never shows "within budget" while the feature is turned off.
 */
export interface BudgetUsage {
  /** Spend over budget. 1 means exactly at it. Not clamped. */
  fraction: number;
  /** The same figure as a whole number, for display and for aria-valuenow. */
  percent: number;
  over: boolean;
}

export function budgetUsage(spend: number, budget: number): BudgetUsage {
  // A budget of zero is a real setting — "spend nothing" — rather than a
  // division to guard against. Anything spent against it is fully used; nothing
  // spent against it is not.
  const fraction = budget > 0 ? spend / budget : spend > 0 ? 1 : 0;

  return {
    fraction,
    // Rounded, so 99.6% of a budget does not display as 99% and read as
    // comfortable. Floor would understate every figure on this page.
    percent: Math.round(fraction * 100),
    over: fraction >= 1,
  };
}
