"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

export interface NavItem {
  href: string;
  label: string;
  accent?: boolean;
}

/**
 * The navigation for narrow screens.
 *
 * Built on <dialog>, so Escape, the backdrop, focus trapping and inertness of
 * the page behind all come from the platform. showModal() is driven from an
 * effect because a declaratively-open dialog is not modal.
 *
 * Links close the panel from their own onClick rather than from an effect
 * watching the route: the close is a consequence of the tap, and expressing it
 * that way avoids a state write during render.
 */
export function MobileNav({ items, signedIn }: { items: NavItem[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="btn btn-quiet !px-2.5 !py-1.5 lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
        </svg>
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        aria-label="Menu"
        className="ml-auto mr-0 mt-0 mb-0 h-full max-h-none w-[min(20rem,86vw)] max-w-none border-l border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-[var(--shadow-lg)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
            <span className="text-sm font-semibold">Menu</span>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close menu"
              className="btn btn-ghost !px-2 !py-1 text-lg leading-none"
            >
              ×
            </button>
          </header>

          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-[0.95rem] font-medium transition-colors"
                      style={{
                        backgroundColor: active ? "var(--brand-soft)" : "transparent",
                        color: active ? "var(--brand)" : item.accent ? "var(--brand)" : "var(--ink-2)",
                      }}
                    >
                      {item.label}
                      {active && <span aria-hidden>·</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <footer className="space-y-3 border-t border-[var(--line)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Theme
              </span>
              <ThemeToggle />
            </div>

            {signedIn ? (
              <form action={signOut}>
                <SubmitButton variant="quiet" className="w-full" pendingLabel="Signing out…">
                  Sign out
                </SubmitButton>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="btn btn-quiet w-full"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full"
                >
                  Sign up
                </Link>
              </div>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
