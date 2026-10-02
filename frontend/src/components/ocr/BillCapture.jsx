import { Camera, ScanLine, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { useI18n } from "../../lib/i18n.jsx";

export default function BillCapture({ onFileSelected }) {
  const { t } = useI18n();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFiles = (files) => {
    if (files && files[0]) onFileSelected(files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
        dragActive ? "border-gold-500 bg-gold-50" : "border-surface-strong bg-surface"
      }`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
        <ScanLine size={30} strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-lg font-extrabold text-ink">{t("txn.scanTitle")}</p>
      <p className="mt-1 text-[15px] text-ink-soft">{t("txn.scanBody")}</p>

      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn-primary">
          <Camera size={18} /> {t("txn.photo")}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
          <UploadCloud size={18} /> {t("txn.upload")}
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
