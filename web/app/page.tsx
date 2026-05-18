"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    setAppUrl(window.location.href);
  }, []);

  async function handleModeSelect(mode: "reader" | "tutor") {
    setLoading(true);
    try {
      const session = await createSession(mode);
      localStorage.setItem("folio_session_id", session.session_id);
      localStorage.setItem("folio_mode", mode);
      router.push(`/${mode}?session=${session.session_id}`);
    } catch {
      alert("Cannot connect to the backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)" }}>
      <div className="max-w-md w-full space-y-10 text-center">
        {/* Title */}
        <header className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            folio
          </h1>
          <p className="text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}>
            Point your camera at any textbook page.<br />
            Ask questions. Get grounded answers.
          </p>
        </header>

        {/* Mode buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleModeSelect("reader")}
            disabled={loading}
            className="group w-full py-4 px-5 rounded-xl text-left flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="text-2xl">🔊</span>
            <div>
              <div className="font-medium" style={{ color: "var(--text-primary)" }}>Reader</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Reads pages aloud with diagram descriptions
              </div>
            </div>
          </button>

          <button
            onClick={() => handleModeSelect("tutor")}
            disabled={loading}
            className="group w-full py-4 px-5 rounded-xl text-left flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="text-2xl">💬</span>
            <div>
              <div className="font-medium" style={{ color: "var(--text-primary)" }}>Tutor</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Chat with your textbook, answers cite the source
              </div>
            </div>
          </button>
        </div>

        {/* Connect with Phone */}
        <div className="pt-2">
          <button
            onClick={() => setShowQR(!showQR)}
            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-all"
            style={{
              background: showQR ? "var(--bg-surface)" : "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            <span className="text-sm font-medium">
              {showQR ? "Hide QR" : "Open on Phone"}
            </span>
          </button>

          {showQR && appUrl && (
            <div className="mt-4 flex flex-col items-center gap-4 animate-fade-in">
              <div className="p-4 rounded-2xl" style={{ background: "white" }}>
                <QRCodeSVG
                  value={appUrl}
                  size={200}
                  level="M"
                  bgColor="white"
                  fgColor="#0c0c0f"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Scan to open Folio on your phone
                </p>
                <p className="text-[11px] font-mono px-2 py-1 rounded"
                  style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
                  {appUrl}
                </p>
              </div>
            </div>
          )}
        </div>

        <footer>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Powered by Gemma 4 &middot; Runs locally &middot; Nothing leaves your device
          </p>
        </footer>
      </div>
    </main>
  );
}
