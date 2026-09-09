import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

/**
 * The signed-in user plus their profile row.
 *
 * These helpers keep pages tidy; they are not a security boundary. Even if a
 * page forgot to call them, RLS would still scope every query to the caller.
 *
 * ## Why this is memoised
 *
 * `getUser()` is a network call — it revalidates the JWT against Supabase Auth
 * rather than trusting the cookie — and the profile lookup is a second one. A
 * page and its layout both call requireUser(), so a single navigation was
 * making four round trips to fetch the same two rows, one after another,
 * before any of the page's own queries could start.
 *
 * React's `cache()` memoises for the lifetime of one request, which is exactly
 * the right scope: two components in the same render share the answer, and two
 * different visitors never can. Nothing is cached across requests, so a signed
 * out session is noticed on the next navigation as before.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return profile ? { user, profile } : null;
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
