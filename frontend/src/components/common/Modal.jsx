import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-navy/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-card border border-surface-border shadow-elevated`}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface-card px-6 py-4 rounded-t-2xl">
              <h2 className="text-lg font-semibold text-navy">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-navy-soft hover:bg-surface-muted transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
