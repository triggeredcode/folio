"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getActiveSessions,
  ingestPageSSE,
  getSessionPages,
  PageData,
} from "@/lib/api";

export default function ScanPage() {
  return (
    <Suspense fallback={<div style={{ background: "#000", minHeight: "100vh" }} />}>
      <ScanContent />
    </Suspense>
  );
}

function ScanContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");
  const [sessionId, setSessionId] = useState(sessionParam || "");
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [sentCount, setSentCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState("");
  const pageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function findSession() {
      if (sessionParam) {
        try {
          const data = await getSessionPages(sessionParam);
          pageCountRef.current = data.page_count;
          setSessionId(sessionParam);
          setStatus("ready");
        } catch {
          setStatus("error");
        }
        return;
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { sessions } = await getActiveSessions();
          if (sessions.length > 0) {
            const target = sessions[0];
            setSessionId(target.session_id);
            pageCountRef.current = target.pages;
            setStatus("ready");
            return;
          }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 2000));
      }
      setStatus("error");
    }
    findSession();
  }, [sessionParam]);

  // Re-discover latest session periodically (handles case where PC creates new session)
  useEffect(() => {
    if (sessionParam) return; // explicit session param = don't auto-switch
    const interval = setInterval(async () => {
      try {
        const { sessions } = await getActiveSessions();
        if (sessions.length > 0 && sessions[0].session_id !== sessionId) {
          setSessionId(sessions[0].session_id);
          pageCountRef.current = sessions[0].pages;
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionParam, sessionId]);

  const handleFile = useCallback(
    (file: File) => {
      if (!sessionId || !file.type.startsWith("image/")) return;

      pageCountRef.current++;
      const pageNumber = pageCountRef.current;
      setPendingCount(c => c + 1);
      setLastError("");

      ingestPageSSE(sessionId, pageNumber, file, (event, data) => {
        if (event === "page_complete") {
          setSentCount(c => c + 1);
          setPendingCount(c => c - 1);
        } else if (event === "error") {
          const msg = JSON.parse(data).message || "Upload failed";
          setLastError(msg);
          setPendingCount(c => c - 1);
        }
      });
    },
    [sessionId]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  if (status === "connecting") {
    return (
      <div style={{ background: "#000", color: "#888", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14 }}>Connecting...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ background: "#000", color: "#aaa", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <p style={{ fontSize: 16 }}>No active session found</p>
        <p style={{ fontSize: 12, color: "#666" }}>Open Folio on your laptop first, then scan the QR</p>
        <button onClick={() => window.location.reload()}
          style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        style={{ display: "none" }}
      />

      {/* Centered content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Scan Pages
          </p>
          <p style={{ fontSize: 13, color: "#888" }}>
            Pages appear on your laptop automatically
          </p>
        </div>

        {/* Big camera button — never blocked, allows queuing */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "4px solid #fff",
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span style={{ fontSize: 12, color: "#ccc" }}>
            Take Photo
          </span>
        </button>

        {/* Counter */}
        <div style={{ textAlign: "center" }}>
          {sentCount > 0 && (
            <p style={{ fontSize: 18, fontWeight: 600, color: "#4ade80" }}>
              {sentCount} page{sentCount !== 1 ? "s" : ""} sent
            </p>
          )}
          {pendingCount > 0 && (
            <p style={{ fontSize: 13, color: "#3b82f6", marginTop: 4 }}>
              {pendingCount} uploading...
            </p>
          )}
          {lastError && (
            <p style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{lastError}</p>
          )}
        </div>
      </div>

      {/* Session indicator */}
      <div style={{ padding: "12px 24px", textAlign: "center", borderTop: "1px solid #222" }}>
        <p style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          session: {sessionId.slice(0, 8)}...
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
