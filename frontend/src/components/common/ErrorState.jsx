import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorState({ title = "Can't reach DHAN right now.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-light text-danger">
        <AlertCircle size={22} strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-navy">{title}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4">
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
