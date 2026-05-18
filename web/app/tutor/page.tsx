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
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<"capture" | "chat">("capture");
  const [showQR, setShowQR] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const knownPageIds = useRef(new Set<string>());

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
          const newPages: PageData[] = [];
          for (const p of data.pages) {
            if (!knownPageIds.current.has(p.page_id)) {
              knownPageIds.current.add(p.page_id);
              newPages.push(p);
            }
          }
          if (newPages.length > 0) {
            setPages(prev => {
              const existingIds = new Set(prev.map(p => p.page_id));
              const toAdd = newPages.filter(p => !existingIds.has(p.page_id));
              return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
            });
          }
        }
      } catch {
        // backend might be down, ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleCapture = useCallback(
    (blob: Blob) => {
      if (!sessionId) return;
      setIngesting(true);

      if (blob.type === "application/pdf") {
        setIngestStatus("Processing PDF...");
        ingestPdfSSE(sessionId, blob, (event, data) => {
          if (event === "pdf_meta") {
            const { total_pages, ingesting: ing } = JSON.parse(data);
            setIngestStatus(`PDF: ${total_pages} pages, processing ${ing.length}...`);
          } else if (event === "progress") {
            const { page_number, stage } = JSON.parse(data);
            setIngestStatus(`Page ${page_number}: ${stage}...`);
          } else if (event === "page_complete") {
            const page: PageData = JSON.parse(data);
            knownPageIds.current.add(page.page_id);
            setPages((prev) => [...prev, page]);
          } else if (event === "pdf_done") {
            setIngesting(false);
            setIngestStatus(null);
          }
        });
      } else {
        const pageNumber = pages.length + 1;
        setIngestStatus(`Scanning page ${pageNumber}...`);
        ingestPageSSE(sessionId, pageNumber, blob, (event, data) => {
          if (event === "page_complete") {
            const page: PageData = JSON.parse(data);
            knownPageIds.current.add(page.page_id);
            setPages((prev) => [...prev, page]);
            setActivePage(page.page_number);
            setIngesting(false);
            setIngestStatus(null);
          }
        });
      }
    },
    [sessionId, pages.length]
  );

  const handleAsk = useCallback(
    (question: string) => {
      if (!sessionId || pages.length === 0) return;
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      askQuestionSSE(sessionId, question, (event, data) => {
        if (event === "done") {
          const result = JSON.parse(data);
          const assistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: result.answer,
            citations: result.citations,
            notInBook: result.not_in_book,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
        }
      });
    },
    [sessionId, pages.length]
  );

  const handleCitationClick = useCallback((pageNumber: number) => {
    setActivePage(pageNumber);
  }, []);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <a href="/" className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            folio
          </a>
          <span className="text-[11px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            tutor
          </span>
        </div>
        <div className="flex items-center gap-4">
          {pages.length > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {pages.length} page{pages.length !== 1 ? "s" : ""}
            </span>
          )}
          {mode === "chat" && (
            <button
              onClick={() => setMode("capture")}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              + Add pages
            </button>
          )}
          <button
            onClick={() => setShowQR(!showQR)}
            className="text-xs px-2.5 py-1 rounded-md transition-colors"
            style={{
              color: showQR ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${showQR ? "var(--accent)" : "var(--border)"}`,
            }}
            title="Show QR code for phone"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="3" height="3"/>
              <line x1="21" y1="14" x2="21" y2="21"/>
              <line x1="14" y1="21" x2="21" y2="21"/>
            </svg>
          </button>
          <a href="/" className="text-xs" style={{ color: "var(--text-muted)" }}>
            Exit
          </a>
        </div>
      </header>

      {/* QR overlay for phone sync */}
      {showQR && sessionUrl && (
        <div className="px-5 py-4 flex items-center gap-4 animate-fade-in"
          style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
          <div className="p-2 rounded-lg" style={{ background: "white" }}>
            <QRCodeSVG value={sessionUrl} size={80} level="M" bgColor="white" fgColor="#0c0c0f" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Scan with your phone
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Join this session to capture pages. Same Wi-Fi required.
            </p>
            <p className="text-[10px] font-mono mt-1 break-all" style={{ color: "var(--text-muted)" }}>
              {sessionUrl.replace(/https?:\/\//, "")}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {ingestStatus && (
          <div className="px-5 py-2" style={{ background: "var(--bg-elevated)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--accent)" }}>
                {ingestStatus}
              </span>
            </div>
          </div>
        )}

        {mode === "capture" ? (
          <div className="flex-1 flex flex-col items-center overflow-y-auto">
            {pages.length > 0 && (
              <div className="w-full px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {pages.map((page) => (
                    <div key={page.page_id}
                      onClick={() => setActivePage(page.page_number)}
                      className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
                      style={{
                        border: activePage === page.page_number
                          ? "2px solid var(--accent)"
                          : "2px solid var(--border)",
                        width: "100px",
                      }}>
                      {(page as PageData & { image_url?: string }).image_url ? (
                        <img
                          src={(page as PageData & { image_url?: string }).image_url}
                          alt={`Page ${page.page_number}`}
                          className="w-full h-16 object-cover"
                          style={{ background: "var(--bg-surface)" }}
                        />
                      ) : (
                        <div className="w-full h-16 flex items-center justify-center"
                          style={{ background: "var(--bg-surface)" }}>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>P{page.page_number}</span>
                        </div>
                      )}
                      <div className="px-2 py-1.5" style={{ background: "var(--bg-elevated)" }}>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>
                          {page.headings[0]?.text || `Page ${page.page_number}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-lg mx-auto w-full">
              {pages.length === 0 ? (
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                    Scan your textbook
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Capture pages one by one, then ask questions
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {pages.length} page{pages.length !== 1 ? "s" : ""} captured. Add more or start chatting.
                  </p>
                </div>
              )}

              <CameraCapture onCapture={handleCapture} disabled={ingesting} />

              {pages.length === 0 && (
                <div className="w-full">
                  <PdfUpload onUpload={(file) => handleCapture(file)} disabled={ingesting} />
                </div>
              )}

              {pages.length > 0 && (
                <button
                  onClick={() => setMode("chat")}
                  className="w-full max-w-xs py-3.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  Start asking questions ({pages.length} page{pages.length !== 1 ? "s" : ""})
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
          />
        )}
      </div>
    </main>
  );
}
