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
 * whole character snapped to its rest pose on every emotion change — the body
 * has no idle animation at all now, for reasons the first test gives. The ears
 * had an `animation` and a `transform` on one element, so every expression's
 * ear position was discarded — twenty-four poses that were written, rendered,
 * and never once visible.
 *
 * Neither is visible in a diff. Both are obvious in the output.
 */

const render = (emotion: Emotion) => renderToStaticMarkup(createElement(Mascot, { emotion }));

describe("the body itself does not move", () => {
  it("carries no animation on the root group", () => {
    // Removed after three attempts, each of which read as a fault rather than
    // as life. She is a bust cropped at the bottom, so anything applied to the
    // whole figure shows at the crop: swapping animation names snapped her,
    // translating pushed her hem through the clip line, and scaling from the
    // hem pinned that edge and still looked wrong.
    //
    // The root group is the first <g> after the defs. If an animation ever
    // returns to it, this is the test that should be argued with rather than
    // deleted.
    for (const emotion of EMOTIONS) {
      const root = render(emotion).match(/<\/defs>\s*(<g[^>]*>)/)?.[1];
      expect(root, `${emotion} has no root group`).toBeDefined();
      expect(root).not.toMatch(/animation/);
      expect(root).not.toMatch(/transform/);
    }
  });

  it("keeps the parts moving, so she is not a still image", () => {
    // The blink and the ear swing are what carry life now. Losing them by
    // accident while removing the body motion would be the obvious next
    // mistake, and it would leave a drawing rather than a character.
    const html = render("idle");
    expect(html).toMatch(/animation:rusty-blink/);
    expect(html).toMatch(/animation:rusty-ear/);
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
