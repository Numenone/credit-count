export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <span
          className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-3)]"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--ink-3)]">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
