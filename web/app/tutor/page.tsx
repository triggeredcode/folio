"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import CameraCapture from "@/components/CameraCapture";
import ChatPanel from "@/components/ChatPanel";
import PdfUpload from "@/components/PdfUpload";
import {
  PageData, ingestPageSSE, ingestPdfSSE, askQuestionSSE,
  getSessionPages, getTopics, getPageImageUrl, TopicsResponse,
} from "@/lib/api";

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
  const [mode, setMode] = useState<"capture" | "select" | "chat">("capture");
  const [cameFromChat, setCameFromChat] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const [selectedPageNums, setSelectedPageNums] = useState<Set<number>>(new Set());
  const [topicsData, setTopicsData] = useState<TopicsResponse | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);
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
          setSessionUrl(`${proto}//${ip}:${currentPort}/scan?session=${sessionId}`);
        }
      } catch {
        setSessionUrl(`${window.location.origin}/scan?session=${sessionId}`);
      }
    }
    if (sessionId) buildSessionUrl();
  }, [sessionId]);

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
            setPages(prev => {
              if (prev.some(ep => ep.page_id === p.page_id)) return prev;
              return [...prev, p];
            });
          }
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const enterSelectMode = useCallback(() => {
    setSelectedPageNums(new Set(pages.map(p => p.page_number)));
    setTopicsData(null);
    setMode("select");
  }, [pages]);

  const togglePageSelection = useCallback((pageNum: number) => {
    setSelectedPageNums(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPageNums(new Set(pages.map(p => p.page_number)));
  }, [pages]);

  const deselectAll = useCallback(() => {
    setSelectedPageNums(new Set());
  }, []);

  const topicsFetchedRef = useRef(false);

  useEffect(() => {
    topicsFetchedRef.current = false;
  }, [selectedPageNums]);

  useEffect(() => {
    if (mode === "select" && selectedPageNums.size > 0 && sessionId) {
      let cancelled = false;
      setTopicsLoading(true);
      getTopics(sessionId, Array.from(selectedPageNums))
        .then(data => { if (!cancelled) { setTopicsData(data); topicsFetchedRef.current = true; } })
        .catch(() => {})
        .finally(() => { if (!cancelled) setTopicsLoading(false); });
      return () => { cancelled = true; };
    }

    if (mode === "chat" && !topicsFetchedRef.current && pages.length > 0 && sessionId) {
      let cancelled = false;
      setTopicsLoading(true);
      getTopics(sessionId, pages.map(p => p.page_number))
        .then(data => { if (!cancelled) { setTopicsData(data); topicsFetchedRef.current = true; } })
        .catch(() => {})
        .finally(() => { if (!cancelled) setTopicsLoading(false); });
      return () => { cancelled = true; };
    }
  }, [mode, selectedPageNums, sessionId, pages.length]);

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
            if (!knownPageIds.current.has(page.page_id)) {
              knownPageIds.current.add(page.page_id);
              pageCountRef.current++;
              setPages(prev => {
                if (prev.some(p => p.page_id === page.page_id)) return prev;
                return [...prev, page];
              });
            }
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
          setPages(prev => {
            if (prev.some(p => p.page_id === page.page_id)) return prev;
            return [...prev, page];
          });
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

  const selectedPagesArray = Array.from(selectedPageNums);

  const handleAsk = useCallback(
    (question: string) => {
      if (!sessionId || pages.length === 0) return;
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
      setMessages(prev => [...prev, userMsg]);
      setLoading(true);

      const pagesToUse = selectedPagesArray.length > 0 ? selectedPagesArray : undefined;

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
      }, pagesToUse);
    },
    [sessionId, pages.length, selectedPagesArray]
  );

  const handleStarterQuestion = useCallback((q: string) => {
    setMode("chat");
    setCameFromChat(false);
    setTimeout(() => handleAsk(q), 100);
  }, [handleAsk]);

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
              {mode === "select" || mode === "chat"
                ? `${selectedPageNums.size}/${pages.length} selected`
                : `${pages.length} page${pages.length !== 1 ? "s" : ""}`
              }
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
            ×
          </button>
        </div>
      )}

      {/* Page strip — visible in capture and chat modes */}
      {mode !== "select" && (pages.length > 0 || pendingPages.length > 0) && (
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
                  width: "56px",
                  background: "var(--bg-surface)",
                }}>
                <div className="h-16 relative">
                  <img
                    src={getPageImageUrl(sessionId, page.page_number)}
                    alt={`Page ${page.page_number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center py-0.5 font-medium"
                    style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                    {page.page_number}
                  </span>
                </div>
              </button>
            ))}
            {pendingPages.map(pp => (
              <div key={pp.id}
                className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{
                  width: "56px",
                  border: pp.status === "error" ? "2px solid #ef4444" : "2px solid var(--border)",
                }}>
                <div className="h-16 flex items-center justify-center relative"
                  style={{ background: "var(--bg-surface)" }}>
                  {pp.status === "error" ? (
                    <span className="text-xs" style={{ color: "#ef4444" }}>!</span>
                  ) : pp.previewUrl ? (
                    <>
                      <img src={pp.previewUrl} alt="" className="w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full animate-spin"
                          style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
                      </div>
                    </>
                  ) : (
                    <div className="w-4 h-4 rounded-full animate-spin"
                      style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
                  )}
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
                    Capture pages, then pick which ones to study
                  </p>
                </div>
              ) : (
                <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                  {pendingPages.length > 0
                    ? `Processing ${pendingPages.length} page${pendingPages.length !== 1 ? "s" : ""}... you can keep capturing`
                    : `${pages.length} page${pages.length !== 1 ? "s" : ""} ready`
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
                  onClick={() => {
                    if (cameFromChat) { setMode("chat"); setCameFromChat(false); }
                    else enterSelectMode();
                  }}
                  className="w-full max-w-xs py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {cameFromChat
                    ? `Back to chat (${pages.length} page${pages.length !== 1 ? "s" : ""})`
                    : `Choose pages to study (${pages.length})`
                  }
                </button>
              )}
            </div>
          </div>
        ) : mode === "select" ? (
          <PageSelectView
            pages={pages}
            sessionId={sessionId}
            selectedPageNums={selectedPageNums}
            onToggle={togglePageSelection}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            topicsData={topicsData}
            topicsLoading={topicsLoading}
            onStartChat={() => { setMode("chat"); setCameFromChat(false); }}
            onStarterQuestion={handleStarterQuestion}
            onAddMore={() => setMode("capture")}
          />
        ) : (
          <ChatPanel
            messages={messages}
            onSend={handleAsk}
            loading={loading}
            onCitationClick={handleCitationClick}
            onAddPages={() => { setCameFromChat(true); setMode("capture"); }}
            starterQuestions={topicsData?.questions}
            topics={topicsData?.topics}
          />
        )}
      </div>
    </main>
  );
}

function PageSelectView({
  pages, sessionId, selectedPageNums, onToggle,
  onSelectAll, onDeselectAll, topicsData, topicsLoading,
  onStartChat, onStarterQuestion, onAddMore,
}: {
  pages: PageData[];
  sessionId: string;
  selectedPageNums: Set<number>;
  onToggle: (n: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  topicsData: TopicsResponse | null;
  topicsLoading: boolean;
  onStartChat: () => void;
  onStarterQuestion: (q: string) => void;
  onAddMore: () => void;
}) {
  const allSelected = selectedPageNums.size === pages.length;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              Choose your pages
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {selectedPageNums.size} of {pages.length} selected
            </p>
          </div>
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
            style={{ color: "var(--accent)", border: "1px solid var(--border)" }}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>

        {/* Page grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {pages.map(page => {
            const isSelected = selectedPageNums.has(page.page_number);
            return (
              <button
                key={page.page_id}
                onClick={() => onToggle(page.page_number)}
                className="rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] relative"
                style={{
                  border: isSelected ? "2px solid var(--accent)" : "2px solid var(--border)",
                  opacity: isSelected ? 1 : 0.5,
                }}
              >
                <div className="aspect-[3/4] relative">
                  <img
                    src={getPageImageUrl(sessionId, page.page_number)}
                    alt={`Page ${page.page_number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Selection indicator */}
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: isSelected ? "var(--accent)" : "rgba(0,0,0,0.4)",
                      border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.5)",
                    }}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                    style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
                    <p className="text-[10px] font-medium text-white truncate">
                      {page.headings[0]?.text || `Page ${page.page_number}`}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Add more pages button */}
          <button
            onClick={onAddMore}
            className="rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] aspect-[3/4] flex flex-col items-center justify-center gap-1.5"
            style={{ border: "2px dashed var(--border)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: "var(--text-muted)" }}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Add more</span>
          </button>
        </div>

        {/* Topics + starter questions */}
        {selectedPageNums.size > 0 && (
          <div className="space-y-3 pt-2">
            {topicsLoading ? (
              <div className="flex items-center gap-2 py-3">
                <div className="w-3.5 h-3.5 rounded-full animate-spin"
                  style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Finding topics...</span>
              </div>
            ) : topicsData ? (
              <>
                {topicsData.topics.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider mb-2"
                      style={{ color: "var(--text-muted)" }}>
                      Topics covered
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {topicsData.topics.map((topic, i) => (
                        <span key={i}
                          className="text-xs px-2.5 py-1 rounded-full"
                          style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {topicsData.questions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider mb-2"
                      style={{ color: "var(--text-muted)" }}>
                      Start with a question
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {topicsData.questions.map((q, i) => (
                        <button key={i}
                          onClick={() => onStarterQuestion(q)}
                          className="text-left text-xs px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                          style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {/* Start chat button */}
            <button
              onClick={onStartChat}
              disabled={selectedPageNums.size === 0}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Start chatting ({selectedPageNums.size} page{selectedPageNums.size !== 1 ? "s" : ""})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
