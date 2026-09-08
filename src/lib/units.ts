import type { UnitSystem } from "@/lib/database.types";

/**
 * Presentation-only unit conversion.
 *
 * The database stores SI and nothing else. Converting at render time means two
 * users with different preferences are always looking at the same underlying
 * number, so a leaderboard or a shared stat can never disagree because of a
 * stored unit. The cost is a conversion on every render, which is free.
 */

const M_TO_FT = 3.280839895;
const KM_TO_MI = 0.621371192;

function round(value: number, dp: number) {
  return Number(value.toFixed(dp));
}

/** Formats a number with thousands separators and no trailing zeros. */
function num(value: number, dp = 0) {
  return round(value, dp).toLocaleString("en-GB", { maximumFractionDigits: dp });
}

export function formatHeight(metres: number | null, system: UnitSystem) {
  if (metres == null) return null;
  return system === "imperial" ? `${num(metres * M_TO_FT)} ft` : `${num(metres)} m`;
}

export function formatSpeed(kmh: number | null, system: UnitSystem) {
  if (kmh == null) return null;
  return system === "imperial" ? `${num(kmh * KM_TO_MI)} mph` : `${num(kmh)} km/h`;
}

/**
 * Track length. Short lengths read better in feet/metres, long distances in
 * miles/kilometres, so the unit is chosen by magnitude rather than fixed —
 * "1.2 mi of track" is easier to picture than "6,336 ft".
 */
export function formatLength(metres: number | null, system: UnitSystem) {
  if (metres == null) return null;
  if (system === "imperial") {
    const feet = metres * M_TO_FT;
    return feet >= 5280 ? `${num(feet / 5280, 2)} mi` : `${num(feet)} ft`;
  }
  return metres >= 1000 ? `${num(metres / 1000, 2)} km` : `${num(metres)} m`;
}

/** Cumulative distance, always in the large unit — these totals get big. */
export function formatDistance(metres: number, system: UnitSystem) {
  return system === "imperial"
    ? `${num((metres / 1000) * KM_TO_MI, 1)} mi`
    : `${num(metres / 1000, 1)} km`;
}

/** Cumulative height, always in the small unit — a lift hill is not a marathon. */
export function formatVertical(metres: number, system: UnitSystem) {
  return system === "imperial" ? `${num(metres * M_TO_FT)} ft` : `${num(metres)} m`;
}

export const unitLabels: Record<UnitSystem, { name: string; detail: string }> = {
  metric: { name: "Metric", detail: "metres, kilometres, km/h" },
  imperial: { name: "Imperial", detail: "feet, miles, mph" },
};
