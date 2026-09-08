import type { FormState } from "@/lib/actions/auth";

export function FormMessage({ state }: { state: FormState }) {
  if (!state.error && !state.message) return null;

  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className="rounded-lg px-3 py-2 text-sm"
      style={
        isError
          ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" }
          : { backgroundColor: "var(--good-soft)", color: "var(--good)" }
      }
    >
      {state.error ?? state.message}
    </p>
  );
}
