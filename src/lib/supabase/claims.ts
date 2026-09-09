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
 * ## What this gives up, and how it is bought back
 *
 * `getUser()` asks "is this token still good RIGHT NOW", so it notices a
 * session signed out elsewhere immediately. Signature verification alone cannot
 * see that: a revoked token stays cryptographically valid until it expires.
 *
 * So the revocation check moved rather than disappearing. The `session_id`
 * claim is carried through below, and `session_user()` in the database returns
 * the profile AND whether that session still exists — in the single round trip
 * the profile lookup was already costing. Signing a device out takes effect on
 * that device's very next request, which is what asking Auth every time bought,
 * at none of the price.
 *
 * The app also fails closed for an unrelated reason: a deleted user has no
 * profile row, and `getSessionUser` returns null without one.
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
  /**
   * Which session minted this token.
   *
   * Carried so a caller can ask whether that session still exists — the one
   * thing local verification cannot see, and what makes signing a device out
   * take effect immediately rather than at the token's expiry.
   */
  sessionId?: string;
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
    try {
      // No jwt argument, so getSession() supplies it — that path also refreshes
      // an expired token from the refresh cookie, which local verification must
      // not skip.
      const { data, error } = await supabase.auth.getClaims(undefined, { jwks });
      if (!error && data?.claims?.sub) {
        return {
          sub: String(data.claims.sub),
          email: data.claims.email as string | undefined,
          sessionId: data.claims.session_id as string | undefined,
        };
      }
      // An invalid signature or a genuinely expired token: no session.
      if (error) return null;
    } catch {
      // getClaims rethrows anything that is not an AuthError, and a malformed
      // token produces exactly that: an `alg: none` header with an empty
      // signature came back as a 500 rather than a 401 until this was here.
      //
      // A token that cannot be parsed is not an exceptional condition, it is an
      // unauthenticated request. Returning null says so, and keeps the failure
      // on the same path as every other bad credential instead of on the one
      // that produces a stack trace and an unhelpful status.
      return null;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // The fallback path has no verified claims to read the session from, so it
  // decodes the token's payload for it. Safe here precisely because getUser()
  // has just vouched for that token.
  const { data: session } = await supabase.auth.getSession();
  let sessionId: string | undefined;
  try {
    const token = session.session?.access_token;
    if (token) {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      );
      sessionId = payload.session_id;
    }
  } catch {
    sessionId = undefined;
  }

  return { sub: user.id, email: user.email, sessionId };
}
