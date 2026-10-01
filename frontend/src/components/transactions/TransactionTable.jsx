import { AlertTriangle } from "lucide-react";

import { formatINR } from "../../lib/constants.js";
import SourceBadge from "../common/SourceBadge.jsx";

export default function TransactionTable({ transactions, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-navy-soft/60 border-b border-surface-border">
            <th className="py-3 pr-4">Date</th>
            <th className="py-3 pr-4">Vendor</th>
            <th className="py-3 pr-4">Category</th>
            <th className="py-3 pr-4 text-right">Amount</th>
            <th className="py-3 pr-4 hidden md:table-cell">Payment</th>
            <th className="py-3 pr-4 hidden md:table-cell">Source</th>
            <th className="py-3 pr-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr
              key={t.id}
              onClick={() => onSelect(t)}
              className="border-b border-surface-border last:border-0 hover:bg-surface-muted cursor-pointer transition-colors"
            >
              <td className="py-3 pr-4 text-navy-soft whitespace-nowrap">
                {new Date(t.txn_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </td>
              <td className="py-3 pr-4 font-medium text-navy max-w-[160px] truncate">{t.vendor}</td>
              <td className="py-3 pr-4 text-navy-soft">{t.category}</td>
              <td
                className={`py-3 pr-4 text-right font-semibold tabular-nums ${
                  t.type === "income" ? "text-dhan-green" : "text-navy"
                }`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatINR(t.amount)}
              </td>
              <td className="py-3 pr-4 hidden md:table-cell text-navy-soft">{t.payment_mode}</td>
              <td className="py-3 pr-4 hidden md:table-cell">
                <SourceBadge source={t.source} />
              </td>
              <td className="py-3 pr-2">
                {t.is_anomaly && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber">
                    <AlertTriangle size={12} /> Review
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
