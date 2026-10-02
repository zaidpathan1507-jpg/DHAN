import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Users } from "lucide-react";
import { useState } from "react";

import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import Drawer from "../common/Drawer.jsx";
import EmptyState from "../common/EmptyState.jsx";

const LABEL_STYLE = {
  reliable: ["bg-gain-soft text-gain-ink", "#0F7B58"],
  late: ["bg-gold-100 text-gold-700", "#D9990B"],
  risky: ["bg-loss-soft text-loss", "#B42318"],
};

function ScoreBar({ score, label }) {
  const { t } = useI18n();
  return (
    <div className="w-full" role="img" aria-label={t("ud.score", { n: score })}>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: LABEL_STYLE[label][1] }} />
      </div>
    </div>
  );
}

function Detail({ c, onClose, onNewEntry }) {
  const { t, formatDate } = useI18n();
  const items = useQuery({ queryKey: ["receivables"], queryFn: () => api.get("/receivables").then((r) => r.data) });
  const open = items.data?.items.filter((i) => c.open_ids.includes(i.id)) ?? [];

  return (
    <Drawer open onClose={onClose} title={c.party}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`chip px-3 py-1 text-sm ${LABEL_STYLE[c.label][0]}`}>{t(`ud.label.${c.label}`)}</span>
          <span className="num text-sm font-bold text-ink-soft">{t("ud.score", { n: c.score })}</span>
          <span className="text-sm text-ink-muted">{t("ud.invoices", { n: c.invoices })}</span>
        </div>
        <ScoreBar score={c.score} label={c.label} />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface p-3">
            <dt className="text-xs font-semibold text-ink-muted">{t("ud.openInvoices")}</dt>
            <dd className="num text-lg font-extrabold text-ink">{formatINR(c.outstanding)}</dd>
          </div>
          <div className="rounded-xl bg-gold-50 p-3">
            <dt className="text-xs font-semibold text-gold-700">{t("ud.suggestedLimit")}</dt>
            <dd className="num text-lg font-extrabold text-ink">{c.suggested_limit == null ? "—" : formatINR(c.suggested_limit)}</dd>
          </div>
        </dl>
        <p className="-mt-3 text-xs text-ink-muted">{c.suggested_limit == null ? t("ud.noLimit") : t("ud.suggestedLimitHint")}{c.over_limit ? ` · ${t("ud.overLimit")}` : ""}</p>

        <button onClick={() => onNewEntry(c)} className="btn-primary w-full">
          <Plus size={17} strokeWidth={2.5} /> {t("ud.newForCustomer")}
        </button>

        {open.length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-extrabold text-ink">{t("ud.openInvoices")}</h3>
            <ul className="divide-y divide-surface-border">
              {open.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="block font-bold text-ink">{i.note || t("rec.dueOn", { date: formatDate(i.due_date) })}</span>
                    <span className={`text-xs ${i.days_overdue ? "font-bold text-loss" : "text-ink-muted"}`}>
                      {i.days_overdue ? t("rec.late", { n: i.days_overdue }) : t("rec.dueOn", { date: formatDate(i.due_date) })}
                    </span>
                  </span>
                  <span className="num font-extrabold text-ink">{formatINR(i.outstanding)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-base font-extrabold text-ink">{t("ud.history")}</h3>
          {!c.history.length ? (
            <p className="text-sm text-ink-soft">{t("ud.noHistory")}</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-ink-soft">
                {t("ud.avgLate", { n: c.avg_days_late })} · {t("ud.onTimeRate", { n: c.on_time_rate })}
              </p>
              <ul className="divide-y divide-surface-border">
                {c.history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="num font-bold text-ink">{formatINR(h.amount)}</span>
                    <span className={`chip px-2.5 py-0.5 ${h.days_late <= 3 ? "bg-gain-soft text-gain-ink" : h.days_late <= 15 ? "bg-gold-100 text-gold-700" : "bg-loss-soft text-loss"}`}>
                      {h.days_late <= 3 ? t("ud.onTime") : t("ud.daysLate", { n: h.days_late })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-xl bg-surface p-4">
          <h3 className="text-sm font-extrabold text-ink">{t("ud.howScored")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t("ud.howScoredBody")}</p>
        </section>
      </div>
    </Drawer>
  );
}

export default function CustomersTab({ onNewEntry }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/receivables/customers").then((r) => r.data) });
  const list = query.data ?? [];

  return (
    <section>
      <h2 className="text-lg font-extrabold text-ink">{t("ud.custTitle")}</h2>
      <p className="mb-4 mt-0.5 text-[15px] text-ink-soft">{t("ud.custSub")}</p>
      {!list.length ? (
        <div className="card"><EmptyState icon={Users} title={t("ud.custEmpty")} body={t("ud.custEmptyBody")} /></div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.key}>
              <button onClick={() => setSelected(c)} className="card block w-full p-4 text-left transition-shadow hover:shadow-card md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-ink">{c.party}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {c.history.length ? t("ud.avgLate", { n: c.avg_days_late }) : t("ud.noHistory")}
                    </p>
                  </div>
                  <span className={`chip shrink-0 px-2.5 py-0.5 ${LABEL_STYLE[c.label][0]}`}>{t(`ud.label.${c.label}`)}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ScoreBar score={c.score} label={c.label} />
                  <span className="num shrink-0 text-sm font-extrabold text-ink">{c.score}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="num text-lg font-extrabold text-ink">{formatINR(c.outstanding)}</p>
                    {c.overdue > 0 && <p className="num text-xs font-bold text-loss">{t("rec.overdue", { amount: formatINR(c.overdue) })}</p>}
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft">
                    {c.over_limit && <span className="chip bg-loss-soft px-2 py-0.5 text-loss">{t("ud.overLimit")}</span>}{t("ud.suggestedLimit")} <span className="num text-ink">{c.suggested_limit == null ? "—" : formatINR(c.suggested_limit)}</span> <ChevronRight size={16} />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && <Detail c={selected} onClose={() => setSelected(null)} onNewEntry={(c) => { setSelected(null); onNewEntry(c); }} />}
    </section>
  );
}
