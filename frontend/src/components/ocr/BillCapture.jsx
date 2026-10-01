import { Camera, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

export default function BillCapture({ onFileSelected }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFiles = (files) => {
    if (files && files[0]) {
      onFileSelected(files[0]);
    }
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
      className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragActive ? "border-dhan-green bg-dhan-green-light" : "border-surface-border bg-surface-muted"
      }`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-card shadow-subtle">
        <UploadCloud size={26} className="text-dhan-green" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-base font-semibold text-navy">Scan your bill</p>
      <p className="mt-1 text-sm text-navy-soft">Drag & drop an image here, or choose an option below</p>

      <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
          <UploadCloud size={16} /> Upload file
        </button>
        <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn-secondary">
          <Camera size={16} /> Take photo
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
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
