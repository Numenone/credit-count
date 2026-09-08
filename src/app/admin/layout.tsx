import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";
import { LockIcon } from "@/components/icons";

/**
 * Gate for every /admin route.
 *
 * Putting requireAdmin here rather than in each page means a new admin page is
 * protected by existing, not by remembering. It is still only a redirect — the
 * database refuses an enthusiast's writes whether or not this file exists.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile } = await requireAdmin();

  return (
    <div className="space-y-6">
      <header className="rise">
        <span className="chip chip-brand">
          <LockIcon size={11} />
          Admin console
        </span>
        <h1 className="display mt-2.5 text-3xl font-semibold sm:text-4xl">
          Catalogue &amp; system
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-2)]">
          Signed in as {profile.display_name}. Administrators curate the shared catalogue and can
          exercise the API — they cannot read anyone&apos;s ride history, including from here.
        </p>
      </header>

      <AdminNav />

      {children}
    </div>
  );
}
