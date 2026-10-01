import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useState } from "react";

import api from "../../lib/apiClient.js";
import { useToast } from "../common/Toast.jsx";
import Modal from "../common/Modal.jsx";
import BillCapture from "../ocr/BillCapture.jsx";
import OCRProcessing from "../ocr/OCRProcessing.jsx";
import TransactionForm from "./TransactionForm.jsx";

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

export default function AddTransactionModal({ open, onClose }) {
  const [type, setType] = useState("expense");
  const [mode, setMode] = useState("manual");
  const [ocrStage, setOcrStage] = useState("capture");
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState(null);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const reset = () => {
    setMode("manual");
    setOcrStage("capture");
    setOcrResult(null);
    setOcrError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/transactions", payload),
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      showToast("Transaction saved");
      handleClose();
    },
    onError: () => showToast("Couldn't save transaction. Try again.", "error"),
  });

  const ocrMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/transactions/ocr", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: ({ data }) => {
      setOcrResult(data);
      setOcrStage("review");
    },
    onError: (err) => {
      setOcrError(err.response?.data?.detail || "Bill reading unavailable. Enter the transaction manually.");
      setOcrStage("error");
    },
  });

  const handleFileSelected = (file) => {
    setOcrStage("processing");
    ocrMutation.mutate(file);
  };

  const fields = ocrResult?.fields;
  const initialValues = fields
    ? {
        amount: fields.amount?.value ?? "",
        vendor: fields.vendor?.value ?? "",
        category: fields.category?.value,
        txn_date: fields.date?.value,
        gstin: fields.gstin?.value ?? "",
      }
    : {};
  const confidences = fields
    ? {
        amount: fields.amount?.confidence,
        vendor: fields.vendor?.confidence,
        category: fields.category?.confidence,
        date: fields.date?.confidence,
        gstin: fields.gstin?.confidence,
      }
    : {};

  return (
    <Modal open={open} onClose={handleClose} title="Add Transaction">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1">
        <button
          onClick={() => setType("expense")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
            type === "expense" ? "bg-surface-card shadow-subtle text-danger" : "text-navy-soft"
          }`}
        >
          <ArrowDownCircle size={15} /> Expense
        </button>
        <button
          onClick={() => setType("income")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
            type === "income" ? "bg-surface-card shadow-subtle text-dhan-green" : "text-navy-soft"
          }`}
        >
          <ArrowUpCircle size={15} /> Income
        </button>
      </div>

      {type === "expense" && (
        <div className="mb-5 flex gap-4 border-b border-surface-border text-sm font-medium">
          <button
            onClick={() => {
              reset();
              setMode("manual");
            }}
            className={`pb-2.5 -mb-px border-b-2 transition-colors ${
              mode === "manual" ? "border-dhan-green text-navy" : "border-transparent text-navy-soft"
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setMode("scan")}
            className={`pb-2.5 -mb-px border-b-2 transition-colors ${
              mode === "scan" ? "border-dhan-green text-navy" : "border-transparent text-navy-soft"
            }`}
          >
            Scan Bill
          </button>
        </div>
      )}

      {mode === "manual" || type === "income" ? (
        <TransactionForm
          key={type}
          type={type}
          onSubmit={(payload) => createMutation.mutate({ ...payload, type })}
          submitting={createMutation.isPending}
        />
      ) : (
        <div>
          {ocrStage === "capture" && <BillCapture onFileSelected={handleFileSelected} />}
          {ocrStage === "processing" && <OCRProcessing done={ocrMutation.isSuccess} />}
          {ocrStage === "error" && (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-navy">{ocrError}</p>
              <button
                className="btn-secondary mt-4"
                onClick={() => {
                  setMode("manual");
                  setOcrStage("capture");
                }}
              >
                Enter manually
              </button>
            </div>
          )}
          {ocrStage === "review" && (
            <TransactionForm
              key={type}
              type={type}
              initialValues={initialValues}
              confidences={confidences}
              onSubmit={(payload) => createMutation.mutate({ ...payload, type })}
              submitting={createMutation.isPending}
              submitLabel="Confirm & Save"
            />
          )}
        </div>
      )}
    </Modal>
  );
}
