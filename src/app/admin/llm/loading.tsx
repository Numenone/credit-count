export default function LlmLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the mascot's usage">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-2.5 w-60" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-6 w-14 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-2.5 w-20" />
            <div className="skeleton mt-3 h-10 w-24" />
            <div className="skeleton mt-3 h-2.5 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-4 h-32 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
