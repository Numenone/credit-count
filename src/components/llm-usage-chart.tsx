"use client";

import { useState } from "react";
import { formatUsd } from "@/lib/mascot-models";

export interface UsagePoint {
  bucket: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errors: number;
  p50Latency: number;
}

/**
 * Which measure a chart draws.
 *
 * A string rather than the obvious `measure: (p) => number` and
 * `format: (n) => string` props, because those are FUNCTIONS and this component
 * is rendered by a server component. Functions do not cross the RSC boundary —
 * only server actions do — and passing them fails at serialisation time with a
 * digest and no stack, which is a genuinely miserable thing to debug. The
 * discriminator serialises; the behaviour it selects lives here on the client.
 */
export type Metric = "cost" | "calls" | "outputTokens" | "inputTokens";

const METRICS: Record<
  Metric,
  { read: (point: UsagePoint) => number; format: (value: number) => string }
> = {
  cost: { read: (p) => p.costUsd, format: formatUsd },
  calls: { read: (p) => p.calls, format: (v) => v.toLocaleString("en-GB") },
  outputTokens: { read: (p) => p.outputTokens, format: (v) => v.toLocaleString("en-GB") },
  inputTokens: { read: (p) => p.inputTokens, format: (v) => v.toLocaleString("en-GB") },
};

/**
 * One measure over time.
 *
 * Two of these are stacked on the page rather than one chart with two y-axes.
 * Spend and call volume are different scales, and a second axis lets you draw
 * any relationship you like between two series by choosing where to put it —
 * small multiples over a shared x-axis say the same thing without the licence
 * to mislead.
 *
 * One series, so one hue, and length already carries the magnitude — a value
 * ramp on top would spend the only free channel restating it. The exception is
 * a bucket containing failures, which is a different KIND of thing rather than
 * more of the same, so it gets the alert colour and is named in the tooltip.
 */
export function LlmUsageChart({
  title,
  subtitle,
  points,
  metric,
  emptyLabel = "Nothing recorded in this window.",
}: {
  title: string;
  subtitle: string;
  points: UsagePoint[];
  metric: Metric;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { read, format } = METRICS[metric];
  const values = points.map(read);
  const max = Math.max(...values, 0);
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-[var(--ink-3)]">{subtitle}</span>
      </header>

      {points.length === 0 || max === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-3)]">{emptyLabel}</p>
      ) : (
        <>
          <p className="tabular mt-3 text-2xl font-semibold">{format(total)}</p>

          <div className="mt-4 overflow-x-auto">
            <div
              className="flex h-32 min-w-full items-end gap-[3px]"
              role="img"
              aria-label={`${title}: ${format(total)} across ${points.length} intervals. The table below lists the same figures.`}
            >
              {points.map((point, i) => {
                const value = read(point);
                // A zero-height bar is indistinguishable from a gap in the
                // data, so anything above zero keeps a visible floor.
                const height = max === 0 ? 0 : Math.max((value / max) * 100, value > 0 ? 3 : 0);

                return (
                  <div
                    key={point.bucket}
                    className="group relative flex h-full flex-1 items-end"
                    style={{ minWidth: 6 }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div
                      className="w-full rounded-t-[4px] transition-[height] duration-300"
                      style={{
                        height: `${height}%`,
                        backgroundColor: point.errors > 0 ? "var(--brand)" : "var(--data-1)",
                        opacity: hovered === null || hovered === i ? 1 : 0.45,
                      }}
                    />

                    {hovered === i && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[15rem] -translate-x-1/2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-xs shadow-[var(--shadow-md)]">
                        <p className="font-medium">
                          {new Date(point.bucket).toLocaleString("en-GB")}
                        </p>
                        <p className="tabular mt-1 text-[var(--ink-2)]">{format(value)}</p>
                        <p className="tabular text-[var(--ink-3)]">
                          {point.calls} {point.calls === 1 ? "call" : "calls"} ·{" "}
                          {formatUsd(point.costUsd)} · {point.p50Latency} ms median
                        </p>
                        {point.errors > 0 && (
                          <p style={{ color: "var(--brand)" }}>
                            {point.errors} {point.errors === 1 ? "failure" : "failures"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[0.7rem] text-[var(--ink-3)]">
            <span>{new Date(points[0].bucket).toLocaleString("en-GB")}</span>
            <span>{new Date(points[points.length - 1].bucket).toLocaleString("en-GB")}</span>
          </div>

          {/* The same numbers, reachable without seeing or hovering the chart. */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[var(--ink-3)] hover:text-[var(--ink-2)]">
              View as a table
            </summary>
            <div className="mt-2 max-h-56 overflow-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  {title} by interval, with call counts and failures
                </caption>
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="text-[var(--ink-3)]">
                    <th scope="col" className="py-1 pr-3 font-medium">Interval</th>
                    <th scope="col" className="py-1 pr-3 font-medium">{title}</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Calls</th>
                    <th scope="col" className="py-1 font-medium">Failures</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {points.map((point) => (
                    <tr key={point.bucket} className="border-t border-[var(--line)]">
                      <td className="py-1 pr-3">
                        {new Date(point.bucket).toLocaleString("en-GB")}
                      </td>
                      <td className="py-1 pr-3">{format(read(point))}</td>
                      <td className="py-1 pr-3">{point.calls}</td>
                      <td className="py-1">{point.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
