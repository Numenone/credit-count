"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Fades a section up as it scrolls into view.
 *
 * Arming happens in the effect rather than in the initial markup: the content
 * ships visible, and only becomes hidden once we know an observer is watching
 * to reveal it again. A browser without IntersectionObserver, a failed
 * hydration, or a reader with JavaScript off all see the page — the animation
 * is the enhancement, never the gate.
 *
 * The DOM is touched through the ref instead of state, so this never triggers a
 * React render and never fights the server-rendered markup.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;

    node.classList.add("reveal-armed");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          node.style.transitionDelay = `${delay}ms`;
          node.classList.remove("reveal-armed");
          node.classList.add("reveal-in");
          observer.disconnect();
        }
      },
      // Fire a little before the section reaches the fold, so the movement has
      // finished by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
