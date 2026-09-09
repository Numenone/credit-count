import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { verifiedClaims } from "@/lib/supabase/claims";
import type { Profile } from "@/lib/database.types";

/**
 * Resolving who is asking — once, for every entry point.
 *
 * This exists because splitting it was a bug. The revocation check lived in the
 * page helper and the API helper had its own, simpler path, so signing a device
 * out took effect on pages and did nothing to the API: a revoked session could
 * still read every endpoint until its token expired. Two code paths to the same
 * question will drift, and the one that drifts is never the one you are looking
 * at.
 *
 * There is now one. Everything that needs to know who is signed in comes
 * through here.
 *
 * ## What it costs
 *
 * One database round trip, which is the one the profile lookup was already
 * costing. `session_user()` returns the profile and whether the session still
 * exists together, so the liveness check is free.
 *
 * The signature itself is verified in-process against the project's ES256
 * public keys rather than by asking Supabase Auth, which is what makes this
 * cheap enough to do on every request. See supabase/claims.ts.
 */

type SessionRow = Profile & { session_live: boolean };

export interface ResolvedSession {
  user: { id: string; email?: string };
  profile: Profile;
  sessionId?: string;
}

export const resolveSession = cache(async (): Promise<ResolvedSession | null> => {
  const supabase = await createClient();
  const claims = await verifiedClaims(supabase);
  if (!claims) return null;

  const { data } = await supabase
    .rpc("session_user", { p_session_id: claims.sessionId ?? null })
    .maybeSingle<SessionRow>();

  // No row means a deleted user still holding an unexpired token. session_live
  // false means this device was signed out from another one. Either way there
  // is no session here, and the caller must not be told otherwise.
  if (!data || !data.session_live) return null;

  // Where this session is being used from, for the device list in settings.
  // Fired without awaiting: the write is guarded in Postgres to a no-op unless
  // the row is stale, and no request should wait on bookkeeping.
  if (claims.sessionId) void recordPlace(supabase, claims.sessionId);

  return {
    user: { id: claims.sub, email: claims.email },
    sessionId: claims.sessionId,
    profile: {
      id: data.id,
      display_name: data.display_name,
      role: data.role,
      leaderboard_opt_in: data.leaderboard_opt_in,
      unit_system: data.unit_system,
      created_at: data.created_at,
    },
  };
});

/**
 * Records the edge's guess at where the request came from.
 *
 * Sign-in happens directly between the browser and Supabase, so our servers
 * never see it and Supabase never sees our edge's geolocation. This is the only
 * point at which the two facts meet.
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
    // Never worth failing a request over.
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
