import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { useI18n } from "../../lib/i18n.jsx";
import { useOverlay } from "./useOverlay.js";

function Panel({ onClose, title, children }) {
  const { t } = useI18n();
  const ref = useOverlay(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
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
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-full w-full max-w-md overflow-y-auto bg-surface-card shadow-elevated"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface-card px-6 py-4">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-muted"
            aria-label={t("nav.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

export default function Drawer({ open, onClose, title, children }) {
  return <AnimatePresence>{open && <Panel onClose={onClose} title={title}>{children}</Panel>}</AnimatePresence>;
}
