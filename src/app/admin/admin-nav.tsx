"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/catalogue", label: "Catalogue" },
  { href: "/admin/api", label: "API explorer" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    // No overflow-x here. Setting it makes the browser compute overflow-y as
    // auto too, and the active-tab indicator sits at -bottom-px — just outside
    // the box — which was enough to produce a stray vertical scrollbar. Three
    // tabs wrap perfectly well instead.
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-1 border-b border-[var(--line)]"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors"
            style={{ color: active ? "var(--ink)" : "var(--ink-3)" }}
          >
            {tab.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                style={{ backgroundColor: "var(--brand)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
