import { useQuery } from "@tanstack/react-query";
import { CircleAlert, HandCoins, Hand, MessageSquareText, Receipt, Send, ShieldQuestion, Store } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import PayModal from "../../components/customer/PayModal.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Skeleton from "../../components/common/Skeleton.jsx";
import { relativeTime } from "../../components/udhaar/udhaarUi.js";
import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useAuth } from "../../lib/AuthContext.jsx";

const ACT_ICON = { sent: Send, msg: MessageSquareText, payment: Receipt, claim_confirmed: Receipt, claim_rejected: Hand, dispute_resolved: ShieldQuestion };

export function InvoiceChips({ v }) {
  const { t, formatDate } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {v.days_overdue > 0 && <span className="chip bg-loss-soft px-2 py-0.5 text-loss">{t("cu.late", { n: v.days_overdue })}</span>}
      {v.failed && <span className="chip bg-loss-soft px-2 py-0.5 text-loss"><CircleAlert size={12} /> {t("cu.failedChip")}</span>}
      {v.disputed && <span className="chip bg-warn-soft px-2 py-0.5 text-warn">{t("cu.under")}</span>}
      {v.promise_date && !v.disputed && <span className="chip bg-info-soft px-2 py-0.5 text-info">{t("cu.promised", { date: formatDate(v.promise_date, { day: "numeric", month: "short" }) })}</span>}
    </span>
  );
}

export default function CustomerHome() {
  const { t, locale, formatDate } = useI18n();
  const { user } = useAuth();
  const [paying, setPaying] = useState(null);
  const query = useQuery({ queryKey: ["customer", "overview"], queryFn: () => api.get("/customer/overview").then((r) => r.data), refetchInterval: 8000 });

  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-44 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;
  const { totals, shops, activity } = query.data;
  const firstName = (user?.name || "").split(" ")[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-ink p-5 text-white shadow-hero md:p-7" aria-label={t("cu.owe")}>
        <p className="text-[15px] font-semibold text-white/70">{t("cu.hello", { name: firstName })}</p>
        {totals.open === 0 ? (
          <>
            <h1 className="mt-2 text-2xl font-extrabold">{t("cu.allClear")}</h1>
            <p className="mt-1 text-[15px] text-white/70">{t("cu.allClearBody")}</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-bold text-white/70">{t("cu.owe")}</p>
            <h1 className="num text-[44px] font-extrabold leading-none md:text-[52px]">{formatINR(totals.outstanding)}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-white/70">
              <span>{totals.open === 1 ? t("cu.across1") : t("cu.across", { n: totals.open })}</span>
              <span className={totals.overdue ? "rounded-full bg-loss-soft px-2.5 py-0.5 font-bold text-loss" : "text-white/70"}>{totals.overdue ? t("cu.overdue", { amount: formatINR(totals.overdue) }) : t("cu.onTime")}</span>
            </p>
          </>
        )}
      </section>

      {totals.failed > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-loss-soft p-4 text-loss">
          <CircleAlert size={22} className="mt-0.5 shrink-0" />
          <div><p className="text-[15px] font-extrabold">{t("cu.failedBanner")}</p><p className="text-sm font-semibold">{t("cu.failedBannerBody")}</p></div>
        </div>
      )}

      {shops.length > 0 && (
        <section aria-labelledby="cu-shops" className="space-y-4">
          <h2 id="cu-shops" className="text-lg font-extrabold text-ink">{t("cu.shops")}</h2>
          {shops.map((s) => (
            <article key={s.shop.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3.5 md:px-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><Store size={19} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-base font-extrabold text-ink">{s.shop.name}</p><p className="text-xs text-ink-muted">{s.shop.city}</p></div>
                <p className="num text-lg font-extrabold text-ink">{formatINR(s.outstanding)}</p>
              </div>
              <ul className="divide-y divide-surface-border">
                {s.open.map((v) => (
                  <li key={v.id} className="px-4 py-3.5 md:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/c/invoice/${v.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-ink">{v.note || t("cu.view")}</p>
                        <p className="text-sm text-ink-muted">{t("cu.due", { date: formatDate(v.due_date) })}</p>
                        <span className="mt-1.5 block"><InvoiceChips v={v} /></span>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="num text-[17px] font-extrabold text-ink">{formatINR(v.outstanding)}</p>
                        <button onClick={() => setPaying(v)} className="btn-primary min-h-[40px] px-4 py-2">{v.failed ? t("cu.retry") : t("cu.pay")}</button>
                      </div>
                    </div>
                  </li>
                ))}
                {s.settled.length > 0 && (
                  <li className="bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted md:px-5">
                    {t("cu.settled")}: {s.settled.map((v) => formatINR(v.amount)).join(" · ")}
                  </li>
                )}
              </ul>
            </article>
          ))}
        </section>
      )}

      <section className="card p-4 md:p-5" aria-labelledby="cu-act">
        <h2 id="cu-act" className="flex items-center gap-2 text-base font-extrabold text-ink"><HandCoins size={18} className="text-gold-700" /> {t("cu.activity")}</h2>
        {!activity.length ? <p className="mt-3 text-sm text-ink-soft">{t("cu.activityNone")}</p> : (
          <ul className="mt-3 space-y-1">
            {activity.map((a, i) => {
              const Icon = ACT_ICON[a.type] || Send;
              return (
                <li key={i}>
                  <Link to={`/c/invoice/${a.invoice_id}`} className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-soft"><Icon size={16} /></span>
                    <span className="min-w-0"><span className="block text-[15px] font-semibold text-ink">{t(`cu.act.${a.type}`, { shop: a.shop, text: a.params.text, amount: formatINR(a.params.amount) })}</span><span className="block text-xs text-ink-muted">{relativeTime(a.at, locale)}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {shops.length === 0 && <div className="card"><EmptyState icon={Store} title={t("cu.allClear")} body={t("cu.allClearBody")} /></div>}
      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
