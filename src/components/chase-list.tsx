"use client";

import { useMemo, useState } from "react";
import type { Coaster, UnitSystem } from "@/lib/database.types";
import { formatHeight, formatSpeed } from "@/lib/units";
import { CoasterName } from "@/components/coaster-details";
import { SearchIcon, PinIcon } from "@/components/icons";

type SortKey = "park" | "height" | "speed" | "newest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "park", label: "By park" },
  { key: "height", label: "Tallest first" },
  { key: "speed", label: "Fastest first" },
  { key: "newest", label: "Newest first" },
];

/**
 * The unridden catalogue, grouped by park.
 *
 * Grouping is the point: a credit counter travels to parks, not to coasters, so
 * "Alton Towers — 3 left" is the actionable unit. Filtering happens in the
 * browser because the whole remaining list is already on the page; a round trip
 * per keystroke would be slower and would tell the server what you are planning.
 */
export function ChaseList({
  coasters,
  unitSystem,
}: {
  coasters: Coaster[];
  unitSystem: UnitSystem;
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<SortKey>("park");

  const countries = useMemo(
    () => [...new Set(coasters.map((c) => c.country))].sort(),
    [coasters],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coasters.filter((c) => {
      if (country && c.country !== country) return false;
      if (type && c.type !== type) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.park.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q)
      );
    });
  }, [coasters, query, country, type]);

  const groups = useMemo(() => {
    if (sort !== "park") return null;
    const map = new Map<string, Coaster[]>();
    for (const coaster of filtered) {
      const key = `${coaster.park}|${coaster.country}`;
      map.set(key, [...(map.get(key) ?? []), coaster]);
    }
    // Parks with the most credits left first — that is where a trip pays off.
    return [...map.entries()]
      .map(([key, list]) => ({ park: key.split("|")[0], country: key.split("|")[1], list }))
      .sort((a, b) => b.list.length - a.list.length || a.park.localeCompare(b.park));
  }, [filtered, sort]);

  const flat = useMemo(() => {
    if (sort === "park") return [];
    const value = (c: Coaster) =>
      sort === "height"
        ? Number(c.height_m ?? 0)
        : sort === "speed"
          ? Number(c.speed_kmh ?? 0)
          : Number(c.opened_year ?? 0);
    return [...filtered].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
  }, [filtered, sort]);

  const row = (coaster: Coaster) => (
    <li
      key={coaster.id}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line)] px-5 py-3 transition-colors last:border-0 hover:bg-[var(--surface-2)]"
    >
      <div className="mr-auto min-w-0">
        <p className="text-sm font-medium">
          <CoasterName coaster={coaster} />
        </p>
        <p className="truncate text-xs text-[var(--ink-3)]">
          {sort === "park"
            ? `${coaster.manufacturer} · ${coaster.type}`
            : `${coaster.park} · ${coaster.country} · ${coaster.manufacturer}`}
        </p>
      </div>
      <span className="tabular shrink-0 text-xs text-[var(--ink-3)]">
        {[formatHeight(coaster.height_m, unitSystem), formatSpeed(coaster.speed_kmh, unitSystem)]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-2 p-4">
        <div className="relative min-w-[14rem] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by coaster, park, country or manufacturer…"
            aria-label="Filter the chase list"
            className="field !pl-9"
          />
        </div>

        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Country"
          className="field !w-auto"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Coaster type"
          className="field !w-auto"
        >
          <option value="">All types</option>
          {["Steel", "Wooden", "Hybrid"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort order"
          className="field !w-auto"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-[var(--ink-3)]" role="status">
        <span className="tabular font-medium text-[var(--ink-2)]">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "coaster" : "coasters"} shown
      </p>

      {groups
        ? groups.map((group) => (
            <section key={`${group.park}-${group.country}`} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ink-3)]">
                    <PinIcon size={13} />
                  </span>
                  <h2 className="text-sm font-semibold">{group.park}</h2>
                  <span className="text-xs text-[var(--ink-3)]">{group.country}</span>
                </div>
                <span className="chip chip-brand">
                  {group.list.length} {group.list.length === 1 ? "credit" : "credits"} left
                </span>
              </header>
              <ul>{group.list.map(row)}</ul>
            </section>
          ))
        : flat.length > 0 && <ul className="card overflow-hidden">{flat.map(row)}</ul>}

      {filtered.length === 0 && (
        <div className="card px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches those filters.
        </div>
      )}
    </div>
  );
}
