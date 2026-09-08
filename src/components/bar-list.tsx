"use client";

import { useState } from "react";
import type { Breakdown } from "@/lib/stats";

/**
 * Credits grouped by one dimension.
 *
 * One series, so one hue for every bar — a value ramp here would double-encode
 * bar length as colour and burn the only free channel on information the length
 * already carries. Every bar is directly labelled, so identity never depends on
 * colour at all; the hover layer adds the ride count without cluttering the
 * resting state.
 */
export function BarList({
  title,
  subtitle,
  items,
  limit = 6,
  unit = "credits",
}: {
  title: string;
  subtitle?: string;
  items: Breakdown[];
  limit?: number;
  unit?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const shown = items.slice(0, limit);
  const max = shown[0]?.credits ?? 1;
  const hiddenItems = items.slice(limit);
  const hiddenCredits = hiddenItems.reduce((sum, i) => sum + i.credits, 0);

  return (
    <section className="card p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <span className="text-xs text-[var(--ink-3)]">{subtitle}</span>}
      </header>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-3)]">Nothing logged yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((item, index) => {
            const pct = (item.credits / max) * 100;
            const isHovered = hovered === item.label;

            return (
              <li
                key={item.label}
                className="group relative"
                onMouseEnter={() => setHovered(item.label)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.label)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-[var(--ink-2)]">{item.label}</span>
                  <span className="tabular shrink-0 font-semibold">{item.credits}</span>
                </div>

                {/* Track is recessive; the bar is the only saturated thing here. */}
                <div className="mt-1.5 h-[7px] w-full overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
                  <div
                    className="h-full rounded-r-[3px] origin-left"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: "var(--data-1)",
                      opacity: hovered && !isHovered ? 0.45 : 1,
                      transition: "opacity 160ms var(--ease)",
                      animation: `grow-x 640ms var(--ease-out) ${index * 55}ms both`,
                    }}
                  />
                </div>

                {isHovered && (
                  <div className="viz-tooltip bottom-full left-0 mb-1">
                    <strong>{item.label}</strong>
                    <br />
                    {item.credits} {item.credits === 1 ? unit.replace(/s$/, "") : unit} ·{" "}
                    {item.rides} {item.rides === 1 ? "ride" : "rides"}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hiddenItems.length > 0 && (
        <p className="mt-3.5 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-3)]">
          <span className="tabular font-medium text-[var(--ink-2)]">+{hiddenCredits}</span>{" "}
          {hiddenCredits === 1 ? "credit" : "credits"} across {hiddenItems.length} more{" "}
          {hiddenItems.length === 1 ? "entry" : "entries"}
        </p>
      )}
    </section>
  );
}
