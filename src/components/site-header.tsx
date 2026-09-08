import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLink } from "@/components/nav-link";
import { CoasterMark } from "@/components/icons";

export async function SiteHeader() {
  const session = await getSessionUser();
  const isAdmin = session?.profile.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
        <Link
          href={session ? "/dashboard" : "/"}
          className="mr-auto flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span style={{ color: "var(--brand)" }}>
            <CoasterMark />
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight">Credit Count</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {session && (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/rides">My rides</NavLink>
              <NavLink href="/chase">Chase</NavLink>
            </>
          )}
          <NavLink href="/leaderboard">Leaderboard</NavLink>
          {isAdmin && <NavLink href="/admin">Catalogue</NavLink>}
          {session && <NavLink href="/settings">Settings</NavLink>}
        </nav>

        <div className="flex items-center gap-2.5">
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
      </div>
    </header>
  );
}
