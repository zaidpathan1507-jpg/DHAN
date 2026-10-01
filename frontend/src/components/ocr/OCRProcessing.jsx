import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

const STAGES = [
  "Uploading bill",
  "Reading document",
  "Extracting amount",
  "Identifying vendor",
  "Detecting category",
  "Ready for review",
];

export default function OCRProcessing({ done }) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (done && activeStage < STAGES.length - 1) {
      setActiveStage(STAGES.length - 1);
      return;
    }
    if (activeStage >= STAGES.length - 1) return;
    const t = setTimeout(() => setActiveStage((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [activeStage, done]);

  return (
    <div className="py-4">
      <ul className="space-y-3">
        {STAGES.map((stage, i) => {
          const completed = i < activeStage || (done && i <= activeStage);
          const current = i === activeStage && !completed;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  completed
                    ? "bg-dhan-green border-dhan-green text-white"
                    : current
                    ? "border-dhan-green text-dhan-green"
                    : "border-surface-border text-navy-soft/40"
                }`}
              >
                {completed ? (
                  <Check size={13} strokeWidth={2.5} />
                ) : current ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="h-2.5 w-2.5 rounded-full border-2 border-dhan-green border-t-transparent"
                  />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`text-sm ${
                  completed ? "text-navy font-medium" : current ? "text-navy font-medium" : "text-navy-soft/50"
                }`}
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
