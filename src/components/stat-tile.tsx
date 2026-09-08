export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`card p-5 ${emphasis ? "border-[var(--color-accent)]/30" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
        {label}
      </p>
      <p
        className={`tabular mt-1.5 font-semibold tracking-tight ${
          emphasis ? "text-4xl text-[var(--color-accent)]" : "text-3xl"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
}
