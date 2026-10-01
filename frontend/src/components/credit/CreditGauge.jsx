const BAND_COLORS = {
  EXCELLENT: "#1F8A56",
  GOOD: "#1F8A56",
  FAIR: "#B8860B",
  "NEEDS WORK": "#C0392B",
};

export default function CreditGauge({ score, band, size = 120 }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = BAND_COLORS[band] || "#1F8A56";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F4F2EE" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-navy tabular-nums">{Math.round(score)}</span>
        <span className="text-[10px] text-navy-soft/60">/ 100</span>
      </div>
    </div>
  );
}
