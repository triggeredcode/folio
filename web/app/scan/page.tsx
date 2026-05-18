"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import {
  getActiveSessions,
  ingestPageSSE,
  getSessionPages,
  getPageImageUrl,
  PageData,
} from "@/lib/api";

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg)" }} />}>
      <ScanContent />
    </Suspense>
  );
}

function ScanContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");
  const [sessionId, setSessionId] = useState(sessionParam || "");
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [pages, setPages] = useState<PageData[]>([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const knownPageIds = useRef(new Set<string>());
  const pageCountRef = useRef(0);

  useEffect(() => {
    async function findSession() {
      if (sessionParam) {
        setSessionId(sessionParam);
        setStatus("ready");
        const data = await getSessionPages(sessionParam);
        for (const p of data.pages) knownPageIds.current.add(p.page_id);
        pageCountRef.current = data.page_count;
        setPages(data.pages);
        return;
      }

      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const { sessions } = await getActiveSessions();
          if (sessions.length > 0) {
            const target = sessions[0];
            setSessionId(target.session_id);
            setStatus("ready");
            try {
              const data = await getSessionPages(target.session_id);
              for (const p of data.pages) knownPageIds.current.add(p.page_id);
              pageCountRef.current = data.page_count;
              setPages(data.pages);
            } catch { /* empty session, that's fine */ }
            return;
          }
        } catch { /* backend not ready */ }
        await new Promise(r => setTimeout(r, 2000));
      }
      setStatus("error");
    }
    findSession();
  }, [sessionParam]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const data = await getSessionPages(sessionId);
        if (data.page_count > pageCountRef.current) {
          pageCountRef.current = data.page_count;
        }
        for (const p of data.pages) {
          if (!knownPageIds.current.has(p.page_id)) {
            knownPageIds.current.add(p.page_id);
            setPages(prev => prev.some(ep => ep.page_id === p.page_id) ? prev : [...prev, p]);
          }
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleCapture = useCallback(
    (blob: Blob) => {
      if (!sessionId || blob.type === "application/pdf") return;

      pageCountRef.current++;
      const pageNumber = pageCountRef.current;
      setUploading(true);

      ingestPageSSE(sessionId, pageNumber, blob, (event, data) => {
        if (event === "page_complete") {
          const page: PageData = JSON.parse(data);
          knownPageIds.current.add(page.page_id);
          setPages(prev => prev.some(p => p.page_id === page.page_id) ? prev : [...prev, page]);
          setUploadCount(c => c + 1);
          setUploading(false);
        } else if (event === "error") {
          setUploading(false);
        }
      });
    },
    [sessionId]
  );

  if (status === "connecting") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3">
          <div className="w-6 h-6 mx-auto rounded-full animate-spin"
            style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Connecting to Folio...
          </p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No active session found on your laptop.
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Open Folio on your laptop first, then scan the QR code.
          </p>
          <button onClick={() => window.location.reload()}
            className="text-xs px-4 py-2 rounded-lg"
            style={{ background: "var(--accent)", color: "white" }}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            folio
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
            style={{ background: "#22c55e15", color: "#4ade80" }}>
            camera
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {pages.length} page{pages.length !== 1 ? "s" : ""}
          {uploading && " + 1 uploading..."}
        </span>
      </header>

      {/* Captured pages strip */}
      {pages.length > 0 && (
        <div className="px-3 py-2 flex-shrink-0 overflow-hidden"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {pages.map(page => (
              <div key={page.page_id}
                className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{ width: "48px", border: "2px solid var(--accent)" }}>
                <div className="h-14 relative">
                  <img
                    src={getPageImageUrl(sessionId, page.page_number)}
                    alt={`Page ${page.page_number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center py-0.5 font-bold"
                    style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                    {page.page_number}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            {pages.length === 0 ? "Snap your textbook pages" : "Keep scanning"}
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pages appear on your laptop automatically
          </p>
        </div>

        <CameraCapture onCapture={handleCapture} disabled={uploading} />

        {uploadCount > 0 && (
          <p className="text-xs" style={{ color: "#4ade80" }}>
            {uploadCount} page{uploadCount !== 1 ? "s" : ""} sent to laptop
          </p>
        )}
      </div>
    </main>
  );
}
