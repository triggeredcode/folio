"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  disabled?: boolean;
  compact?: boolean;
}

function canUseLiveCamera(): boolean {
  if (typeof window === "undefined") return false;
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export default function CameraCapture({
  onCapture,
  disabled = false,
  compact = false,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasLiveCamera, setHasLiveCamera] = useState(true);

  useEffect(() => {
    setHasLiveCamera(canUseLiveCamera());
  }, []);

  const startCamera = useCallback(async () => {
    if (!canUseLiveCamera()) {
      setError("Live camera not available over HTTP. Use 'Take Photo' to open your camera.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      setStreaming(true);
      setError(null);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setError("Camera permission denied. Check your browser settings and tap Retry.");
      } else if (name === "NotFoundError") {
        setError("No camera found. Use Take Photo or Upload instead.");
      } else {
        setError(`Camera error: ${name || "unknown"}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStreaming(false);
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setLastCapture(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.85
    );
  }, [onCapture]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          setLastCapture(url);
        }
        onCapture(file);
      }
    },
    [onCapture]
  );

  useEffect(() => {
    if (streaming && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [streaming]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-2xl w-full"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          {error}
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          <label className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{ background: "var(--accent)", color: "white" }}>
            Take Photo
            <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
          </label>
          <label className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Upload File
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
          </label>
          {hasLiveCamera && (
            <button
              onClick={() => { setError(null); startCamera(); }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <canvas ref={canvasRef} className="hidden" />
        {!streaming ? (
          <div className="flex items-center gap-1.5">
            {hasLiveCamera ? (
              <button
                onClick={startCamera}
                disabled={disabled}
                className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-40"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Scan
              </button>
            ) : (
              <label className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40"
                style={{ background: "var(--accent)", color: "white" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Photo
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
              </label>
            )}
            <label className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-all"
              style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              File
              <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative rounded-lg overflow-hidden" style={{ border: "2px solid var(--accent)" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-36 h-24 bg-black object-cover"
              />
              {flashActive && (
                <div className="absolute inset-0 bg-white/80 transition-opacity" />
              )}
            </div>
            <button
              onClick={capture}
              disabled={disabled}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all active:scale-90 disabled:opacity-40"
              style={{ background: "#ef4444" }}
            >
              <div className="w-5 h-5 rounded-full bg-white" />
            </button>
            <button
              onClick={stopCamera}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <canvas ref={canvasRef} className="hidden" />

      {!streaming ? (
        <div className="flex flex-col items-center gap-5 w-full">
          {lastCapture && (
            <div className="relative w-full max-w-md animate-fade-in">
              <img
                src={lastCapture}
                alt="Captured page"
                className="w-full rounded-xl"
                style={{ border: "1px solid var(--border)" }}
              />
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "#34d39930", color: "#34d399" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                Captured
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {hasLiveCamera ? (
              <button
                onClick={startCamera}
                disabled={disabled}
                className="group relative flex flex-col items-center gap-2 disabled:opacity-40"
              >
                <div className="w-20 h-20 rounded-full flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95"
                  style={{ background: "var(--accent)", boxShadow: "0 0 0 4px var(--accent-soft)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Camera
                </span>
              </button>
            ) : (
              <label className="group relative flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-20 h-20 rounded-full flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95"
                  style={{ background: "var(--accent)", boxShadow: "0 0 0 4px var(--accent-soft)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Take Photo
                </span>
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
              </label>
            )}

            <label className="group flex flex-col items-center gap-2 cursor-pointer">
              <div className="w-20 h-20 rounded-full flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95"
                style={{ background: "var(--bg-surface)", border: "2px solid var(--border)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Upload
              </span>
              <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {lastCapture ? "Capture more pages or start asking" : "Scan a page or upload a file to begin"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 w-full animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ border: "2px solid var(--accent)" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full bg-black"
              style={{ minHeight: "320px" }}
            />

            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: "var(--accent)" }} />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: "var(--accent)" }} />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: "var(--accent)" }} />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: "var(--accent)" }} />

            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
              style={{ background: "#00000080", color: "var(--text-primary)" }}>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Live
            </div>

            {flashActive && (
              <div className="absolute inset-0 bg-white/90 pointer-events-none transition-opacity duration-200" />
            )}
          </div>

          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Position the page so text is clearly visible, then tap the capture button
          </p>

          <div className="flex items-center gap-6">
            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              title="Close camera"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <button
              onClick={capture}
              disabled={disabled}
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
              style={{ background: "white" }}
              title="Capture page"
            >
              <div className="absolute inset-0 rounded-full animate-pulse-ring"
                style={{ border: "3px solid var(--accent)" }} />
              <div className="w-16 h-16 rounded-full"
                style={{ border: "4px solid var(--bg)", background: "white" }} />
            </button>

            <div className="w-12" />
          </div>
        </div>
      )}
    </div>
  );
}
