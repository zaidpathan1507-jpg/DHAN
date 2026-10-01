import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Drawer({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-navy/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative h-full w-full max-w-md overflow-y-auto bg-surface-card border-l border-surface-border shadow-elevated"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface-card px-6 py-4">
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
