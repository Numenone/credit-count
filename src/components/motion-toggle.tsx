"use client";

import { useSyncExternalStore } from "react";
import { MOTION_KEY } from "@/lib/appearance";


/**
 * Motion preference — on for everyone by default, off only when the reader
 * turns it off here.
 *
 * This is a deliberate product decision and it has a cost worth naming: the
 * usual behaviour is to follow the operating system's `prefers-reduced-motion`
 * setting, which people enable for migraine and vestibular reasons. Defaulting
 * to motion overrides that until they find this switch. The mitigation is that
 * the switch is one click, is stored per device, and is stated plainly below.
 *
 * The preference lives on <html data-motion>, which is what the stylesheet
 * reads, so toggling it never re-renders the page.
 */
export type MotionPreference = "full" | "reduced";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): MotionPreference {
  return localStorage.getItem(MOTION_KEY) === "reduced" ? "reduced" : "full";
}

function setPreference(value: MotionPreference) {
  const root = document.documentElement;
  if (value === "reduced") {
    root.setAttribute("data-motion", "reduced");
    localStorage.setItem(MOTION_KEY, "reduced");
  } else {
    root.removeAttribute("data-motion");
    localStorage.removeItem(MOTION_KEY);
  }
  listeners.forEach((l) => l());
}

export function MotionToggle() {
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "full" as MotionPreference,
  );

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={preference === "reduced"}
          onChange={(e) => setPreference(e.target.checked ? "reduced" : "full")}
          className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
        />
        <span>
          <span className="block text-sm font-medium">Reduce motion</span>
          <span className="mt-1 block text-xs leading-relaxed text-[var(--ink-2)]">
            Animations are on by default: counting figures, bars growing in, and the ride above the
            footer. Tick this to stop all of it. Saved on this device, not to your account.
          </span>
        </span>
      </label>
    </div>
  );
}

