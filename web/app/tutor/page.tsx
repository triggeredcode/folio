"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import CameraCapture from "@/components/CameraCapture";
import ChatPanel from "@/components/ChatPanel";
import PdfUpload from "@/components/PdfUpload";
import { PageData, ingestPageSSE, ingestPdfSSE, askQuestionSSE, getSessionPages } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { page: number }[];
  notInBook?: boolean;
}

interface PendingPage {
  id: string;
  previewUrl: string;
  pageNumber: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg)" }} />}>
      <TutorContent />
    </Suspense>
  );
}

function TutorContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "";
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"capture" | "chat">("capture");
  const [cameFromChat, setCameFromChat] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const knownPageIds = useRef(new Set<string>());
  const pageCountRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setSessionError("No session ID. Go back to the homepage to start.");
      return;
    }
    async function validateAndLoad() {
      try {
        const res = await fetch(`/api/session/${sessionId}`);
        if (!res.ok) {
          setSessionError("Session not found. It may have expired.");
          return;
        }
        const data = await getSessionPages(sessionId);
        if (data.pages.length > 0) {
          for (const p of data.pages) knownPageIds.current.add(p.page_id);
          pageCountRef.current = data.pages.length;
          setPages(data.pages);
        }
      } catch {
        setSessionError("Cannot reach backend.");
      }
    }
    validateAndLoad();
  }, [sessionId]);

  useEffect(() => {
    async function buildSessionUrl() {
      try {
        const res = await fetch("/api/network-info");
        if (res.ok) {
          const { ip, port } = await res.json();
          const currentPort = window.location.port || port;
          const proto = window.location.protocol;
          setSessionUrl(`${proto}//${ip}:${currentPort}/tutor?session=${sessionId}`);
        }
      } catch {
        setSessionUrl(`${window.location.origin}/tutor?session=${sessionId}`);
      }
    }
    if (sessionId) buildSessionUrl();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const data = await getSessionPages(sessionId);
        if (data.page_count > knownPageIds.current.size) {
          for (const p of data.pages) {
            if (!knownPageIds.current.has(p.page_id)) {
              knownPageIds.current.add(p.page_id);
              setPages(prev => {
                if (prev.some(ep => ep.page_id === p.page_id)) return prev;
                return [...prev, p];
              });
            }
          }
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleCapture = useCallback(
    (blob: Blob) => {
      if (!sessionId) return;

      if (blob.type === "application/pdf") {
        const pendingId = `pdf-${Date.now()}`;
        setPendingPages(prev => [...prev, {
          id: pendingId,
          previewUrl: "",
          pageNumber: 0,
          status: "processing",
        }]);

        ingestPdfSSE(sessionId, blob, (event, data) => {
          if (event === "pdf_meta") {
            const { total_pages } = JSON.parse(data);
            setPendingPages(prev => prev.map(p =>
              p.id === pendingId
                ? { ...p, status: "processing" as const, error: `Processing ${total_pages} pages...` }
                : p
            ));
          } else if (event === "page_complete") {
            const page: PageData = JSON.parse(data);
            knownPageIds.current.add(page.page_id);
            pageCountRef.current++;
            setPages(prev => [...prev, page]);
          } else if (event === "pdf_done") {
            setPendingPages(prev => prev.filter(p => p.id !== pendingId));
          } else if (event === "error") {
            setPendingPages(prev => prev.map(p =>
              p.id === pendingId ? { ...p, status: "error" as const, error: JSON.parse(data).message } : p
            ));
          }
        });
        return;
      }

      pageCountRef.current++;
      const pageNumber = pageCountRef.current;
      const pendingId = `cap-${Date.now()}`;

      let previewUrl = "";
      if (blob.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(blob);
      }

      setPendingPages(prev => [...prev, {
        id: pendingId,
        previewUrl,
        pageNumber,
        status: "uploading",
      }]);

      ingestPageSSE(sessionId, pageNumber, blob, (event, data) => {
        if (event === "progress") {
          const { stage } = JSON.parse(data);
          setPendingPages(prev => prev.map(p =>
            p.id === pendingId ? { ...p, status: "processing" as const } : p
          ));
          void stage;
        } else if (event === "page_complete") {
          const page: PageData = JSON.parse(data);
          knownPageIds.current.add(page.page_id);
          setPages(prev => [...prev, page]);
          setActivePage(page.page_number);
          setPendingPages(prev => prev.filter(p => p.id !== pendingId));
          if (previewUrl) URL.revokeObjectURL(previewUrl);
        } else if (event === "error") {
          setPendingPages(prev => prev.map(p =>
            p.id === pendingId ? { ...p, status: "error" as const, error: JSON.parse(data).message } : p
          ));
        }
      });
    },
    [sessionId]
  );

  const handleAsk = useCallback(
    (question: string) => {
      if (!sessionId || pages.length === 0) return;
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
      setMessages(prev => [...prev, userMsg]);
      setLoading(true);

      askQuestionSSE(sessionId, question, (event, data) => {
        if (event === "done") {
          const result = JSON.parse(data);
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: result.answer,
            citations: result.citations,
            notInBook: result.not_in_book,
          }]);
          setLoading(false);
        } else if (event === "error") {
          const { message } = JSON.parse(data);
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Something went wrong: ${message}. Please try again.`,
          }]);
          setLoading(false);
        }
      });
    },
    [sessionId, pages.length]
  );

  const handleCitationClick = useCallback((pageNumber: number) => {
    setActivePage(pageNumber);
  }, []);

  const totalPages = pages.length + pendingPages.length;

  if (sessionError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{sessionError}</p>
          <a href="/" className="inline-block px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "white" }}>
            Go Home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <a href="/" className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            folio
          </a>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            tutor
          </span>
          {totalPages > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
              {pages.length} page{pages.length !== 1 ? "s" : ""}
              {pendingPages.length > 0 && ` + ${pendingPages.length} processing`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "chat" && (
            <button
              onClick={() => { setCameFromChat(true); setMode("capture"); }}
              className="text-[11px] px-2 py-1 rounded-md transition-colors"
              style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}
            >
              + Pages
            </button>
          )}
          <button
            onClick={() => setShowQR(!showQR)}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{
              color: showQR ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${showQR ? "var(--accent)" : "var(--border)"}`,
            }}
            title="Connect phone"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="3" height="3"/>
              <line x1="21" y1="14" x2="21" y2="21"/>
              <line x1="14" y1="21" x2="21" y2="21"/>
            </svg>
          </button>
          <a href="/" className="text-[11px]" style={{ color: "var(--text-muted)" }}>Exit</a>
        </div>
      </header>

      {/* QR panel */}
      {showQR && sessionUrl && (
        <div className="px-4 py-3 flex items-center gap-3 animate-fade-in"
          style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
          <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: "white" }}>
            <QRCodeSVG value={sessionUrl} size={64} level="M" bgColor="white" fgColor="#0c0c0f" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              Scan to join this session
            </p>
            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {sessionUrl.replace(/https?:\/\//, "")}
            </p>
          </div>
          <button onClick={() => setShowQR(false)} className="text-xs" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
      )}

      {/* Page strip — always visible when pages exist */}
      {(pages.length > 0 || pendingPages.length > 0) && (
        <div className="px-3 py-2 flex-shrink-0 overflow-hidden"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {pages.map(page => (
              <button key={page.page_id}
                onClick={() => setActivePage(page.page_number)}
                className="flex-shrink-0 rounded-lg overflow-hidden transition-all hover:scale-[1.02]"
                style={{
                  border: activePage === page.page_number
                    ? "2px solid var(--accent)" : "2px solid transparent",
                  width: "72px",
                  background: "var(--bg-surface)",
                }}>
                <div className="h-12 flex items-center justify-center">
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    P{page.page_number}
                  </span>
                </div>
                <div className="px-1.5 py-1" style={{ background: "var(--bg-elevated)" }}>
                  <p className="text-[9px] truncate" style={{ color: "var(--text-secondary)" }}>
                    {page.headings[0]?.text || `Page ${page.page_number}`}
                  </p>
                </div>
              </button>
            ))}
            {pendingPages.map(pp => (
              <div key={pp.id}
                className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{
                  width: "72px",
                  border: pp.status === "error" ? "2px solid #ef4444" : "2px solid var(--border)",
                }}>
                <div className="h-12 flex items-center justify-center relative"
                  style={{ background: "var(--bg-surface)" }}>
                  {pp.status === "error" ? (
                    <span className="text-xs" style={{ color: "#ef4444" }}>!</span>
                  ) : pp.previewUrl ? (
                    <>
                      <img src={pp.previewUrl} alt="" className="w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full animate-spin"
                          style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
                      </div>
                    </>
                  ) : (
                    <div className="w-5 h-5 rounded-full animate-spin"
                      style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
                  )}
                </div>
                <div className="px-1.5 py-1" style={{ background: "var(--bg-elevated)" }}>
                  <p className="text-[9px]" style={{ color: pp.status === "error" ? "#ef4444" : "var(--accent)" }}>
                    {pp.status === "error" ? "Failed" : pp.status === "uploading" ? "Uploading..." : "Processing..."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {mode === "capture" ? (
          <div className="flex-1 flex flex-col items-center overflow-y-auto">
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 max-w-lg mx-auto w-full">
              {pages.length === 0 && pendingPages.length === 0 ? (
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                    Scan your textbook
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Capture pages, then ask questions
                  </p>
                </div>
              ) : (
                <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                  {pendingPages.length > 0
                    ? `Processing ${pendingPages.length} page${pendingPages.length !== 1 ? "s" : ""}... you can keep capturing`
                    : `${pages.length} page${pages.length !== 1 ? "s" : ""} ready. Add more or start chatting.`
                  }
                </p>
              )}

              <CameraCapture onCapture={handleCapture} disabled={false} />

              {pages.length === 0 && pendingPages.length === 0 && (
                <div className="w-full">
                  <PdfUpload onUpload={(file) => handleCapture(file)} disabled={false} />
                </div>
              )}

              {pages.length > 0 && (
                <button
                  onClick={() => { setMode("chat"); setCameFromChat(false); }}
                  className="w-full max-w-xs py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {cameFromChat
                    ? `Back to chat (${pages.length} page${pages.length !== 1 ? "s" : ""})`
                    : `Start asking questions (${pages.length} page${pages.length !== 1 ? "s" : ""})`
                  }
                </button>
              )}
            </div>
          </div>
        ) : (
          <ChatPanel
            messages={messages}
            onSend={handleAsk}
            loading={loading}
            onCitationClick={handleCitationClick}
            onAddPages={() => { setCameFromChat(true); setMode("capture"); }}
          />
        )}
      </div>
    </main>
  );
}
