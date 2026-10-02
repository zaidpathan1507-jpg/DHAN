import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import api from "../../lib/apiClient.js";
import { EXPENSE_CATEGORIES, formatINR, INCOME_CATEGORIES, QUERY_KEYS_TO_REFRESH } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { parseStatement } from "../../lib/statementParser.js";
import Modal from "../common/Modal.jsx";
import { useToast } from "../common/Toast.jsx";

export default function ImportModal({ open, onClose }) {
  const { t, tr, formatDate } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);

  const close = () => {
    setRows(null);
    setError(null);
    onClose();
  };

  const importMutation = useMutation({
    mutationFn: () => api.post("/transactions/import", { rows }).then((r) => r.data),
    onSuccess: ({ imported, skipped: dup }) => {
      QUERY_KEYS_TO_REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      showToast(t("imp.done", { imported, skipped: dup }));
      close();
    },
    onError: () => showToast(t("imp.fail"), "error"),
  });

  const readFile = async (file) => {
    if (!file) return;
    const parsed = parseStatement(await file.text());
    if (parsed.error) return setError("imp.errHeader");
    if (!parsed.rows.length) return setError("imp.errEmpty");
    setError(null);
    setSkipped(parsed.skipped);
    setRows(parsed.rows);
  };

  const setCategory = (index, category) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, category } : r)));

  const totalIn = rows?.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalOut = rows?.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0) ?? 0;
  const dates = rows?.map((r) => r.txn_date).sort();

  return (
    <Modal open={open} onClose={close} title={t("imp.title")} maxWidth="sm:max-w-3xl">
      {!rows ? (
        <div>
          <p className="text-[15px] text-ink-soft">{t("imp.body")}</p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              readFile(e.dataTransfer.files[0]);
            }}
            className={`mt-5 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              drag ? "border-gold-500 bg-gold-50" : "border-surface-strong bg-surface"
            }`}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <FileSpreadsheet size={30} strokeWidth={1.75} />
            </div>
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary mt-5">
              <UploadCloud size={18} /> {t("imp.choose")}
            </button>
            <p className="mt-2 text-sm text-ink-muted">{t("imp.drop")}</p>
            <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => readFile(e.target.files[0])} />
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-semibold text-loss">
              {t(error)}
            </p>
          )}
          <a href="/sample-bank-statement.csv" download className="link mt-5 inline-block text-sm">
            {t("imp.sample")}
          </a>
        </div>
      ) : (
        <div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface px-4 py-3">
              <p className="num text-xl font-extrabold text-ink">{t("imp.found", { n: rows.length })}</p>
              <p className="text-sm text-ink-muted">{t("imp.range", { from: formatDate(dates[0]), to: formatDate(dates.at(-1)) })}</p>
            </div>
            <div className="rounded-xl bg-gain-soft px-4 py-3">
              <p className="text-sm font-semibold text-gain-ink">{t("imp.in")}</p>
              <p className="num text-xl font-extrabold text-gain-ink">{formatINR(totalIn)}</p>
            </div>
            <div className="rounded-xl bg-loss-soft px-4 py-3">
              <p className="text-sm font-semibold text-loss">{t("imp.out")}</p>
              <p className="num text-xl font-extrabold text-loss">{formatINR(totalOut)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-soft">{t("imp.review")}</p>
          {skipped > 0 && <p className="mt-1 text-sm text-warn">{t("imp.skippedLines", { n: skipped })}</p>}

          <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-[13px] font-bold text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">{t("txn.date")}</th>
                  <th scope="col" className="px-3 py-2">{t("txn.vendor")}</th>
                  <th scope="col" className="px-3 py-2">{t("txn.category")}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t("txn.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-surface-border">
                    <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{formatDate(r.txn_date)}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 font-bold text-ink">{r.vendor}</td>
                    <td className="px-3 py-1.5">
                      <select
                        aria-label={t("txn.category")}
                        value={r.category}
                        onChange={(e) => setCategory(i, e.target.value)}
                        className="field min-h-[36px] py-1 text-sm"
                      >
                        {(r.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                          <option key={c} value={c}>
                            {tr("cat", c)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`num px-3 py-2 text-right font-extrabold ${r.type === "income" ? "text-gain" : "text-ink"}`}>
                      {r.type === "income" ? "+" : "−"}
                      {formatINR(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setRows(null)} className="link text-sm">
              {t("imp.back")}
            </button>
            <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} className="btn-primary">
              {importMutation.isPending ? t("imp.importing") : t("imp.go", { n: rows.length })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
