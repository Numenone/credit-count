import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

/**
 * The signed-in user plus their profile row.
 *
 * These helpers keep pages tidy; they are not a security boundary. Even if a page
 * forgot to call them, RLS would still scope every query to the caller.
 */
export async function getSessionUser() {
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
}

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
