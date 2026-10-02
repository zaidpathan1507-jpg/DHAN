import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { Link } from "react-router-dom";

import Skeleton from "../common/Skeleton.jsx";
import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

const BUCKETS = [["current", "bg-gain"], ["d1_30", "bg-gold-500"], ["d31_60", "bg-warn"], ["d61_plus", "bg-loss"]];

export default function MoneyWaitingCard() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ["receivables"], queryFn: () => api.get("/receivables").then((r) => r.data), refetchInterval: 30000 });
  if (query.isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (query.isError) return null;

  const d = query.data;
  const owed = d.receivable;
  const total = Object.values(owed.aging).reduce((a, b) => a + b, 0) || 1;
  const nextBill = d.items.filter((i) => i.kind === "payable" && !i.paid).sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
  const when = nextBill && (nextBill.days_overdue > 0 ? t("mw.late") : (() => {
    const n = Math.round((new Date(nextBill.due_date) - new Date(new Date().toDateString())) / 864e5);
    return n <= 0 ? t("mw.today") : t("mw.in", { n });
  })());

  return (
    <section className="card flex h-full flex-col p-5 md:p-6" aria-labelledby="mw-title">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><HandCoins size={18} /></span>
        <h2 id="mw-title" className="text-lg font-extrabold text-ink">{t("mw.title")}</h2>
      </div>

      {owed.count === 0 ? (
        <p className="mt-5 text-[15px] text-ink-soft">{t("mw.none")}</p>
      ) : (
        <>
          <p className="num mt-4 text-[34px] font-extrabold leading-none text-gain">{formatINR(owed.total)}</p>
          <p className={`mt-1.5 text-sm font-bold ${owed.overdue ? "text-loss" : "text-ink-muted"}`}>{owed.overdue ? t("mw.overdue", { amount: formatINR(owed.overdue) }) : t("mw.noneOverdue")}</p>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={t("rec.aging")}>
            {BUCKETS.map(([k, color]) => <div key={k} className={color} style={{ width: `${(owed.aging[k] / total) * 100}%` }} />)}
          </div>
        </>
      )}

      {d.recovered?.amount > 0 && (
        <p className="mt-4 rounded-xl bg-gain-soft px-4 py-2.5 text-sm font-extrabold text-gain-ink">{t("rv.title")}: <span className="num">{formatINR(d.recovered.amount)}</span></p>
      )}
      {d.claims_waiting > 0 && (
        <Link to="/receivables" className="mt-4 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-extrabold text-ink">{t("mw.claims", { n: d.claims_waiting })}</Link>
      )}
      {nextBill && (
        <p className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-2.5 text-sm">
          <span className="min-w-0 truncate font-bold text-ink-soft">{t("mw.nextBill", { party: nextBill.party })}</span>
          <span className="num shrink-0 font-extrabold text-ink">{formatINR(nextBill.outstanding)} <span className={`text-xs font-bold ${nextBill.days_overdue ? "text-loss" : "text-ink-muted"}`}>{when}</span></span>
        </p>
      )}
      <Link to="/receivables" className="link mt-auto pt-5 text-sm">{t("mw.cta")}</Link>
    </section>
  );
}
