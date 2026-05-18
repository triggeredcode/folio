"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import PageStrip from "@/components/PageStrip";
import ChatPanel from "@/components/ChatPanel";
import PdfUpload from "@/components/PdfUpload";
import { PageData, ingestPageSSE, ingestPdfSSE, askQuestionSSE } from "@/lib/api";

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
      {/* Minimal header */}
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
          <a href="/" className="text-xs" style={{ color: "var(--text-muted)" }}>
            Exit
          </a>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Ingest status bar */}
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

        {/* CAPTURE MODE */}
        {mode === "capture" ? (
          <div className="flex-1 flex flex-col items-center overflow-y-auto">
            {/* Page previews strip */}
            {pages.length > 0 && (
              <div className="w-full px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {pages.map((page) => (
                    <div key={page.page_id}
                      className="flex-shrink-0 rounded-lg p-3 min-w-[160px]"
                      style={{
                        background: "var(--bg-elevated)",
                        border: activePage === page.page_number
                          ? "1px solid var(--accent)"
                          : "1px solid var(--border)",
                      }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                          Page {page.page_number}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                        {page.headings[0]?.text || page.text.slice(0, 60) + "..."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Camera + upload area */}
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

              {/* Start Chat button — only when pages exist */}
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
          /* CHAT MODE */
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
