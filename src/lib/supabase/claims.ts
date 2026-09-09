import type { JWK, SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifying the session without asking Supabase Auth.
 *
 * ## The problem
 *
 * `getUser()` is an HTTP call to Supabase Auth on every single request, and it
 * happens twice per navigation — once in the proxy to decide whether to
 * redirect, once again while rendering. Measured against the deployment, an
 * endpoint doing ONE trivial query cost the same as the entire dashboard:
 * ~880ms, of which roughly 590 was those two auth calls. Authentication was the
 * page load.
 *
 * ## The change
 *
 * This project signs its JWTs with ES256, so the signature can be checked
 * locally against the project's public keys. `getClaims()` does exactly that —
 * given the JWKS, it decodes the token, validates `exp`, and verifies the
 * signature with WebCrypto. No network.
 *
 * The JWKS is cached here at module scope rather than left to the client's own
 * cache, because a new Supabase client is constructed per request and would
 * start with an empty one — refetching the keys every time and reintroducing
 * the round trip this exists to remove. A warm function instance fetches them
 * once.
 *
 * ## What this gives up, and why that is the right trade
 *
 * `getUser()` asks "is this token still good RIGHT NOW", so it notices a
 * session signed out elsewhere immediately. Local verification does not: a
 * revoked token keeps working until it expires.
 *
 * That sounds like a weakening, and it is not, because PostgREST — the thing
 * that actually enforces row-level security — validates the JWT the same way:
 * signature and expiry, locally, with no revocation check. The application
 * layer was being stricter than the data layer at a cost of half a second per
 * request, while the database was always going to honour that token anyway.
 * Making the two agree does not widen what anyone can reach.
 *
 * Where it genuinely matters, the app still fails closed for a different
 * reason: a deleted user has no profile row, and `getSessionUser` returns null
 * when the profile is missing.
 */

interface Jwks {
  keys: JWK[];
}

/** Refetched on a warm instance no more often than this. */
const JWKS_TTL_MS = 10 * 60 * 1000;

let cached: { jwks: Jwks; at: number } | null = null;
let inFlight: Promise<Jwks | null> | null = null;

async function getJwks(): Promise<Jwks | null> {
  const now = Date.now();
  if (cached && now - cached.at < JWKS_TTL_MS) return cached.jwks;

  // A single flight, so a burst of concurrent requests on a cold instance
  // fetches the keys once rather than once each.
  inFlight ??= (async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } },
      );
      if (!response.ok) return null;
      const jwks = (await response.json()) as Jwks;
      if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) return null;
      cached = { jwks, at: Date.now() };
      return jwks;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export interface SessionClaims {
  sub: string;
  email?: string;
}

/**
 * The signed-in user's claims, verified locally.
 *
 * Falls back to `getUser()` when the keys cannot be fetched or the token turns
 * out to be symmetric — slower, but correct, and never silently unverified.
 */
export async function verifiedClaims(
  supabase: SupabaseClient,
): Promise<SessionClaims | null> {
  const jwks = await getJwks();

  if (jwks) {
    // No jwt argument, so getSession() supplies it — that path also refreshes
    // an expired token from the refresh cookie, which local verification must
    // not skip.
    const { data, error } = await supabase.auth.getClaims(undefined, { jwks });
    if (!error && data?.claims?.sub) {
      return { sub: String(data.claims.sub), email: data.claims.email as string | undefined };
    }
    // An invalid signature or a genuinely expired token: no session.
    if (error) return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { sub: user.id, email: user.email } : null;
}
