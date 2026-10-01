import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import api from "../../lib/apiClient.js";
import { formatINR } from "../../lib/constants.js";
import { useToast } from "../common/Toast.jsx";
import Drawer from "../common/Drawer.jsx";
import SourceBadge from "../common/SourceBadge.jsx";
import Badge from "../common/Badge.jsx";

const INVALIDATE_KEYS = [
  "dashboard-overview",
  "dashboard-cashflow",
  "dashboard-spending-mix",
  "dashboard-top-vendors",
  "transactions",
  "insights",
  "forecast",
  "credit-readiness",
];

export default function TransactionDrawer({ transaction, onClose }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/transactions/${transaction.id}`),
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      showToast("Transaction deleted");
      onClose();
    },
    onError: () => showToast("Couldn't delete transaction.", "error"),
  });

  if (!transaction) return null;

  return (
    <Drawer open={!!transaction} onClose={onClose} title="Transaction Details">
      <div className="space-y-5">
        <div>
          <p className="text-xs text-navy-soft/60">Amount</p>
          <p className={`text-3xl font-bold tabular-nums ${transaction.type === "income" ? "text-dhan-green" : "text-navy"}`}>
            {transaction.type === "income" ? "+" : "-"}
            {formatINR(transaction.amount)}
          </p>
        </div>

        <div className="flex gap-2">
          <SourceBadge source={transaction.source} />
          {transaction.is_anomaly && <Badge variant="amber">Flagged for review</Badge>}
          {transaction.category_method && <Badge variant="neutral">{transaction.category_method}</Badge>}
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Vendor" value={transaction.vendor} />
          <Row label="Category" value={transaction.category} />
          <Row
            label="Date"
            value={new Date(transaction.txn_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          />
          <Row label="Payment Mode" value={transaction.payment_mode} />
          {transaction.gstin && <Row label="GSTIN" value={transaction.gstin} />}
          {transaction.description && <Row label="Description" value={transaction.description} />}
        </dl>

        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="btn-danger w-full"
        >
          <Trash2 size={15} /> {deleteMutation.isPending ? "Deleting..." : "Delete Transaction"}
        </button>
      </div>
    </Drawer>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border pb-3">
      <dt className="text-navy-soft/70">{label}</dt>
      <dd className="font-medium text-navy text-right">{value}</dd>
    </div>
  );
}
