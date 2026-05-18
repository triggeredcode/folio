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
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
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
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Folio</h1>
          <span className="text-xs text-blue-400">Tutor Mode</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{pages.length} pages</span>
          <a href="/" className="text-sm text-gray-500 hover:text-gray-300">
            Switch mode
          </a>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top: Page strip + capture */}
        <div className="border-b border-gray-800 px-3">
          <div className="flex items-center gap-2">
            <PageStrip pages={pages} activePage={activePage} onPageClick={setActivePage} />
            <CameraCapture onCapture={handleCapture} disabled={ingesting} compact />
          </div>
          {ingestStatus && (
            <p className="text-xs text-blue-400 pb-2 animate-pulse">{ingestStatus}</p>
          )}
        </div>

        {/* Bottom: Chat or upload prompt */}
        <div className="flex-1 overflow-hidden">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-4">
              <p className="text-xl text-gray-400">Capture some pages first</p>
              <p className="text-sm text-gray-600 max-w-sm">
                Use the camera to scan textbook pages, or upload a PDF. Then ask questions —
                answers come only from your book.
              </p>
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
