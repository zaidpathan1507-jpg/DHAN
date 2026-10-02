import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import api from "../../lib/apiClient.js";
import { formatINR, QUERY_KEYS_TO_REFRESH } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import Badge from "../common/Badge.jsx";
import Drawer from "../common/Drawer.jsx";
import SourceBadge from "../common/SourceBadge.jsx";
import { useToast } from "../common/Toast.jsx";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

export default function TransactionDrawer({ transaction, onClose }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t, tr, formatDate } = useI18n();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/transactions/${transaction.id}`),
    onSuccess: () => {
      QUERY_KEYS_TO_REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      showToast(t("txn.deleted"));
      onClose();
    },
    onError: () => showToast(t("txn.deleteFail"), "error"),
  });

  if (!transaction) return null;
  const income = transaction.type === "income";

  return (
    <Drawer open={!!transaction} onClose={onClose} title={t("txn.details")}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-ink-muted">{t("txn.amount")}</p>
          <p className={`num text-[40px] font-extrabold leading-tight ${income ? "text-gain" : "text-ink"}`}>
            {income ? "+" : "−"}
            {formatINR(transaction.amount)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SourceBadge source={transaction.source} />
          {transaction.is_anomaly && <Badge variant="amber">{t("txn.flagged")}</Badge>}
          {transaction.category_method && <Badge variant="neutral">{transaction.category_method}</Badge>}
        </div>

        <dl className="space-y-3 text-[15px]">
          <Row label={t("txn.vendor")} value={transaction.vendor} />
          <Row label={t("txn.category")} value={tr("cat", transaction.category)} />
          <Row label={t("txn.date")} value={formatDate(transaction.txn_date, { day: "numeric", month: "long", year: "numeric" })} />
          <Row label={t("txn.paymentMode")} value={tr("pay", transaction.payment_mode)} />
          {transaction.gstin && <Row label={t("txn.gstin")} value={transaction.gstin} />}
          {transaction.description && <Row label={t("txn.description")} value={transaction.description} />}
        </dl>

        <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="btn-danger w-full">
          <Trash2 size={16} /> {deleteMutation.isPending ? t("txn.deleting") : t("txn.delete")}
        </button>
      </div>
    </Drawer>
  );
}
