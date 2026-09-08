"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Nav item that marks the current section for sighted users and for AT. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative rounded-md px-2.5 py-1.5 transition-colors"
      style={{ color: active ? "var(--ink)" : "var(--ink-3)" }}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-2.5 -bottom-[11px] h-[2px] rounded-full"
          style={{ backgroundColor: "var(--brand)" }}
        />
      )}
    </Link>
  );
}
