import { useQuery } from "@tanstack/react-query";
import { FileUp, Plus, Receipt, Search } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import ImportModal from "../components/transactions/ImportModal.jsx";
import TransactionDrawer from "../components/transactions/TransactionDrawer.jsx";
import TransactionTable from "../components/transactions/TransactionTable.jsx";
import api from "../lib/apiClient.js";
import { EXPENSE_CATEGORIES, formatINR, INCOME_CATEGORIES } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";
import { useCanEdit } from "../lib/useRole.js";

export default function Transactions() {
  const { t, tr } = useI18n();
  const { openAdd } = useOutletContext();
  const canEdit = useCanEdit();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const query = useQuery({
    queryKey: ["transactions", search, category, type],
    queryFn: () =>
      api
        .get("/transactions", {
          params: { q: search || undefined, category: category || undefined, type: type || undefined },
        })
        .then((r) => r.data),
  });

  const net = query.data?.items?.reduce((sum, x) => sum + (x.type === "income" ? x.amount : -x.amount), 0);

  const types = [
    { k: "", label: t("txn.allTypes") },
    { k: "income", label: t("common.income") },
    { k: "expense", label: t("common.expense") },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("txn.title")}
        subtitle={query.data ? t("txn.net", { amount: formatINR(net) }) : undefined}
        action={
          canEdit && <div className="flex flex-wrap gap-2">
            <button onClick={() => setImportOpen(true)} className="btn-secondary">
              <FileUp size={17} /> {t("imp.btn")}
            </button>
            <button onClick={openAdd} className="btn-primary hidden md:inline-flex">
              <Plus size={18} strokeWidth={2.5} /> {t("txn.add")}
            </button>
          </div>
        }
      />

      <div className="card flex flex-wrap items-center gap-3 p-3 md:p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            aria-label={t("txn.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("txn.search")}
            className="field pl-10"
          />
        </div>

        <div role="radiogroup" aria-label={t("txn.status")} className="inline-flex rounded-xl bg-surface-muted p-1">
          {types.map(({ k, label }) => (
            <button
              key={k}
              role="radio"
              aria-checked={type === k}
              onClick={() => setType(k)}
              className={`min-h-[38px] rounded-lg px-3.5 text-sm font-bold transition-colors ${
                type === k ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          aria-label={t("txn.category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="field w-full sm:w-auto sm:min-w-[200px]"
        >
          <option value="">{t("txn.allCategories")}</option>
          {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => (
            <option key={c} value={c}>
              {tr("cat", c)}
            </option>
          ))}
        </select>
      </div>

      <div className="card p-4 md:p-6">
        {query.isLoading ? (
          <SkeletonCard lines={6} />
        ) : query.isError ? (
          <ErrorState onRetry={query.refetch} />
        ) : !query.data?.items?.length ? (
          <EmptyState
            icon={Receipt}
            title={t("txn.empty")}
            body={t("txn.emptyBody")}
            action={
              canEdit && (
                <button onClick={openAdd} className="btn-primary">
                  <Plus size={17} strokeWidth={2.5} /> {t("txn.addFirst")}
                </button>
              )
            }
          />
        ) : (
          <TransactionTable transactions={query.data.items} onSelect={setSelected} />
        )}
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <TransactionDrawer transaction={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
