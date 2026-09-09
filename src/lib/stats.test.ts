import { describe, expect, it } from "vitest";
import { computeStats, computeMilestones } from "@/lib/stats";
import type { RideWithCoaster } from "@/lib/database.types";

/**
 * The statistics are the product. Everything on the dashboard is derived from
 * computeStats, so a quiet arithmetic error here is a wrong number shown
 * confidently — the worst failure mode this app has.
 */

let seq = 0;

function coaster(over: Partial<RideWithCoaster["coaster"]> = {}) {
  seq += 1;
  return {
    id: `coaster-${seq}`,
    name: `Coaster ${seq}`,
    park: "Test Park",
    country: "Testland",
    manufacturer: "Test Works",
    type: "Steel",
    height_m: 40,
    length_m: 1000,
    speed_kmh: 100,
    inversions: 2,
    opened_year: 2000,
    ...over,
  } as RideWithCoaster["coaster"];
}

function ride(c: RideWithCoaster["coaster"], riddenOn: string): RideWithCoaster {
  seq += 1;
  return {
    id: `ride-${seq}`,
    coaster_id: c!.id,
    ridden_on: riddenOn,
    note: null,
    created_at: `${riddenOn}T12:00:00Z`,
    user_id: "user-1",
    coaster: c,
  } as RideWithCoaster;
}

describe("computeStats", () => {
  it("returns zeroes for an empty history rather than NaN", () => {
    const s = computeStats([]);
    expect(s.credits).toBe(0);
    expect(s.rides).toBe(0);
    expect(s.repeatRatio).toBe(0);
    expect(s.distanceM).toBe(0);
    expect(s.mostRidden).toBeNull();
    expect(s.busiestMonth).toBeNull();
  });

  it("separates credits from rides", () => {
    // A credit is a coaster ridden at least once. Three rides on two coasters
    // is two credits — conflating the two is the single mistake this whole
    // hobby's vocabulary exists to avoid.
    const a = coaster();
    const b = coaster();
    const s = computeStats([
      ride(a, "2026-01-01"),
      ride(a, "2026-01-02"),
      ride(b, "2026-01-03"),
    ]);

    expect(s.credits).toBe(2);
    expect(s.rides).toBe(3);
    expect(s.reRidden).toBe(1);
    expect(s.repeatRatio).toBeCloseTo(1.5, 5);
  });

  it("counts distance, height and inversions per RIDE, not per credit", () => {
    const a = coaster({ length_m: 1000, height_m: 40, inversions: 3 });
    const s = computeStats([ride(a, "2026-01-01"), ride(a, "2026-01-02")]);

    expect(s.distanceM).toBe(2000);
    expect(s.verticalM).toBe(80);
    expect(s.inversions).toBe(6);
  });

  it("treats missing measurements as zero rather than propagating null", () => {
    const bare = coaster({ length_m: null, height_m: null, inversions: null, speed_kmh: null });
    const s = computeStats([ride(bare, "2026-01-01")]);

    expect(s.distanceM).toBe(0);
    expect(s.verticalM).toBe(0);
    expect(s.inversions).toBe(0);
    expect(s.fastest).toBeNull();
  });

  it("counts distinct parks, countries and manufacturers", () => {
    const s = computeStats([
      ride(coaster({ park: "A", country: "UK", manufacturer: "B&M" }), "2026-01-01"),
      ride(coaster({ park: "A", country: "UK", manufacturer: "Intamin" }), "2026-01-02"),
      ride(coaster({ park: "B", country: "Japan", manufacturer: "B&M" }), "2026-01-03"),
    ]);

    expect(s.parks).toBe(2);
    expect(s.countries).toBe(2);
    expect(s.manufacturers).toBe(2);
  });

  it("picks the fastest and the oldest by value, not by order seen", () => {
    const s = computeStats([
      ride(coaster({ name: "Slow", speed_kmh: 80, opened_year: 1990 }), "2026-01-01"),
      ride(coaster({ name: "Fast", speed_kmh: 150, opened_year: 2020 }), "2026-01-02"),
    ]);

    expect(s.fastest?.name).toBe("Fast");
    expect(s.oldest?.year).toBe(1990);
    expect(s.newest?.year).toBe(2020);
  });

  it("keys the activity map by ride date and counts repeats on a day", () => {
    const a = coaster();
    const b = coaster();
    const s = computeStats([
      ride(a, "2026-03-14"),
      ride(b, "2026-03-14"),
      ride(a, "2026-03-15"),
    ]);

    expect(s.activity["2026-03-14"]).toBe(2);
    expect(s.activity["2026-03-15"]).toBe(1);
    expect(s.ridingDays).toBe(2);
    expect(s.busiestDay).toEqual({ date: "2026-03-14", rides: 2 });
  });

  it("groups the busiest month by calendar month", () => {
    const a = coaster();
    const s = computeStats([
      ride(a, "2026-01-05"),
      ride(a, "2026-02-10"),
      ride(a, "2026-02-20"),
    ]);

    expect(s.busiestMonth).toEqual({ month: "2026-02", rides: 2 });
  });

  it("orders breakdowns by credits, descending, and counts rides separately", () => {
    const japan = coaster({ country: "Japan" });
    const s = computeStats([
      ride(coaster({ country: "UK" }), "2026-01-01"),
      ride(japan, "2026-01-02"),
      ride(coaster({ country: "Japan" }), "2026-01-03"),
      // A repeat adds a ride to Japan but not a credit.
      ride(japan, "2026-01-04"),
    ]);

    expect(s.byCountry[0]).toMatchObject({ label: "Japan", credits: 2, rides: 3 });
    expect(s.byCountry[1]).toMatchObject({ label: "UK", credits: 1, rides: 1 });
  });

  it("reports the first and latest ride across an unordered history", () => {
    const a = coaster();
    const s = computeStats([
      ride(a, "2026-05-01"),
      ride(a, "2024-01-01"),
      ride(a, "2025-06-15"),
    ]);

    expect(s.firstRide).toBe("2024-01-01");
    expect(s.latestRide).toBe("2026-05-01");
  });
});

describe("computeMilestones", () => {
  it("earns nothing on an empty history", () => {
    const earned = computeMilestones(computeStats([])).filter((m) => m.earned);
    expect(earned).toHaveLength(0);
  });

  it("earns the first-credit milestone as soon as one ride exists", () => {
    const stats = computeStats([ride(coaster(), "2026-01-01")]);
    expect(computeMilestones(stats).some((m) => m.earned)).toBe(true);
  });

  it("never reports progress above its target", () => {
    const a = coaster();
    const many = Array.from({ length: 40 }, (_, i) =>
      ride(a, `2026-01-${String((i % 28) + 1).padStart(2, "0")}`),
    );
    for (const milestone of computeMilestones(computeStats(many))) {
      expect(milestone.progress).toBeLessThanOrEqual(1);
      expect(milestone.progress).toBeGreaterThanOrEqual(0);
    }
  });
});
