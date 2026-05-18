"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleModeSelect(mode: "reader" | "tutor") {
    setLoading(true);
    try {
      const session = await createSession(mode);
      localStorage.setItem("folio_session_id", session.session_id);
      localStorage.setItem("folio_mode", mode);
      router.push(`/${mode}?session=${session.session_id}`);
    } catch {
      alert("Failed to connect to Folio backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)" }}>
      <div className="max-w-lg w-full space-y-10 text-center">
        <header className="space-y-4">
          <h1 className="text-6xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            Folio
          </h1>
          <p className="text-xl leading-relaxed"
            style={{ color: "var(--text-secondary)" }}>
            Point your camera at any textbook page.<br />
            Folio reads it aloud and answers your questions.
          </p>
        </header>

        <div className="grid gap-4">
          <button
            onClick={() => handleModeSelect("reader")}
            disabled={loading}
            className="group relative w-full p-7 rounded-2xl text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "#7c3aed20" }}>
                🔊
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold"
                  style={{ color: "var(--text-primary)" }}>
                  Reader Mode
                </h2>
                <p className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}>
                  Voice-first experience. Snap a page and hear it narrated with full diagram descriptions. Built for accessibility.
                </p>
              </div>
            </div>
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ border: "1px solid #7c3aed50" }} />
          </button>

          <button
            onClick={() => handleModeSelect("tutor")}
            disabled={loading}
            className="group relative w-full p-7 rounded-2xl text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "#4f6ef720" }}>
                💬
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold"
                  style={{ color: "var(--text-primary)" }}>
                  Tutor Mode
                </h2>
                <p className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}>
                  Chat with your textbook. Capture pages, then ask questions. Answers cite exactly where they come from.
                </p>
              </div>
            </div>
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ border: "1px solid var(--accent)" }} />
          </button>
        </div>

        <footer className="pt-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Powered by Gemma 4 &middot; Runs locally &middot; Your data stays on this device
          </p>
        </footer>
      </div>
    </main>
  );
}
