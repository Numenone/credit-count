"use client";

import { useMemo, useState } from "react";
import type { LeaderboardRow } from "@/lib/database.types";
import { SearchIcon } from "@/components/icons";

/**
 * Deterministic hue from a display name.
 *
 * Purely decorative: the name is always right next to the badge, so colour
 * carries no information and two people sharing a hue costs nothing. Lightness
 * and chroma are fixed so every badge sits in the same contrast band in both
 * themes — the hue is the only thing that varies.
 */
function hueFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundColor: `oklch(0.82 0.09 ${hue})`,
        color: `oklch(0.32 0.09 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Positions four and below.
 *
 * Each row carries a bar scaled against the leader, because a column of numbers
 * makes you do the subtraction yourself. Filtering is client-side over rows
 * already on the page — the leaderboard is capped at 100, so there is nothing
 * to fetch and nothing to tell the server about who you were looking for.
 */
export function LeaderboardTable({
  rows,
  topCredits,
}: {
  rows: LeaderboardRow[];
  topCredits: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.display_name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] p-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an enthusiast…"
            aria-label="Filter the leaderboard by display name"
            className="field !pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nobody listed matches “{query}”.
        </p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">
            Leaderboard positions four and below, ranked by credit count
          </caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-3)]">
              <th scope="col" className="w-16 px-5 py-3 font-semibold">
                Rank
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Enthusiast
              </th>
              <th scope="col" className="w-40 px-5 py-3 text-right font-semibold">
                Credits
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={`${row.display_name}-${row.rank}-${i}`}
                className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                style={{ animation: `rise 420ms var(--ease-out) ${Math.min(i, 12) * 35}ms both` }}
              >
                <td className="tabular px-5 py-3 text-[var(--ink-3)]">{row.rank}</td>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={row.display_name} size={28} />
                    <span className="truncate font-medium">{row.display_name}</span>
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="flex items-center justify-end gap-3">
                    <span className="hidden h-[6px] w-24 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)] sm:block">
                      <span
                        className="block h-full rounded-r-[3px] origin-left"
                        style={{
                          width: `${Math.max(4, (row.credits / Math.max(1, topCredits)) * 100)}%`,
                          backgroundColor: "var(--data-1)",
                          animation: "grow-x 620ms var(--ease-out) both",
                        }}
                      />
                    </span>
                    <span className="tabular w-8 text-right font-semibold">{row.credits}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
