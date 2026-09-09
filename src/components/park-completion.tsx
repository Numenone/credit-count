export interface ParkProgress {
  park: string;
  country: string;
  total: number;
  ridden: number;
}

/**
 * How much of each park's catalogue you have ridden.
 *
 * The natural next question after "how many credits do I have" is "what have I
 * missed", and it is the one that turns a log into a plan. Only parks you have
 * been to are shown — a completion bar for somewhere you have never visited is
 * a list of every park in the catalogue, which is not information.
 *
 * The percentage is written next to every bar rather than left to the bar's
 * length, so the reading never depends on comparing two lengths by eye, or on
 * seeing them at all.
 */
export function ParkCompletion({ parks }: { parks: ParkProgress[] }) {
  const visited = parks
    .filter((p) => p.ridden > 0)
    .sort((a, b) => b.ridden / b.total - a.ridden / a.total || b.total - a.total);

  const complete = visited.filter((p) => p.ridden === p.total).length;

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Park completion</h3>
        <span className="text-xs text-[var(--ink-3)]">
          {complete > 0
            ? `${complete} ${complete === 1 ? "park" : "parks"} cleared`
            : `${visited.length} visited`}
        </span>
      </header>

      {visited.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-3)]">
          Log a ride and the park it belongs to appears here, with what is left in it.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visited.slice(0, 8).map((park) => {
            const pct = (park.ridden / park.total) * 100;
            const done = park.ridden === park.total;

            return (
              <li key={`${park.park}-${park.country}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{park.park}</p>
                  <p className="tabular shrink-0 text-xs text-[var(--ink-3)]">
                    {park.ridden} of {park.total}
                    {done && (
                      <span className="ml-1.5" style={{ color: "var(--good)" }}>
                        complete
                      </span>
                    )}
                  </p>
                </div>

                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--surface-sunken)" }}
                  role="img"
                  aria-label={`${park.park}: ${park.ridden} of ${park.total} coasters ridden`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: done ? "var(--good)" : "var(--data-1)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visited.length > 8 && (
        <p className="mt-3 text-xs text-[var(--ink-3)]">
          And {visited.length - 8} more.
        </p>
      )}
    </section>
  );
}
