"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/appearance";

type Theme = "light" | "dark" | "system";


/**
 * The theme lives in localStorage and on <html data-theme>, both of which are
 * outside React. useSyncExternalStore is the right way to read that: no effect,
 * no setState-on-mount, and the server snapshot is "system" so the first paint
 * matches what the pre-paint script already applied.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keeps two tabs in sync when one of them changes the theme.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    localStorage.removeItem(THEME_KEY);
  } else {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  // "system" removes the attribute rather than resolving it here, so a user who
  // changes their OS theme mid-session sees the page follow along.
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system" as Theme);

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <SunIcon /> },
    { value: "system", label: "System", icon: <SystemIcon /> },
    { value: "dark", label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] p-0.5"
    >
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className="grid h-6 w-6 place-items-center rounded-full transition-colors"
            style={
              active
                ? {
                    backgroundColor: "var(--surface)",
                    color: "var(--ink)",
                    boxShadow: "var(--shadow-sm)",
                  }
                : { color: "var(--ink-3)" }
            }
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}


function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7" />
    </svg>
  );
}
