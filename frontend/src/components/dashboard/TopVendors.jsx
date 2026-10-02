import { Users } from "lucide-react";

import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";

export default function TopVendors({ data, loading }) {
  const { t } = useI18n();
  const max = data?.[0]?.amount || 1;

  return (
    <div className="card h-full p-5 md:p-6">
      <h2 className="text-lg font-extrabold text-ink">{t("dash.vendors")}</h2>

      {loading ? (
        <Skeleton className="mt-4 h-56 w-full" />
      ) : !data?.length ? (
        <EmptyState icon={Users} title={t("dash.vendorsEmpty")} body={t("dash.vendorsEmptyBody")} />
      ) : (
        <ul className="mt-4 space-y-4">
          {data.slice(0, 6).map((v) => (
            <li key={v.vendor}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[15px] font-bold text-ink">{v.vendor}</p>
                <p className="num shrink-0 text-[15px] font-extrabold text-ink">{formatINR(v.amount)}</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-gold-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(4, (v.amount / max) * 100)}%` }}
                />
              </div>
              <p className="mt-1 flex justify-between text-xs font-semibold text-ink-muted">
                <span>{t(v.count === 1 ? "dash.txnOne" : "dash.txnCount", { n: v.count })}</span>
                <span className="num">{t("dash.ofSpend", { pct: v.pct })}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
