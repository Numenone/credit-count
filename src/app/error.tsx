"use client";

import Link from "next/link";

/**
 * Route-level error boundary. Deliberately shows no message from the error
 * object: a Postgres or PostgREST string can name tables, columns and policies,
 * and this page is reachable by anyone. The digest is enough to find it in logs.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rise mx-auto max-w-md py-16 text-center">
      <h1 className="display text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">
        That page could not be loaded. Your data is untouched — nothing was saved or changed by
        this error.
      </p>
      {error.digest && (
        <p className="mt-4 text-xs text-[var(--ink-3)]">
          Reference <code className="tabular">{error.digest}</code>
        </p>
      )}
      <div className="mt-7 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-quiet">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
