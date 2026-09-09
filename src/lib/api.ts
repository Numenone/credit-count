import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/session";

/**
 * Shared plumbing for the /api/v1 route handlers.
 *
 * Every handler runs the caller's own Supabase session — the same anon key and
 * the same RLS policies the pages use. There is no privileged path here: an
 * endpoint cannot return more than the caller could already read, so the API
 * surface adds convenience, not authority.
 */

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      // Responses are per-user by construction; caching them anywhere shared
      // would be a privacy bug rather than a performance win.
      "Cache-Control": "no-store",
    },
  });
}

export function apiError(message: string, status: number, detail?: string) {
  return json({ error: { message, detail, status } }, status);
}

/** Maps Postgres error codes onto honest HTTP statuses. */
export function fromPostgrest(error: PostgrestError) {
  if (error.code === "23505") return apiError("Conflict", 409, "That record already exists.");
  if (error.code === "23503") return apiError("Conflict", 409, "Referenced by existing rides.");
  if (error.code === "42501") return apiError("Forbidden", 403, "Not permitted.");
  if (error.code === "23514") return apiError("Unprocessable entity", 422, "A value is out of range.");
  // RLS refusing an insert surfaces as this code.
  if (error.code === "42P01" || error.message.includes("row-level security")) {
    return apiError("Forbidden", 403, "Row-level security refused this operation.");
  }
  return apiError("Bad request", 400, error.message);
}

/**
 * The caller's client and identity.
 *
 * Goes through resolveSession() — the same path the pages use — rather than
 * verifying claims on its own. Having its own, simpler path was a real bug:
 * the revocation check lived in the page helper, so signing a device out took
 * effect on pages and did nothing here, and a revoked session could still read
 * every endpoint until its token expired.
 */
export async function getAuthedClient() {
  const supabase = await createClient();
  const session = await resolveSession();
  return { supabase, user: session?.user ?? null };
}

/**
 * The same, plus the profile — which resolveSession() already fetched, so this
 * costs nothing beyond it. It used to make a second query for a row it had just
 * been handed.
 */
export async function requireProfile() {
  const supabase = await createClient();
  const session = await resolveSession();
  if (!session) return { supabase, user: null, profile: null };
  return { supabase, user: session.user, profile: session.profile };
}

export const unauthorised = () =>
  apiError("Unauthorised", 401, "Sign in first — this endpoint needs a session.");

/** Reads a JSON body, returning null rather than throwing on malformed input. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
