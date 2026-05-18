"use client";

import { useCallback, useState } from "react";

interface PdfUploadProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export default function PdfUpload({ onUpload, disabled }: PdfUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "application/pdf" || file.name.endsWith(".pdf"))) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
        dragOver
          ? "border-blue-400 bg-blue-500/10"
          : "border-gray-700 hover:border-gray-500"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <label className="cursor-pointer block">
        <div className="text-3xl mb-2">📁</div>
        <p className="text-sm text-gray-300 mb-1">
          Drop a PDF here or click to upload
        </p>
        <p className="text-xs text-gray-500">
          Folio will extract text and diagrams from each page
        </p>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />
      </label>
    </div>
  );
}
