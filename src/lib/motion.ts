/**
 * Whether motion should be suppressed right now.
 *
 * Mirrors the stylesheet exactly: animation is on for everyone unless the
 * reader has switched it off in Settings. A JS check that disagreed with the
 * CSS would leave half the page animating and the other half frozen.
 */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.motion === "reduced";
}
