import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/session";

/**
 * The signed-in user plus their profile row.
 *
 * These helpers keep pages tidy; they are not a security boundary. Even if a
 * page forgot to call them, RLS would still scope every query to the caller.
 *
 * All three delegate to resolveSession(), which is memoised per request and is
 * also what the API handlers use — see session.ts for why there is exactly one
 * of it.
 */
export const getSessionUser = resolveSession;

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
