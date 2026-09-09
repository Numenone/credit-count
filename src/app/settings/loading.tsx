export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your settings">
      <div className="space-y-2">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-9 w-40" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <div className="skeleton h-3 w-36" />
          <div className="skeleton h-2.5 w-64" />
          <div className="skeleton h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
