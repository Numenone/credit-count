import { describe, expect, it } from "vitest";
import {
  formatDistance,
  formatHeight,
  formatLength,
  formatSpeed,
  formatVertical,
} from "@/lib/units";

/**
 * Unit conversion. Cheap to test and expensive to get wrong: a coaster's height
 * in the wrong system is a number that still looks plausible.
 */

describe("metric", () => {
  it("keeps metres and km/h as given", () => {
    expect(formatHeight(72, "metric")).toBe("72 m");
    expect(formatSpeed(150, "metric")).toBe("150 km/h");
    expect(formatLength(850, "metric")).toBe("850 m");
  });

  it("switches track length to the large unit by magnitude", () => {
    // Deliberate: "1.2 km of track" is easier to picture than "1,200 m", and
    // the threshold is why this is not just formatHeight with another label.
    expect(formatLength(1200, "metric")).toBe("1.2 km");
    expect(formatLength(999, "metric")).toBe("999 m");
  });

  it("switches distance to kilometres once it is worth it", () => {
    expect(formatDistance(6300, "metric")).toBe("6.3 km");
  });
});

describe("imperial", () => {
  it("converts height to feet", () => {
    // 72 m is 236 ft. A conversion that is silently the wrong way round still
    // produces a believable number, which is why this is asserted rather than
    // eyeballed.
    expect(formatHeight(72, "imperial")).toBe("236 ft");
  });

  it("converts speed to miles per hour", () => {
    expect(formatSpeed(150, "imperial")).toBe("93 mph");
  });

  it("converts long distances to miles", () => {
    expect(formatDistance(6300, "imperial")).toBe("3.9 mi");
  });

  it("switches track length to miles only past a mile of track", () => {
    expect(formatLength(2000, "imperial")).toBe("1.24 mi");
    expect(formatLength(1000, "imperial")).toBe("3,281 ft");
  });

  it("converts cumulative height to feet", () => {
    expect(formatVertical(261, "imperial")).toBe("856 ft");
  });
});

describe("missing values", () => {
  it("returns null rather than a zero that reads as a measurement", () => {
    // "0 m" on a coaster with no recorded height is a lie; nothing is the truth.
    expect(formatHeight(null, "metric")).toBeNull();
    expect(formatSpeed(null, "imperial")).toBeNull();
    expect(formatLength(null, "metric")).toBeNull();
  });
});
