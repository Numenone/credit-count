import type { FormState } from "@/lib/actions/auth";

export function FormMessage({ state }: { state: FormState }) {
  if (!state.error && !state.message) return null;

  const isError = Boolean(state.error);
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-lg px-3 py-2 text-sm ${
        isError
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}
