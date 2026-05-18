"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  disabled?: boolean;
  compact?: boolean;
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
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setStreaming(true);
        setError(null);
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions.");
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
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <p className="text-red-400 text-sm text-center">{error}</p>
        <button
          onClick={startCamera}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Retry Camera
        </button>
        <label className="px-4 py-2 bg-gray-700 text-white rounded-lg cursor-pointer hover:bg-gray-600 text-sm">
          Upload Image
          <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <canvas ref={canvasRef} className="hidden" />
        {!streaming ? (
          <button
            onClick={startCamera}
            disabled={disabled}
            className="w-12 h-12 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center text-xl shadow-lg"
            title="Open camera"
          >
            📷
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-32 h-24 rounded-lg bg-black object-cover"
              />
              <div className="absolute inset-0 border-2 border-blue-400/50 rounded-lg pointer-events-none" />
            </div>
            <button
              onClick={capture}
              disabled={disabled}
              className="w-12 h-12 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center shadow-lg ring-2 ring-red-400/50 text-lg"
              title="Capture page"
            >
              📸
            </button>
            <button
              onClick={stopCamera}
              className="w-8 h-8 rounded-full bg-gray-600 text-white hover:bg-gray-500 flex items-center justify-center text-sm"
              title="Close camera"
            >
              ✕
            </button>
          </div>
        )}
        <label className="w-10 h-10 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center cursor-pointer text-sm" title="Upload file">
          📁
          <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full">
      <canvas ref={canvasRef} className="hidden" />

      {!streaming ? (
        <div className="flex flex-col items-center gap-4 w-full">
          {lastCapture && (
            <div className="relative w-full max-w-md">
              <img
                src={lastCapture}
                alt="Last captured page"
                className="w-full rounded-xl border border-gray-700"
              />
              <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                ✓ Captured
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={startCamera}
              disabled={disabled}
              className="w-20 h-20 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center text-3xl shadow-xl ring-4 ring-blue-400/20"
              title="Open camera to scan a page"
            >
              📷
            </button>
            <label className="w-20 h-20 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center text-3xl shadow-xl cursor-pointer ring-4 ring-gray-500/20" title="Upload image or PDF">
              📁
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-sm text-gray-500">
            {lastCapture ? "Capture another page or start asking questions" : "Tap 📷 to scan a page, or 📁 to upload"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Live video preview - full width */}
          <div className="relative w-full max-w-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl bg-black shadow-lg"
            />
            {/* Frame guide overlay */}
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none" />
            <p className="absolute bottom-2 left-0 right-0 text-center text-white/70 text-xs">
              Position the page within the frame
            </p>
          </div>

          {/* Capture controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center text-lg"
              title="Close camera"
            >
              ✕
            </button>
            <button
              onClick={capture}
              disabled={disabled}
              className="w-20 h-20 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center shadow-xl ring-4 ring-red-400/30 text-3xl transition-transform active:scale-95"
              title="Snap! Capture this page"
            >
              📸
            </button>
            <div className="w-12" /> {/* spacer for centering */}
          </div>
          <p className="text-sm text-gray-400">
            Press 📸 to capture the page
          </p>
        </div>
      )}
    </div>
  );
}
