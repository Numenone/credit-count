import { describe, expect, it } from "vitest";
import { connectedFor, describeDevice, describePlace, flagFor } from "@/lib/devices";

const NOW = Date.UTC(2026, 8, 9, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("connectedFor", () => {
  it("counts minutes and hours before it reaches days", () => {
    expect(connectedFor(ago(30 * MINUTE), NOW)).toBe("30 minutes");
    expect(connectedFor(ago(5 * HOUR), NOW)).toBe("5 hours");
  });

  it("uses days up to and including a month", () => {
    expect(connectedFor(ago(DAY), NOW)).toBe("1 day");
    expect(connectedFor(ago(31 * DAY), NOW)).toBe("31 days");
  });

  it("switches to months past 31 days", () => {
    // The whole point of the rule: "connected for 400 days" makes you do
    // arithmetic to learn the thing you wanted, which is "over a year".
    expect(connectedFor(ago(32 * DAY), NOW)).toBe("1 month");
    expect(connectedFor(ago(100 * DAY), NOW)).toBe("3 months");
  });

  it("switches to years past twelve months", () => {
    expect(connectedFor(ago(372 * DAY), NOW)).toBe("1 year");
    expect(connectedFor(ago(800 * DAY), NOW)).toBe("2 years, 1 month");
  });

  it("singularises every unit", () => {
    expect(connectedFor(ago(MINUTE), NOW)).toBe("1 minute");
    expect(connectedFor(ago(HOUR), NOW)).toBe("1 hour");
    expect(connectedFor(ago(DAY), NOW)).toBe("1 day");
    expect(connectedFor(ago(32 * DAY), NOW)).toBe("1 month");
    expect(connectedFor(ago(372 * DAY), NOW)).toBe("1 year");
  });

  it("says something sensible for a session created moments ago", () => {
    expect(connectedFor(ago(2000), NOW)).toBe("just now");
  });

  it("does not throw on an unparseable timestamp", () => {
    expect(connectedFor("not a date", NOW)).toBe("unknown");
  });
});

describe("describeDevice", () => {
  it("names the browsers that impersonate each other correctly", () => {
    // Edge claims to be Chrome, Chrome claims to be Safari, Safari claims to be
    // Mozilla. Each has to be checked before the one it pretends to be.
    const edge =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edg/120";
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
    const safari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    expect(describeDevice(edge)).toBe("Edge on Windows");
    expect(describeDevice(chrome)).toBe("Chrome on Mac");
    expect(describeDevice(safari)).toBe("Safari on iPhone");
  });

  it("recognises Firefox on Android", () => {
    expect(describeDevice("Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0")).toBe(
      "Firefox on Android",
    );
  });

  it("says it does not know rather than guessing", () => {
    expect(describeDevice(null)).toBe("Unknown device");
    expect(describeDevice("curl/8.4.0")).toBe("Unknown device");
  });
});

describe("describePlace", () => {
  it("reads city first and drops repeats", () => {
    expect(
      describePlace({ city: "Lisbon", region: "Lisbon", country: "PT" } as never),
    ).toBe("Lisbon, PT");
  });

  it("falls back to the IP, then to saying nothing is known", () => {
    expect(
      describePlace({ city: null, region: null, country: null, ip: "203.0.113.4" } as never),
    ).toBe("IP 203.0.113.4");
    expect(
      describePlace({ city: null, region: null, country: null, ip: null } as never),
    ).toBe("Location unknown");
  });
});

describe("flagFor", () => {
  it("maps a country code to its flag", () => {
    expect(flagFor("BR")).toBe("🇧🇷");
    expect(flagFor("gb")).toBe("🇬🇧");
  });

  it("returns nothing for anything that is not a country code", () => {
    expect(flagFor(null)).toBe("");
    expect(flagFor("USA")).toBe("");
  });
});
