function barColor(score) {
  if (score >= 70) return "#1F8A56";
  if (score >= 50) return "#B8860B";
  return "#C0392B";
}

export default function CreditComponents({ components }) {
  return (
    <ul className="space-y-4">
      {components.map((c) => (
        <li key={c.key}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-medium text-navy">{c.label}</span>
            <span className="text-navy-soft/70">
              {c.score} <span className="text-navy-soft/40">· weight {Math.round(c.weight * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${c.score}%`, backgroundColor: barColor(c.score) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
