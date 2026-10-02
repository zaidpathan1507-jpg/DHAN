import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "../../lib/i18n.jsx";

const STAGE_KEYS = ["txn.ocr1", "txn.ocr2", "txn.ocr3", "txn.ocr4", "txn.ocr5", "txn.ocr6"];

export default function OCRProcessing({ done }) {
  const { t } = useI18n();
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (done && activeStage < STAGE_KEYS.length - 1) {
      setActiveStage(STAGE_KEYS.length - 1);
      return;
    }
    if (activeStage >= STAGE_KEYS.length - 1) return;
    const timer = setTimeout(() => setActiveStage((s) => s + 1), 420);
    return () => clearTimeout(timer);
  }, [activeStage, done]);

  return (
    <ul className="space-y-3.5 py-4" aria-live="polite">
      {STAGE_KEYS.map((key, i) => {
        const completed = i < activeStage || (done && i <= activeStage);
        const current = i === activeStage && !completed;
        return (
          <li key={key} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                completed
                  ? "border-gain bg-gain text-white"
                  : current
                  ? "border-gold-500 text-gold-700"
                  : "border-surface-strong text-ink-muted"
              }`}
            >
              {completed ? (
                <Check size={14} strokeWidth={3} />
              ) : current ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="h-3 w-3 rounded-full border-2 border-gold-600 border-t-transparent"
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <span className={`text-[15px] ${completed || current ? "font-bold text-ink" : "text-ink-muted"}`}>{t(key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
