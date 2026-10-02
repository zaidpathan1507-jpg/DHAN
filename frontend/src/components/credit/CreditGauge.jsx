import { useI18n } from "../../lib/i18n.jsx";

export const BAND_COLORS = {
  EXCELLENT: "#0F7B58",
  GOOD: "#0F7B58",
  FAIR: "#D9990B",
  "NEEDS WORK": "#B42318",
};

export const BAND_CHIP = {
  EXCELLENT: "bg-gain-soft text-gain-ink",
  GOOD: "bg-gain-soft text-gain-ink",
  FAIR: "bg-gold-100 text-gold-700",
  "NEEDS WORK": "bg-loss-soft text-loss",
};

// Band edges used by the backend: 50 / 70 / 85. Ticks make the scale readable, not decorative.
const TICKS = [50, 70, 85];

export default function CreditGauge({ score, band, width = 220 }) {
  const { t } = useI18n();
  const r = 78;
  const cx = 100;
  const cy = 100;
  const length = Math.PI * r;
  const offset = length * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = BAND_COLORS[band] || "#0B1B2B";
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const tick = (v) => {
    const a = Math.PI * (1 - v / 100);
    const p = (rad) => [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
    const [x1, y1] = p(r - 12);
    const [x2, y2] = p(r + 12);
    return { x1, y1, x2, y2 };
  };

  return (
    <div className="relative" style={{ width }} role="img" aria-label={`${Math.round(score)} / 100, ${t(`band.${band}`)}`}>
      <svg viewBox="0 0 200 118" width={width}>
        <path d={arc} fill="none" stroke="#ECEAE2" strokeWidth="14" strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
        {TICKS.map((v) => {
          const { x1, y1, x2, y2 } = tick(v);
          return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeWidth="2.5" />;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="num text-[44px] font-extrabold leading-none text-ink">{Math.round(score)}</span>
        <span className="mt-1 text-xs font-semibold text-ink-muted">{t("cr.outOf")}</span>
      </div>
    </div>
  );
}
