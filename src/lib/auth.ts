import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
 * was fetching the same rows twice, one after another, before any of the page's
 * own queries could start. React's `cache()` memoises for exactly one request:
 * two components in the same render share the answer, two visitors never can,
 * and nothing survives across requests.
 *
 * ## Why the session id matters
 *
 * The JWT's signature is verified locally rather than by asking Supabase Auth,
 * which removed a ~250ms round trip per request (see supabase/claims.ts). The
 * one thing that buys back is immediate notice of a revoked session, and this
 * is where it is bought back: `session_user()` returns the profile AND whether
 * that session still exists, in the single round trip the profile lookup was
 * already costing. Signing a device out therefore takes effect on its very next
 * request, not whenever its token happens to expire.
 */
type SessionRow = Profile & { session_live: boolean };

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const claims = await verifiedClaims(supabase);
  if (!claims) return null;

  const { data } = await supabase
    .rpc("session_user", { p_session_id: claims.sessionId ?? null })
    .maybeSingle<SessionRow>();

  // No profile row means a deleted user still holding an unexpired token;
  // session_live false means this device was signed out from another one.
  // Either way there is no session here.
  if (!data || !data.session_live) return null;

  // session_live is a signal, not part of the profile the app carries around.
  const profile: Profile = {
    id: data.id,
    display_name: data.display_name,
    role: data.role,
    leaderboard_opt_in: data.leaderboard_opt_in,
    unit_system: data.unit_system,
    created_at: data.created_at,
  };

  // Where this session is being used from, for the device list in settings.
  // Fire and forget: the write is guarded in Postgres so it is a no-op unless
  // the row is stale, and a page render must not wait on bookkeeping.
  if (claims.sessionId) void recordPlace(supabase, claims.sessionId);

  return { user: { id: claims.sub, email: claims.email }, profile };
});

/**
 * Records the edge's guess at where the request came from.
 *
 * Sign-in happens directly between the browser and Supabase, so our servers
 * never see it and Supabase never sees our edge's geolocation. This is the only
 * point where the two facts meet.
 */
async function recordPlace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  try {
    const h = await headers();
    await supabase.rpc("record_session_place", {
      p_session_id: sessionId,
      p_country: h.get("x-vercel-ip-country"),
      p_city: decodeMaybe(h.get("x-vercel-ip-city")),
      p_region: h.get("x-vercel-ip-country-region"),
    });
  } catch {
    // Never worth failing a page render over.
  }
}

/** The edge percent-encodes city names, so "S%C3%A3o%20Paulo" arrives as such. */
function decodeMaybe(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
