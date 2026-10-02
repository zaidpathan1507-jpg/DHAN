const VARIANTS = {
  neutral: "bg-surface-muted text-ink-soft",
  green: "bg-gain-soft text-gain-ink",
  amber: "bg-warn-soft text-warn",
  danger: "bg-loss-soft text-loss",
  info: "bg-info-soft text-info",
  gold: "bg-gold-100 text-gold-700",
};

export default function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}
