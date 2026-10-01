import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt, Search } from "lucide-react";
import { useState } from "react";

import TransactionDrawer from "../components/transactions/TransactionDrawer.jsx";
import TransactionTable from "../components/transactions/TransactionTable.jsx";
import AddTransactionModal from "../components/transactions/AddTransactionModal.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import api from "../lib/apiClient.js";
import { EXPENSE_CATEGORIES, formatINR, INCOME_CATEGORIES } from "../lib/constants.js";

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const query = useQuery({
    queryKey: ["transactions", search, category, type],
    queryFn: () =>
      api
        .get("/transactions", {
          params: {
            q: search || undefined,
            category: category || undefined,
            type: type || undefined,
          },
        })
        .then((r) => r.data),
  });

  const total = query.data?.items?.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold text-navy">Transactions</h1>
          {query.data && <p className="text-sm text-navy-soft mt-0.5">Net: {formatINR(total)}</p>}
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-soft/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor..."
            className="w-full rounded-xl border border-surface-border bg-surface-card pl-9 pr-3 py-2 text-sm text-navy focus:border-dhan-green outline-none"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm text-navy focus:border-dhan-green outline-none"
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm text-navy focus:border-dhan-green outline-none"
        >
          <option value="">All categories</option>
          {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => (
            <option key={c} value={c}>
              {c}
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
            title="No financial activity recorded."
            body="Add your first transaction to get started."
            action={
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus size={15} /> Add your first transaction
              </button>
            }
          />
        ) : (
          <TransactionTable transactions={query.data.items} onSelect={setSelected} />
        )}
      </div>

      <TransactionDrawer transaction={selected} onClose={() => setSelected(null)} />
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
