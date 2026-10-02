import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { useI18n } from "../../lib/i18n.jsx";
import { useOverlay } from "./useOverlay.js";

// Centered dialog on desktop, bottom sheet on phones (thumb reach).
function Panel({ onClose, title, children, maxWidth }) {
  const { t } = useI18n();
  const ref = useOverlay(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-ink-deep/55"
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface-card shadow-elevated sm:rounded-3xl ${maxWidth}`}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-muted"
            aria-label={t("nav.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-8 sm:px-6 sm:pb-6">{children}</div>
      </motion.div>
    </div>
  );
}

export default function Modal({ open, onClose, title, children, maxWidth = "sm:max-w-lg" }) {
  return (
    <AnimatePresence>
      {open && (
        <Panel onClose={onClose} title={title} maxWidth={maxWidth}>
          {children}
        </Panel>
      )}
    </AnimatePresence>
  );
}
