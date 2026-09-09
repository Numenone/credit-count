/**
 * Reading a session back to the person who owns it.
 *
 * A device list is only useful if you can recognise your own devices in it, so
 * everything here is about turning machine facts — a user agent string, a
 * timestamp, an IP's country code — into something a person can point at and
 * say "that one, I don't use that any more".
 */

export interface Device {
  session_id: string;
  created_at: string;
  last_active: string;
  user_agent: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
}

/**
 * A readable name for the browser and platform.
 *
 * Deliberately crude. Full user-agent parsing is a library and a losing battle;
 * this only needs to be good enough to tell your phone from your laptop, and it
 * says "Unknown device" rather than guessing when it cannot.
 *
 * Order matters: Edge claims to be Chrome, Chrome claims to be Safari, and
 * Safari claims to be Mozilla. Each check has to run before the one it
 * impersonates.
 */
export function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";

  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\/|Opera/.test(userAgent) ? "Opera"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : null;

  const platform =
    /iPhone/.test(userAgent) ? "iPhone"
    : /iPad/.test(userAgent) ? "iPad"
    : /Android/.test(userAgent) ? "Android"
    : /Mac OS X|Macintosh/.test(userAgent) ? "Mac"
    : /Windows/.test(userAgent) ? "Windows"
    : /Linux/.test(userAgent) ? "Linux"
    : null;

  if (browser && platform) return `${browser} on ${platform}`;
  return browser ?? platform ?? "Unknown device";
}

/** Country codes rendered as flags, purely so the list scans faster. */
export function flagFor(country: string | null) {
  if (!country || country.length !== 2) return "";
  // Regional indicator symbols sit at a fixed offset from A-Z.
  return String.fromCodePoint(
    ...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export function describePlace(device: Device) {
  const parts = [device.city, device.region, device.country].filter(Boolean);
  if (parts.length === 0) return device.ip ? `IP ${device.ip}` : "Location unknown";
  // City and region are often the same string for a city-state or small region.
  return [...new Set(parts)].join(", ");
}

/**
 * How long a session has been connected, in the largest unit that still tells
 * the truth.
 *
 * Days up to a month, then months, then years — because "connected for 400
 * days" makes you do arithmetic to learn the thing you actually wanted to know,
 * which is "over a year".
 *
 * Boundaries are the ones a person would use, not the ones a calendar would: a
 * month is 31 days here and a year is 12 of those, which is what the spec for
 * this asked for and is close enough that nobody will ever notice the drift.
 */
export function connectedFor(since: string, now: number = Date.now()) {
  const started = new Date(since).getTime();
  if (!Number.isFinite(started)) return "unknown";

  const minutes = Math.floor((now - started) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;

  const days = Math.floor(hours / 24);
  if (days <= 31) return `${days} ${days === 1 ? "day" : "days"}`;

  const months = Math.floor(days / 31);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;

  const years = Math.floor(months / 12);
  const spare = months % 12;
  if (spare === 0) return `${years} ${years === 1 ? "year" : "years"}`;
  return `${years} ${years === 1 ? "year" : "years"}, ${spare} ${spare === 1 ? "month" : "months"}`;
}
