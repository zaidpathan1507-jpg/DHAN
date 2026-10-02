import { AlertTriangle } from "lucide-react";

import { formatINR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import SourceBadge from "../common/SourceBadge.jsx";

function Amount({ t }) {
  const income = t.type === "income";
  return (
    <span className={`num font-extrabold ${income ? "text-gain" : "text-ink"}`}>
      {income ? "+" : "−"}
      {formatINR(t.amount)}
    </span>
  );
}

export default function TransactionTable({ transactions, onSelect }) {
  const { t, tr, formatDate } = useI18n();

  return (
    <>
      {/* Phones: a ledger-style list; a seven-column table would scroll sideways. */}
      <ul className="divide-y divide-surface-border md:hidden">
        {transactions.map((txn) => (
          <li key={txn.id}>
            <button onClick={() => onSelect(txn)} className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">{txn.vendor}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-ink-muted">
                  <span>{formatDate(txn.txn_date, { day: "numeric", month: "short" })}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{tr("cat", txn.category)}</span>
                  {txn.is_anomaly && (
                    <span className="inline-flex items-center gap-1 font-bold text-warn">
                      <AlertTriangle size={12} /> {t("txn.review")}
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right text-[15px]">
                <Amount t={txn} />
                {txn.source === "DEMO" && <p className="mt-0.5 text-[11px] font-bold text-info">{t("common.demo")}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[13px] font-bold text-ink-muted">
              <th scope="col" className="py-3 pr-4">{t("txn.date")}</th>
              <th scope="col" className="py-3 pr-4">{t("txn.vendor")}</th>
              <th scope="col" className="py-3 pr-4">{t("txn.category")}</th>
              <th scope="col" className="py-3 pr-4 text-right">{t("txn.amount")}</th>
              <th scope="col" className="py-3 pr-4">{t("txn.payment")}</th>
              <th scope="col" className="py-3 pr-4">{t("txn.source")}</th>
              <th scope="col" className="py-3 pr-2">{t("txn.status")}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id} className="border-b border-surface-border last:border-0 hover:bg-surface">
                <td className="whitespace-nowrap py-3 pr-4 text-ink-soft">
                  {formatDate(txn.txn_date, { day: "2-digit", month: "short" })}
                </td>
                <td className="max-w-[200px] py-3 pr-4">
                  <button
                    onClick={() => onSelect(txn)}
                    className="block max-w-full truncate rounded text-left font-bold text-ink underline-offset-4 hover:underline"
                  >
                    {txn.vendor}
                  </button>
                </td>
                <td className="py-3 pr-4 text-ink-soft">{tr("cat", txn.category)}</td>
                <td className="py-3 pr-4 text-right">
                  <Amount t={txn} />
                </td>
                <td className="py-3 pr-4 text-ink-soft">{tr("pay", txn.payment_mode)}</td>
                <td className="py-3 pr-4">
                  <SourceBadge source={txn.source} />
                </td>
                <td className="py-3 pr-2">
                  {txn.is_anomaly && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-warn">
                      <AlertTriangle size={13} /> {t("txn.review")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
