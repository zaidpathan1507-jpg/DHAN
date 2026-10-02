import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, Check, CheckCheck, Send, X } from "lucide-react";
import { useState } from "react";

import api from "../../lib/apiClient.js";
import { formatINR, QUERY_KEYS_TO_REFRESH } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useCanEdit } from "../../lib/useRole.js";

const ICON = { send_reminders: Send, delay_bill: CalendarClock, enable_auto_remind: BellRing };

function actionText(a, t, formatDate) {
  const p = a.params;
  const short = (d) => formatDate(d, { day: "numeric", month: "short" });
  if (a.type === "send_reminders") return { title: t("act.send_reminders", { n: p.ids.length, amount: formatINR(p.total) }), detail: p.parties.slice(0, 3).join(", ") + (p.parties.length > 3 ? ` +${p.parties.length - 3}` : "") };
  if (a.type === "delay_bill") return { title: t("act.delay_bill", { party: p.party, to: short(p.to), from: short(p.from) }), detail: t("act.delay_billDetail", { amount: formatINR(p.amount) }) };
  return { title: t("act.enable_auto_remind", { n: p.ids.length }), detail: p.parties.slice(0, 3).join(", ") + (p.parties.length > 3 ? ` +${p.parties.length - 3}` : "") };
}

function resultText(a, t, formatDate) {
  const r = a.result || {};
  if (a.type === "send_reminders") return t("act.result.send_reminders", { sent: r.sent, total: r.total });
  if (a.type === "delay_bill") return t("act.result.delay_bill", { date: formatDate(r.new_due, { day: "numeric", month: "short" }) });
  return t("act.result.enable_auto_remind", { n: r.enabled });
}

// DHAN AI proposes, you approve. Nothing runs until Approve is tapped, and every approval is written to the activity log.
export default function PlanBlock({ block }) {
  const { t, formatDate } = useI18n();
  const canEdit = useCanEdit();
  const queryClient = useQueryClient();
  const [actions, setActions] = useState(block.actions);
  const imp = block.impact;

  const refresh = () => ["receivables", "cash-calendar", "customers", "audit", ...QUERY_KEYS_TO_REFRESH].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const merge = (updated) => setActions((cur) => cur.map((a) => updated.find((u) => u.id === a.id) || a));
  const approve = useMutation({ mutationFn: (id) => api.post(`/ai/actions/${id}/approve`).then((r) => [r.data]), onSuccess: (u) => { merge(u); refresh(); } });
  const skip = useMutation({ mutationFn: (id) => api.post(`/ai/actions/${id}/skip`).then((r) => [r.data]), onSuccess: merge });
  const approveAll = useMutation({
    mutationFn: () => api.post("/ai/actions/approve-all", { ids: actions.filter((a) => a.status === "pending").map((a) => a.id) }).then((r) => r.data.filter((x) => x.id)),
    onSuccess: (u) => { merge(u); refresh(); },
  });

  const pending = actions.filter((a) => a.status === "pending");
  const lift = imp ? imp.after_lowest - imp.before_lowest : 0;
  const max = imp ? Math.max(imp.before_lowest, imp.after_lowest, imp.buffer, 1) : 1;
  const bar = (v) => `${Math.max(2, Math.min(100, (Math.max(v, 0) / max) * 100))}%`;

  return (
    <section className="mt-3 rounded-xl border border-gold-500/60 bg-gold-50 p-4 animate-fade-up" aria-label={t("act.title")}>
      <h4 className="text-sm font-extrabold text-ink">{t("act.title")}</h4>

      <ul className="mt-3 space-y-2">
        {actions.map((a) => {
          const Icon = ICON[a.type] || Send;
          const txt = actionText(a, t, formatDate);
          const done = a.status === "executed";
          return (
            <li key={a.id} className={`rounded-xl bg-surface-card p-3.5 shadow-subtle ${a.status === "skipped" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? "bg-gain-soft text-gain-ink" : "bg-gold-100 text-gold-700"}`}>{done ? <Check size={18} strokeWidth={3} /> : <Icon size={17} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-snug text-ink">{txt.title}</p>
                  {txt.detail && <p className="mt-0.5 text-sm text-ink-muted">{txt.detail}</p>}
                  {done && <p className="mt-1 text-sm font-bold text-gain">{resultText(a, t, formatDate)}</p>}
                  {a.status === "failed" && <p className="mt-1 text-sm font-bold text-loss">{t("act.failed")}</p>}
                </div>
                {a.status === "pending" && canEdit && (
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => approve.mutate(a.id)} disabled={approve.isPending || approveAll.isPending} className="btn-primary min-h-[40px] px-3 py-2"><Check size={16} strokeWidth={3} /> {t("act.approve")}</button>
                    <button onClick={() => skip.mutate(a.id)} aria-label={t("act.skip")} title={t("act.skip")} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted"><X size={17} /></button>
                  </div>
                )}
                {a.status === "skipped" && <span className="chip shrink-0 bg-surface-muted px-2 py-0.5 text-ink-muted">{t("act.skipped")}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {imp && (
        <div className="mt-3 rounded-xl bg-surface-card p-3.5 shadow-subtle">
          {[["act.before", imp.before_lowest, "bg-loss"], ["act.after", imp.after_lowest, imp.resolves ? "bg-gain" : "bg-gold-500"]].map(([k, v, color]) => (
            <div key={k} className="mb-2 last:mb-0">
              <div className="flex justify-between text-sm"><span className="font-semibold text-ink-soft">{t(k)}</span><span className={`num font-extrabold ${v < 0 ? "text-loss" : "text-ink"}`}>{formatINR(v)}</span></div>
              <div className="relative mt-1 h-2.5 rounded-full bg-surface-muted">
                <div className={`h-full rounded-full ${color} transition-[width] duration-700`} style={{ width: bar(v) }} />
                <span className="absolute inset-y-[-3px] w-0.5 bg-ink/60" style={{ left: bar(imp.buffer) }} title="buffer" />
              </div>
            </div>
          ))}
          <p className={`mt-2 text-sm font-bold ${imp.resolves ? "text-gain" : lift > 0 ? "text-warn" : "text-ink-muted"}`}>{imp.resolves ? t("act.resolves") : t("act.stillTight")}</p>
          <p className="mt-1 text-xs text-ink-muted">{t("act.assume")}</p>
        </div>
      )}

      {pending.length > 1 && canEdit && (
        <button onClick={() => approveAll.mutate()} disabled={approveAll.isPending} className="btn-ink mt-3 w-full"><CheckCheck size={17} /> {t("act.approveAll")}</button>
      )}
    </section>
  );
}
