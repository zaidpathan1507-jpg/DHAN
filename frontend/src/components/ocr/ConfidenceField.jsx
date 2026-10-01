export default function ConfidenceField({ label, confidence, children }) {
  const low = confidence !== undefined && confidence !== null && confidence < 70;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70">{label}</label>
        {confidence !== undefined && confidence !== null && confidence > 0 && (
          <span className={`text-[11px] font-medium ${low ? "text-amber" : "text-dhan-green"}`}>
            {low ? "Please check" : `${Math.round(confidence)}% confidence`}
          </span>
        )}
      </div>
      <div className={low ? "ring-1 ring-amber rounded-xl" : ""}>{children}</div>
    </div>
  );
}
