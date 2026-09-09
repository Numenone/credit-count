"use client";

import { useMemo, useState } from "react";

const DAY_MS = 86_400_000;
const WEEKS = 53;

/** Sequential: one hue, light→dark. Empty is a neutral, not the lightest blue. */
const STEPS = ["var(--seq-1)", "var(--seq-2)", "var(--seq-4)", "var(--seq-5)"];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function label(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A year of riding, one cell per day.
 *
 * Magnitude over time with a strong weekly/seasonal shape, which is exactly what
 * a calendar heatmap is for: the season a park is open shows up as a band, and
 * a trip shows up as a cluster. `today` is passed in from the server so the grid
 * is identical on both sides of hydration.
 */
export function ActivityHeatmap({
  activity,
  today,
}: {
  activity: Record<string, number>;
  today: string;
}) {
  const [hovered, setHovered] = useState<{ date: string; count: number; x: number } | null>(null);

  const { columns, months, max, total } = useMemo(() => {
    const [ty, tm, td] = today.split("-").map(Number);
    const todayDate = new Date(Date.UTC(ty, tm - 1, td));

    // Anchor on the SATURDAY that ends this week, then count back a whole number
    // of weeks. Anchoring on today and rewinding to a Sunday afterwards shortened
    // the grid by up to six days, which silently dropped the most recent rides —
    // the ones a user is most likely to be looking for.
    const end = new Date(todayDate.getTime() + (6 - todayDate.getUTCDay()) * DAY_MS);
    const start = new Date(end.getTime() - (WEEKS * 7 - 1) * DAY_MS);

    const cols: { date: string; count: number; inFuture: boolean }[][] = [];
    const monthMarks: { index: number; name: string }[] = [];
    let seenMonth = -1;
    let peak = 0;
    let sum = 0;

    for (let w = 0; w < WEEKS; w++) {
      const week: { date: string; count: number; inFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
        const key = iso(day);
        const count = activity[key] ?? 0;
        peak = Math.max(peak, count);
        if (key <= today) sum += count;
        week.push({ date: key, count, inFuture: key > today });

        if (d === 0) {
          const month = day.getUTCMonth();
          const lastMark = monthMarks[monthMarks.length - 1];
          // A month gets a label only if there is room for it: a partial first
          // week could otherwise put "Aug" and "Sept" in adjacent 11px columns,
          // overlapping into one unreadable word.
          if (month !== seenMonth && (!lastMark || w - lastMark.index >= 3)) {
            seenMonth = month;
            monthMarks.push({
              index: w,
              name: day.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
            });
          } else if (month !== seenMonth) {
            seenMonth = month;
          }
        }
      }
      cols.push(week);
    }

    return { columns: cols, months: monthMarks, max: peak, total: sum };
  }, [activity, today]);

  const level = (count: number) => {
    if (count === 0) return -1;
    if (max <= 1) return 0;
    // Four bins across the observed range, so the scale adapts to a rider who
    // logs one a month and one who logs eight in a day.
    return Math.min(3, Math.floor(((count - 1) / max) * 4));
  };

  // The three facts the picture is actually carrying.
  const active = columns.flat().filter((c) => !c.inFuture && c.count > 0);
  const busiest = active.reduce<(typeof active)[number] | null>(
    (best, cell) => (!best || cell.count > best.count ? cell : best),
    null,
  );
  const summary =
    total === 0
      ? "No rides logged in the last 12 months."
      : `Riding activity for the last 12 months: ${total} ${total === 1 ? "ride" : "rides"} ` +
        `across ${active.length} ${active.length === 1 ? "day" : "days"}` +
        (busiest
          ? `. Busiest was ${label(busiest.date)}, with ${busiest.count} ` +
            `${busiest.count === 1 ? "ride" : "rides"}.`
          : ".");

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Riding year</h3>
        <span className="text-xs text-[var(--ink-3)]">
          <span className="tabular font-medium text-[var(--ink-2)]">{total}</span>{" "}
          {total === 1 ? "ride" : "rides"} in the last 12 months
        </span>
      </header>

      <div className="relative mt-4 overflow-x-auto pb-1">
        <div className="min-w-max">
          <div className="flex gap-[3px] pl-[26px] text-[0.62rem] text-[var(--ink-3)]">
            {columns.map((_, w) => {
              const mark = months.find((m) => m.index === w);
              return (
                <span key={w} className="w-[11px] shrink-0">
                  {mark && w < WEEKS - 2 ? mark.name : ""}
                </span>
              );
            })}
          </div>

          {/* One image with a summary, not 365 of them.
              Labelling every cell is technically complete and practically
              useless: it turns a glance into a year of cell-by-cell
              navigation. The grid says what it shows, the busiest days are
              named, and the rest is decoration. */}
          <div
            className="mt-1 flex gap-[3px]"
            role="img"
            aria-label={summary}
          >
            <div className="flex w-[23px] shrink-0 flex-col gap-[3px] pr-1.5 text-[0.62rem] leading-[11px] text-[var(--ink-3)]">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                <span key={i} className="h-[11px]">
                  {d}
                </span>
              ))}
            </div>

            {columns.map((week, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {week.map((cell) => {
                  const lvl = level(cell.count);
                  return (
                    <div
                      key={cell.date}
                      aria-hidden
                      // Kept for a mouse: the hover tooltip is a bonus, and
                      // title gives the same thing to a slow pointer.
                      title={
                        cell.inFuture
                          ? undefined
                          : `${cell.count} ${cell.count === 1 ? "ride" : "rides"} on ${label(cell.date)}`
                      }
                      onMouseEnter={(e) =>
                        !cell.inFuture &&
                        setHovered({
                          date: cell.date,
                          count: cell.count,
                          x: e.currentTarget.offsetLeft,
                        })
                      }
                      onMouseLeave={() => setHovered(null)}
                      className="h-[11px] w-[11px] rounded-[2px]"
                      style={{
                        backgroundColor: cell.inFuture
                          ? "transparent"
                          : lvl === -1
                            ? "var(--seq-0)"
                            : STEPS[lvl],
                        outline:
                          hovered?.date === cell.date ? "1.5px solid var(--ink)" : "none",
                        outlineOffset: "1px",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {hovered && (
          <div
            className="viz-tooltip -top-1 translate-y-[-100%]"
            style={{ left: Math.max(0, hovered.x - 20) }}
          >
            <strong>
              {hovered.count} {hovered.count === 1 ? "ride" : "rides"}
            </strong>
            <br />
            {label(hovered.date)}
          </div>
        )}
      </div>

      {/* Sequential encoding always ships its scale. */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[0.68rem] text-[var(--ink-3)]">
        <span>Less</span>
        <span className="h-[11px] w-[11px] rounded-[2px]" style={{ backgroundColor: "var(--seq-0)" }} />
        {STEPS.map((step) => (
          <span key={step} className="h-[11px] w-[11px] rounded-[2px]" style={{ backgroundColor: step }} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
