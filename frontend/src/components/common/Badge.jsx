const VARIANTS = {
  neutral: "bg-surface-muted text-navy-soft border-surface-border",
  green: "bg-dhan-green-light text-dhan-green-dark border-dhan-green/20",
  amber: "bg-amber-light text-amber border-amber/25",
  danger: "bg-danger-light text-danger border-danger/20",
  info: "bg-info-light text-info border-info/20",
};

export default function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
