"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createSession } from "@/lib/api";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [appUrl, setAppUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("join") === "1") {
      window.location.href = "/scan";
      return;
    }
    async function getNetworkUrl() {
      try {
        const res = await fetch("/api/network-info");
        if (res.ok) {
          const { ip, port } = await res.json();
          const currentPort = window.location.port || port;
          const proto = window.location.protocol;
          setAppUrl(`${proto}//${ip}:${currentPort}`);
        } else {
          setAppUrl(window.location.href);
        }
      } catch {
        setAppUrl(window.location.href);
      }
    }
    getNetworkUrl();
  }, [searchParams]);

  async function handleModeSelect(mode: "reader" | "tutor") {
    setLoading(true);
    setError(null);
    try {
      const session = await createSession(mode);
      window.location.href = `/${mode}?session=${session.session_id}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Connection failed: ${msg}`);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-16 lg:gap-20">

        {/* Left side — content */}
        <div className="flex-1 max-w-xl space-y-10">
          <header className="space-y-6">
            <h1 className="font-bold tracking-tighter"
              style={{ color: "var(--text-primary)", fontSize: "clamp(6rem, 15vw, 14rem)", lineHeight: "0.85", letterSpacing: "-0.04em" }}>
              folio
            </h1>
            <p className="text-xl leading-relaxed"
              style={{ color: "var(--text-secondary)" }}>
              Turn any physical textbook into an interactive study companion.
              Snap pages with your phone, ask questions, get answers
              grounded <em>only</em> in what&apos;s on the page.
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No cloud. No hallucination. Just your book, understood.
            </p>
          </header>

          {/* Mode selection */}
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#7c3aed15" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </div>
              <div>
                <div className="font-medium" style={{ color: "var(--text-primary)" }}>Reader</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Voice narration with diagram descriptions
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--accent-soft)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div className="font-medium" style={{ color: "var(--text-primary)" }}>Tutor</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Chat with your textbook, citations included
                </div>
              </div>
            </button>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm text-left animate-fade-in"
                style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {loading && (
              <div className="text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>
                Connecting...
              </div>
            )}
          </div>

          <footer>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Powered by Gemma 4 &middot; Runs locally &middot; Nothing leaves your device
            </p>
          </footer>
        </div>

        {/* Right side — Phone mockup with QR (hidden on small screens) */}
        <div className="hidden lg:flex flex-col items-center gap-5">
          <div
            className="relative rounded-[3rem] p-4 shadow-2xl"
            style={{
              background: "var(--bg-elevated)",
              border: "3px solid var(--border)",
              width: "320px",
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 rounded-b-2xl"
              style={{ background: "var(--bg)" }} />

            <div className="rounded-[2.5rem] overflow-hidden flex flex-col items-center justify-center py-14 px-8"
              style={{ background: "var(--bg)", minHeight: "480px" }}>
              <div className="text-center space-y-5">
                <p className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}>
                  Scan to connect
                </p>

                {appUrl ? (
                  <div className="p-4 rounded-2xl inline-block" style={{ background: "white" }}>
                    <QRCodeSVG
                      value={`${appUrl}/scan`}
                      size={200}
                      level="M"
                      bgColor="white"
                      fgColor="#0c0c0f"
                    />
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] mx-auto rounded-xl animate-pulse"
                    style={{ background: "var(--bg-surface)" }} />
                )}

                <div className="space-y-1.5">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Open on your phone to<br />snap pages with camera
                  </p>
                  {appUrl && (
                    <p className="text-[10px] font-mono px-2 py-1 rounded break-all"
                      style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
                      {appUrl.replace("https://", "").replace("http://", "")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-3 w-28 h-1.5 rounded-full"
              style={{ background: "var(--border)" }} />
          </div>

          <p className="text-xs text-center max-w-[260px]" style={{ color: "var(--text-muted)" }}>
            Same Wi-Fi required. Snap pages from your phone camera.
          </p>
        </div>
      </div>
    </main>
  );
}
