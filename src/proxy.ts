import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Per-request security headers.
 *
 * The CSP carries a fresh nonce every request, which the root layout puts on the
 * one inline script the app ships. `strict-dynamic` then means an injected
 * <script> cannot execute even if markup were ever compromised, because it would
 * not carry that request's nonce.
 *
 * style-src keeps 'unsafe-inline' deliberately: the design uses inline style
 * attributes throughout, and nonces do not apply to style attributes — only to
 * <style> elements. Removing it would need every inline style rewritten into
 * classes, for a much smaller win than the script-src restriction buys.
 */
function securityHeaders(nonce: string, supabaseOrigin: string) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}`,
    // The scene is inline SVG and the app embeds nothing, so these can be shut.
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    // Nothing here needs a camera, a microphone or a location.
    "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  };
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : "";

  const response = await updateSession(request, nonce);

  for (const [header, value] of Object.entries(securityHeaders(nonce, supabaseOrigin))) {
    response.headers.set(header, value);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets. The dot before the
    // extension list is escaped — an unescaped `.` would match any character
    // and quietly skip paths that merely end in "asvg", "bpng" and so on.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
