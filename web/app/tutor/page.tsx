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
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <a href="/" className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Folio
          </a>
          <span className="text-xs px-2 py-0.5 rounded-md font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            Tutor
          </span>
        </div>
        <div className="flex items-center gap-4">
          {pages.length > 0 && (
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {pages.length} page{pages.length !== 1 ? "s" : ""} loaded
            </span>
          )}
          <a href="/" className="text-xs transition-colors hover:opacity-80"
            style={{ color: "var(--text-muted)" }}>
            Switch mode
          </a>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page strip + controls */}
        <div className="px-3 py-2 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <PageStrip pages={pages} activePage={activePage} onPageClick={setActivePage} />
          <CameraCapture onCapture={handleCapture} disabled={ingesting} compact />
        </div>

        {/* Ingest status */}
        {ingestStatus && (
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                {ingestStatus}
              </span>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-6 overflow-y-auto">
              <div className="text-center max-w-sm space-y-2">
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Scan your textbook pages
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Use the camera below or upload a PDF. Then ask questions — answers come only from your book.
                </p>
              </div>

              {/* Full camera interface when no pages loaded */}
              <div className="w-full max-w-lg">
                <CameraCapture onCapture={handleCapture} disabled={ingesting} />
              </div>

              <div className="w-full max-w-sm">
                <PdfUpload
                  onUpload={(file) => handleCapture(file)}
                  disabled={ingesting}
                />
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
      </div>
    </main>
  );
}
