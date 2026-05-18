"use client";

import { useCallback, useState, useRef } from "react";

interface PdfUploadProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export default function PdfUpload({ onUpload, disabled = false }: PdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "application/pdf" || file.type.startsWith("image/"))) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className="w-full rounded-xl p-8 flex flex-col items-center gap-3 transition-all cursor-pointer"
      style={{
        background: isDragging ? "var(--accent-soft)" : "var(--bg-elevated)",
        border: isDragging ? "2px dashed var(--accent)" : "2px dashed var(--border)",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-surface)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ color: "var(--text-muted)" }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9 15 12 12 15 15"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Drop a PDF here or click to browse
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Also accepts images (JPG, PNG)
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
