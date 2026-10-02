import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import PlanBlock from "./PlanBlock.jsx";

const TONE = { gain: "text-gain", loss: "text-loss", warn: "text-warn", neutral: "text-ink" };

function Cell({ col, value }) {
  const { t, tr, formatDate } = useI18n();
  if (col.kind === "date") return <span className="text-ink-soft">{formatDate(value, { day: "numeric", month: "short" })}</span>;
  if (col.kind === "category") return <span className="text-ink-soft">{tr("cat", value)}</span>;
  if (col.kind === "inr") return <span className={`num font-extrabold ${value > 0 && col.signed ? "text-gain" : "text-ink"}`}>{value < 0 ? "−" : ""}{formatINR(Math.abs(value))}</span>;
  if (col.kind === "days") return value > 0 ? <span className="chip bg-loss-soft px-2 py-0.5 text-loss">{t("ai.late", { n: value })}</span> : <span className="text-ink-muted">—</span>;
  if (col.kind === "count") return <span className="num font-bold text-ink">{value}</span>;
  return <span className="font-bold text-ink">{value}</span>;
}

function Table({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-ink-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`pb-2 pr-3 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-surface-border">
              {columns.map((c) => (
                <td key={c.key} className={`max-w-[132px] truncate py-2 pr-3 sm:max-w-[220px] ${c.align === "right" ? "text-right" : ""}`}>
                  <Cell col={c} value={r[c.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Renders the structured cards a DHAN AI tool produced. These are the real numbers; the chat text is commentary.
export default function AiBlock({ block }) {
  const { tr } = useI18n();
  if (block.type === "plan") return <PlanBlock block={block} />;
  return (
    <section className="mt-3 rounded-xl border border-surface-border bg-surface p-4 animate-fade-up">
      <h4 className="text-sm font-extrabold text-ink">{block.title}</h4>

      {block.type === "metrics" && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {block.items.map((m) => (
              <div key={m.label} className="rounded-lg bg-surface-card px-3 py-2.5 shadow-subtle">
                <dt className="text-xs font-semibold text-ink-muted">{m.label}</dt>
                <dd className={`num mt-0.5 text-lg font-extrabold ${TONE[m.tone] || "text-ink"}`}>{m.kind === "count" ? m.value : formatINR(m.value)}</dd>
                {m.hint && <p className="text-[11px] font-semibold text-ink-muted">{m.hint}</p>}
              </div>
            ))}
          </dl>
          {block.table && block.table.rows.length > 0 && (
            <div className="mt-3 rounded-lg bg-surface-card px-3 py-2 shadow-subtle">
              <Table columns={block.table.columns} rows={block.table.rows} />
            </div>
          )}
        </>
      )}

      {block.type === "bars" && (
        <ul className="mt-3 space-y-2.5">
          {block.rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-bold text-ink">{r.kind === "category" ? tr("cat", r.label) : r.label}</span>
                <span className="num shrink-0 font-extrabold text-ink">{r.unit === "score" ? r.value : formatINR(r.value)} <span className="text-xs font-semibold text-ink-muted">{r.unit === "score" ? "" : `${r.pct}%`}</span></span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-gold-500 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(3, Math.min(100, r.pct))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {block.type === "table" && (
        <div className="mt-3 rounded-lg bg-surface-card px-3 py-2 shadow-subtle">
          <Table columns={block.columns} rows={block.rows} />
        </div>
      )}
    </section>
  );
}
