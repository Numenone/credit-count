import type { Breakdown } from "@/lib/stats";

/**
 * Credits grouped by one dimension, as a labelled bar list.
 * Bars are scaled against the largest bucket so the shape is readable at any size.
 */
export function BreakdownList({
  title,
  items,
  limit = 6,
}: {
  title: string;
  items: Breakdown[];
  limit?: number;
}) {
  const shown = items.slice(0, limit);
  const max = shown[0]?.credits ?? 1;
  const hidden = items.length - shown.length;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-ink-faint)]">No rides logged yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {shown.map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-[var(--color-ink-soft)]">{item.label}</span>
                <span className="tabular font-semibold">{item.credits}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[var(--color-canvas)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${Math.max(6, (item.credits / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          +{hidden} more {hidden === 1 ? "entry" : "entries"}
        </p>
      )}
    </div>
  );
}
