import { CountUp } from "@/components/count-up";

/**
 * A single number is not a chart — it is a stat tile. Used wherever the story is
 * one figure, so no bar or pie has to stand in for it.
 */
export function StatTile({
  label,
  value,
  hint,
  suffix = "",
  decimals = 0,
  emphasis = false,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  suffix?: string;
  decimals?: number;
  emphasis?: boolean;
  icon?: React.ReactNode;
}) {
  const numeric = typeof value === "number";

  return (
    <div
      className={`card card-lift relative overflow-hidden p-5 ${
        emphasis ? "border-[var(--brand-line)]" : ""
      }`}
    >
      {emphasis && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ backgroundColor: "var(--brand)" }}
        />
      )}

      <div className="flex items-center gap-1.5">
        {icon && <span className="text-[var(--ink-3)]">{icon}</span>}
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
          {label}
        </p>
      </div>

      <p
        className={`display mt-2 font-semibold ${
          emphasis ? "text-[2.75rem]" : "text-[2rem]"
        }`}
        style={emphasis ? { color: "var(--brand)" } : undefined}
      >
        {numeric ? (
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        ) : (
          value
        )}
      </p>

      {hint && <p className="mt-1.5 text-xs leading-snug text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}
