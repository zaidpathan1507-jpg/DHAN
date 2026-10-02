export default function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-50 text-gold-700">
          <Icon size={24} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-base font-bold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
