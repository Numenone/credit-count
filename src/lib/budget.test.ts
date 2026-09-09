import { describe, expect, it } from "vitest";
import { budgetUsage } from "./budget";
import { EMOTIONS, MODEL_EMOTIONS } from "./mascot-shared";

describe("budgetUsage", () => {
  it("reports the ordinary case", () => {
    const { percent, over } = budgetUsage(1.25, 5);
    expect(percent).toBe(25);
    expect(over).toBe(false);
  });

  it("treats exactly at the budget as exhausted", () => {
    // The endpoint refuses on `spend >= budget`. If this were `>` the console
    // would say "within budget" about a feature that had already stopped
    // answering, which is the one thing a budget page must not do.
    expect(budgetUsage(5, 5).over).toBe(true);
  });

  it("does not clamp an overspend away", () => {
    // The bar is clamped when it is drawn, but the number is not: a month at
    // 340% of its budget should not be reported as 100%.
    const { percent, over } = budgetUsage(17, 5);
    expect(percent).toBe(340);
    expect(over).toBe(true);
  });

  it("does not divide by a budget of zero", () => {
    // "Spend nothing" is a legitimate setting, and the answer has to be a
    // number rather than Infinity or NaN.
    expect(budgetUsage(0, 0)).toEqual({ fraction: 0, percent: 0, over: false });
    expect(budgetUsage(0.01, 0)).toEqual({ fraction: 1, percent: 100, over: true });
  });

  it("rounds rather than truncates", () => {
    // 99.6% displayed as 99% reads as comfortable when it is not.
    expect(budgetUsage(4.98, 5).percent).toBe(100);
  });
});

describe("MODEL_EMOTIONS", () => {
  it("is every expression except the two the interface owns", () => {
    expect(MODEL_EMOTIONS).toHaveLength(EMOTIONS.length - 2);
    expect(MODEL_EMOTIONS).not.toContain("idle");
    expect(MODEL_EMOTIONS).not.toContain("thinking");
  });

  it("keeps every expression the drawing can render", () => {
    // The response schema is built from this list. Dropping one here silently
    // removes it from the character's range, and nothing else would notice.
    for (const emotion of EMOTIONS) {
      if (emotion === "idle" || emotion === "thinking") continue;
      expect(MODEL_EMOTIONS).toContain(emotion);
    }
  });
});
