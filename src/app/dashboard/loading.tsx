export default function DashboardLoading() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading your dashboard">
      <div className="space-y-2">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-9 w-56" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-2.5 w-20" />
            <div className="skeleton mt-3 h-10 w-16" />
            <div className="skeleton mt-3 h-2.5 w-28" />
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="skeleton h-9 w-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="skeleton h-3 w-32" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="skeleton h-6 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
