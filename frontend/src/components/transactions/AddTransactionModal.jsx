import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Mic } from "lucide-react";
import { useState } from "react";

import api from "../../lib/apiClient.js";
import { QUERY_KEYS_TO_REFRESH } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import Modal from "../common/Modal.jsx";
import { useToast } from "../common/Toast.jsx";
import { shrinkImage } from "../../lib/image.js";
import BillCapture from "../ocr/BillCapture.jsx";
import OCRProcessing from "../ocr/OCRProcessing.jsx";
import TransactionForm from "./TransactionForm.jsx";
import VoiceCapture from "./VoiceCapture.jsx";

export default function AddTransactionModal({ open, onClose }) {
  const { t } = useI18n();
  const [type, setType] = useState("expense");
  const [mode, setMode] = useState("manual");
  const [ocrStage, setOcrStage] = useState("capture");
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const reset = () => {
    setMode("manual");
    setOcrStage("capture");
    setOcrResult(null);
    setOcrError(null);
    setVoiceResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/transactions", payload),
    onSuccess: () => {
      QUERY_KEYS_TO_REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      showToast(t("txn.saved"));
      handleClose();
    },
    onError: () => showToast(t("txn.saveFail"), "error"),
  });

  const ocrMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/transactions/ocr", formData, { headers: { "Content-Type": "multipart/form-data" } });
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

  const handleFileSelected = async (file) => {
    setOcrStage("processing");
    ocrMutation.mutate(await shrinkImage(file));
  };

  const fields = ocrResult?.fields;
  const initialValues = fields
    ? {
        amount: fields.amount?.value ?? "",
        vendor: fields.vendor?.value ?? "",
        category: fields.category?.value,
        txn_date: fields.date?.value,
        gstin: fields.gstin?.value ?? "",
        payment_mode: fields.payment_mode?.value || undefined,
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

  const typeBtn = (key, Icon, activeText) => (
    <button
      type="button"
      role="radio"
      aria-checked={type === key}
      onClick={() => {
        setType(key);
        if (key === "income" && mode === "scan") setMode("manual");
      }}
      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-lg text-[15px] font-extrabold transition-colors ${
        type === key ? `bg-surface-card shadow-subtle ${activeText}` : "text-ink-soft"
      }`}
    >
      <Icon size={18} /> {t(`common.${key}`)}
    </button>
  );

  return (
    <Modal open={open} onClose={handleClose} title={t("txn.addTitle")}>
      <div role="radiogroup" className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl bg-surface-muted p-1">
        {typeBtn("expense", ArrowDownCircle, "text-loss")}
        {typeBtn("income", ArrowUpCircle, "text-gain")}
      </div>

      <div role="tablist" className="mb-5 flex gap-5 border-b border-surface-border text-[15px] font-bold">
        {[
          { k: "manual", label: t("txn.manual") },
          { k: "voice", label: t("voice.tab"), icon: Mic },
          ...(type === "expense" ? [{ k: "scan", label: t("txn.scan") }] : []),
        ].map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            onClick={() => {
              reset();
              setMode(k);
            }}
            className={`-mb-px inline-flex min-h-[44px] items-center gap-1.5 border-b-[3px] transition-colors ${
              mode === k ? "border-gold-500 text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {Icon && <Icon size={16} />}
            {label}
          </button>
        ))}
      </div>

      {mode === "voice" ? (
        voiceResult ? (
          <div>
            <div className="mb-4 rounded-xl bg-gold-50 px-4 py-3">
              <p className="text-xs font-bold text-gold-700">{t("voice.heard")}</p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">“{voiceResult.heard}”</p>
              <p className="mt-1 text-sm text-ink-soft">{voiceResult.amount ? t("voice.check") : t("voice.noAmount")}</p>
              <button onClick={() => setVoiceResult(null)} className="link mt-1 text-sm">
                {t("voice.again")}
              </button>
            </div>
            <TransactionForm
              key={voiceResult.heard}
              type={voiceResult.type}
              initialValues={{
                amount: voiceResult.amount ?? "",
                vendor: voiceResult.vendor,
                category: voiceResult.category,
                txn_date: voiceResult.txn_date,
                payment_mode: voiceResult.payment_mode,
              }}
              onSubmit={(payload) => createMutation.mutate({ ...payload, type: voiceResult.type })}
              submitting={createMutation.isPending}
            />
          </div>
        ) : (
          <VoiceCapture
            onParsed={(parsed) => {
              setType(parsed.type);
              setVoiceResult(parsed);
            }}
          />
        )
      ) : mode === "manual" || type === "income" ? (
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
            <div className="py-6 text-center">
              <p className="text-[15px] font-bold text-ink">{ocrError}</p>
              <button
                className="btn-secondary mt-4"
                onClick={() => {
                  setMode("manual");
                  setOcrStage("capture");
                }}
              >
                {t("txn.enterManually")}
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
              submitLabel={t("txn.confirm")}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
