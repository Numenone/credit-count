import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifiedClaims } from "@/lib/supabase/claims";
import type { Profile } from "@/lib/database.types";

/**
 * The signed-in user plus their profile row.
 *
 * These helpers keep pages tidy; they are not a security boundary. Even if a
 * page forgot to call them, RLS would still scope every query to the caller.
 *
 * ## Why this is memoised
 *
 * The site header and the page both call requireUser(), so a single navigation
 * was fetching the same two rows twice, one after another, before any of the
 * page's own queries could start.
 *
 * React's `cache()` memoises for the lifetime of one request, which is exactly
 * the right scope: two components in the same render share the answer, and two
 * different visitors never can. Nothing survives across requests.
 *
 * The session itself is now verified locally rather than by asking Supabase
 * Auth — see supabase/claims.ts for why that is both much faster and not a
 * weakening.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const claims = await verifiedClaims(supabase);
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .single<Profile>();

  // A deleted user can still hold an unexpired token. No profile row, no
  // session — which is where the app fails closed without asking Auth.
  return profile ? { user: { id: claims.sub, email: claims.email }, profile } : null;
});

export async function requireUser() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.profile.role !== "admin") redirect("/dashboard");
  return session;
}
