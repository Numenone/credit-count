import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export async function SiteHeader() {
  const session = await getSessionUser();
  const isAdmin = session?.profile.role === "admin";

  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <Link href={session ? "/dashboard" : "/"} className="mr-auto flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-md bg-[var(--color-accent)]"
            style={{ clipPath: "polygon(0 100%, 22% 34%, 46% 62%, 76% 8%, 100% 0, 100% 100%)" }}
          />
          <span className="text-[0.95rem] font-semibold tracking-tight">Credit Count</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-[var(--color-ink-soft)]">
          {session && (
            <>
              <Link href="/dashboard" className="hover:text-[var(--color-ink)]">
                Dashboard
              </Link>
              <Link href="/rides" className="hover:text-[var(--color-ink)]">
                My rides
              </Link>
            </>
          )}
          <Link href="/leaderboard" className="hover:text-[var(--color-ink)]">
            Leaderboard
          </Link>
          {isAdmin && (
            <Link href="/admin" className="font-medium text-[var(--color-accent)]">
              Catalogue
            </Link>
          )}
          {session ? (
            <>
              <Link href="/settings" className="hover:text-[var(--color-ink)]">
                Settings
              </Link>
              <form action={signOut}>
                <SubmitButton variant="quiet" className="!py-1 !text-[0.8rem]" pendingLabel="…">
                  Sign out
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-[var(--color-ink)]">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary !py-1.5 !text-[0.8rem]">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
