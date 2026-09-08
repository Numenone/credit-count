import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLink } from "@/components/nav-link";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { CoasterMark } from "@/components/icons";

export async function SiteHeader() {
  const session = await getSessionUser();
  const isAdmin = session?.profile.role === "admin";

  // One list, rendered twice: the inline bar above lg, the drawer below it.
  // Keeping it in one place is what stops the two from drifting apart.
  const items: NavItem[] = [
    ...(session
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/rides", label: "My rides" },
          { href: "/chase", label: "Chase" },
        ]
      : []),
    { href: "/leaderboard", label: "Leaderboard" },
    ...(isAdmin ? [{ href: "/admin", label: "Catalogue", accent: true }] : []),
    ...(session ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-5 2xl:max-w-7xl">
        <Link
          href={session ? "/dashboard" : "/"}
          className="mr-auto flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span className="shrink-0" style={{ color: "var(--brand)" }}>
            <CoasterMark />
          </span>
          <span className="truncate text-[0.95rem] font-semibold tracking-tight">Credit Count</span>
        </Link>

        {/* Inline navigation, desktop and up. */}
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} accent={item.accent}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <ThemeToggle />
          {session ? (
            <form action={signOut}>
              <SubmitButton variant="quiet" className="!px-2.5 !py-1 !text-[0.78rem]" pendingLabel="…">
                Sign out
              </SubmitButton>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost !text-[0.85rem]">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary !px-3 !py-1.5 !text-[0.82rem]">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Below lg the same links live behind one control, so the bar cannot
            overflow no matter how many sections a role can see. */}
        <MobileNav items={items} signedIn={Boolean(session)} />
      </div>
    </header>
  );
}
