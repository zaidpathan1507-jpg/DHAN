import { AlertCircle, RefreshCw } from "lucide-react";

import { useI18n } from "../../lib/i18n.jsx";

export default function ErrorState({ title, onRetry }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-loss-soft text-loss">
        <AlertCircle size={24} strokeWidth={1.75} />
      </div>
      <p className="text-base font-bold text-ink">{title || t("common.error")}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("common.errorBody")}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-5">
          <RefreshCw size={15} /> {t("common.retry")}
        </button>
      )}
    </div>
  );
}
