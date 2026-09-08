"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Counts a number up on mount.
 *
 * Server-renders the final value, so the real number is in the HTML for anyone
 * without JavaScript and for screen readers reading before hydration. Honours
 * prefers-reduced-motion by skipping the animation entirely rather than
 * shortening it — a number ticking is motion whether it takes 900ms or 90ms.
 */
export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // `display` already holds the final value, so the reduced-motion path is
    // simply "do nothing" — no state write, no render.
    if (prefersReducedMotion() || value === 0) return;

    // The reset to 0 happens inside the first frame rather than here: at t≈0 the
    // eased value is ≈0, so the animation starts from zero without the effect
    // body writing state synchronously.
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo — fast then settling, so the final value feels arrived-at
      // rather than stopped.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span suppressHydrationWarning>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
