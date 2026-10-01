export default function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-navy-soft">
          <Icon size={22} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-sm font-semibold text-navy">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-navy-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
