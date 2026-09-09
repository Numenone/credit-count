import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Mascot } from "./mascot";
import { EMOTIONS, type Emotion } from "@/lib/mascot-shared";

/**
 * The rig, asserted on the markup it produces.
 *
 * These cover a class of defect that neither the type checker nor the linter
 * can see, because both were entirely happy with the code that caused it: a CSS
 * animation and a CSS transition writing the same property on the same element.
 * The animation wins, silently, and the transition simply never happens.
 *
 * Two of those shipped. The body picked a different animation per expression,
 * and changing animation-name restarts an animation from frame zero, so the
 * whole character snapped to its rest pose on every emotion change. The ears
 * had an `animation` and a `transform` on one element, so every expression's
 * ear position was discarded — twenty-four poses that were written, rendered,
 * and never once visible.
 *
 * Neither is visible in a diff. Both are obvious in the output.
 */

const render = (emotion: Emotion) => renderToStaticMarkup(createElement(Mascot, { emotion }));

describe("the idle animation", () => {
  it("never changes name between expressions", () => {
    // The rule that matters. Amplitude and duration can vary freely; the name
    // cannot, because changing it restarts the cycle and the body jumps.
    const names = new Set(
      EMOTIONS.map((emotion) => render(emotion).match(/animation:\s*([a-z-]+)\s/)?.[1]),
    );
    expect([...names]).toEqual(["rusty-idle"]);
  });

  it("is never switched off", () => {
    // `animation: none` was the "braced" setting, and it snapped hardest of
    // all: the body jumped from wherever the cycle had it straight to identity.
    for (const emotion of EMOTIONS) {
      expect(render(emotion)).not.toMatch(/animation:\s*none/);
    }
  });

  it("still varies, so the expressions are not all the same", () => {
    const rises = new Set(
      EMOTIONS.map((emotion) => render(emotion).match(/--rusty-rise:\s*([\d.]+)/)?.[1]),
    );
    expect(rises.size).toBeGreaterThan(1);
  });

  it("scales rather than translating", () => {
    // She is a bust cropped at the bottom, and her hem sits on the clip line.
    // A translation pushes the hem through that line and back, so material
    // appears and disappears at an edge — which reads as the drawing changing
    // size, not as breathing. Scaling from the same line pins the hem.
    //
    // Asserted on the values the component supplies, since the keyframes live
    // in the stylesheet: a rise is a scale factor near 1, and a factor with a
    // unit on it would be a translation wearing the wrong name.
    for (const emotion of EMOTIONS) {
      const html = render(emotion);
      const rise = html.match(/--rusty-rise:\s*([^;"]+)/)?.[1];
      const swell = html.match(/--rusty-swell:\s*([^;"]+)/)?.[1];

      expect(rise, `${emotion} has no rise`).toBeDefined();
      expect(swell, `${emotion} has no swell`).toBeDefined();
      // Unitless, so it can only be read as a scale factor.
      expect(rise).toMatch(/^[\d.]+$/);
      expect(swell).toMatch(/^[\d.]+$/);
      // Close to 1. A body that visibly changes size is the thing being fixed.
      expect(Number(rise)).toBeGreaterThanOrEqual(1);
      expect(Number(rise)).toBeLessThan(1.04);
      expect(Number(swell)).toBeGreaterThanOrEqual(1);
      expect(Number(swell)).toBeLessThan(1.02);
      // The chest widens less than the body rises, or she inflates sideways.
      expect(Number(swell)).toBeLessThanOrEqual(Number(rise));
    }
  });
});

describe("no element both animates and transitions its transform", () => {
  it.each(EMOTIONS)("%s", (emotion) => {
    // Parsed out of the rendered style attributes rather than the source, so
    // this catches the conflict wherever it is reintroduced.
    const styles = [...render(emotion).matchAll(/style="([^"]*)"/g)].map((m) => m[1]);

    for (const style of styles) {
      const animates = /animation:/.test(style);
      const posesTransform = /(^|;)transform:/.test(style);
      const transitionsTransform = /transition:[^;]*(transform|all)/.test(style);

      expect(
        animates && (posesTransform || transitionsTransform),
        `an element animates and poses transform at once, so the pose is discarded: ${style}`,
      ).toBe(false);
    }
  });
});

describe("the ear pose survives the swing", () => {
  it("keeps the posed rotation on a different element from the animation", () => {
    const html = render("sheepish");
    expect(html).toMatch(/transform:rotate\(-?[\d.]+deg\);transition:transform/);
    expect(html).toMatch(/animation:rusty-ear/);
  });

  it("poses the ears differently for different expressions", () => {
    // This is what the old rig threw away. If these ever collapse to one value
    // again, the ears have stopped expressing anything.
    const posed = (emotion: Emotion) =>
      render(emotion).match(/transform:rotate\((-?[\d.]+)deg\);transition:transform/)?.[1];

    expect(posed("sheepish")).not.toEqual(posed("thrilled"));
  });

  it("damps a braced expression instead of stopping it", () => {
    const html = render("awestruck");
    expect(html).toMatch(/animation:rusty-ear/);
    expect(html).toMatch(/--ear-swing:0deg/);
  });
});

describe("every expression renders", () => {
  it.each(EMOTIONS)("%s draws a face", (emotion) => {
    const html = render(emotion);
    expect(html).toContain("<svg");
    expect(html).toContain(`looking ${emotion}`);
    // A NaN in any coordinate produces markup that renders as nothing at all,
    // and it is the failure mode of a rig driven by arithmetic.
    expect(html).not.toContain("NaN");
  });
});
