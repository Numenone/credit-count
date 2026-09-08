"use client";

import { useState } from "react";
import type { Breakdown } from "@/lib/stats";
import type { CoasterType } from "@/lib/database.types";

/**
 * Credits split across the three coaster types.
 *
 * Part-to-whole with three segments, which is the one shape a stacked bar reads
 * better than a list — and better than a donut, which would make 2 vs 2 a guess.
 *
 * Colour is assigned by the type itself, in a fixed order, never by rank: filter
 * or reorder the data and Steel stays blue. The three hues are slots 1–3 of the
 * validated categorical palette, which clear the all-pairs colour-vision gates in
 * both themes; every segment is directly labelled underneath as well, so the
 * chart never depends on colour alone.
 */
const COLOUR: Record<CoasterType, string> = {
  Steel: "var(--data-1)",
  Wooden: "var(--data-2)",
  Hybrid: "var(--data-3)",
};

const ORDER: CoasterType[] = ["Steel", "Wooden", "Hybrid"];

export function TypeSplit({ items }: { items: Breakdown[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const total = items.reduce((sum, i) => sum + i.credits, 0);
  const ordered = ORDER.map((type) => items.find((i) => i.label === type)).filter(
    (i): i is Breakdown => Boolean(i),
  );

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Credits by type</h3>
        <span className="text-xs text-[var(--ink-3)]">
          {ordered.length} of 3 types ridden
        </span>
      </header>

      {total === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-3)]">Nothing logged yet.</p>
      ) : (
        <>
          {/* 2px surface gaps separate segments — never a border drawn on them. */}
          <div className="mt-4 flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px]">
            {ordered.map((item) => (
              <div
                key={item.label}
                onMouseEnter={() => setHovered(item.label)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: `${(item.credits / total) * 100}%`,
                  backgroundColor: COLOUR[item.label as CoasterType],
                  opacity: hovered && hovered !== item.label ? 0.45 : 1,
                  transition: "opacity 160ms var(--ease)",
                  animation: "grow-x 700ms var(--ease-out) both",
                  transformOrigin: "left",
                }}
              />
            ))}
          </div>

          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {ordered.map((item) => (
              <li
                key={item.label}
                className="flex items-baseline gap-2"
                onMouseEnter={() => setHovered(item.label)}
                onMouseLeave={() => setHovered(null)}
              >
                <span
                  aria-hidden
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: COLOUR[item.label as CoasterType] }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="tabular text-xs text-[var(--ink-3)]">
                    {item.credits} {item.credits === 1 ? "credit" : "credits"} ·{" "}
                    {Math.round((item.credits / total) * 100)}% · {item.rides}{" "}
                    {item.rides === 1 ? "ride" : "rides"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
