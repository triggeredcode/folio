"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import PageStrip from "@/components/PageStrip";
import { PageData, ingestPageSSE, generateTTS } from "@/lib/api";

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg)" }} />}>
      <ReaderContent />
    </Suspense>
  );
}

function ReaderContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "";
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [status, setStatus] = useState("Scan a page to begin");
  const [processing, setProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleCapture = useCallback(
    (imageBlob: Blob) => {
      if (!sessionId) return;
      setProcessing(true);
      setStatus("Reading the page...");

      const pageNumber = pages.length + 1;

      ingestPageSSE(sessionId, pageNumber, imageBlob, (event, data) => {
        if (event === "progress") {
          const { stage } = JSON.parse(data);
          if (stage === "vision_call_start") setStatus("Analyzing with AI...");
          else if (stage === "extract_text") setStatus("Extracting text...");
          else if (stage === "store") setStatus("Storing...");
        } else if (event === "page_complete") {
          const page: PageData = JSON.parse(data);
          setPages((prev) => [...prev, page]);
          setActivePage(page.page_number);
          setStatus("Speaking...");

          generateTTS(page.narration_text).then((audioUrl) => {
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.play().catch(() => {});
              setIsPlaying(true);
            }
            setProcessing(false);
            setStatus("Listening. Tap a page to replay.");
          }).catch(() => {
            setProcessing(false);
            setStatus("Page captured. Tap to read another.");
          });
        }
      });
    },
    [sessionId, pages.length]
  );

  const handlePageClick = useCallback(
    (pageNumber: number) => {
      setActivePage(pageNumber);
      const page = pages.find((p) => p.page_number === pageNumber);
      if (page) {
        setStatus("Replaying...");
        generateTTS(page.narration_text).then((audioUrl) => {
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
          setStatus("Listening.");
        });
      }
    },
    [pages]
  );

  const activePageData = pages.find((p) => p.page_number === activePage);

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
            style={{ background: "#7c3aed20", color: "#a78bfa" }}>
            Reader
          </span>
        </div>
        <a href="/" className="text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--text-muted)" }}>
          Switch mode
        </a>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {/* Status display */}
        <div className="text-center space-y-2">
          {processing && (
            <div className="w-8 h-8 mx-auto rounded-full animate-spin"
              style={{ border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
          )}
          <p className="text-2xl font-medium" style={{ color: "var(--text-primary)" }}>
            {status}
          </p>
        </div>

        {/* Camera */}
        <CameraCapture onCapture={handleCapture} disabled={processing} />

        <audio
          ref={audioRef}
          className="hidden"
          onEnded={() => setIsPlaying(false)}
        />

        {/* Page strip */}
        {pages.length > 0 && (
          <div className="w-full max-w-md">
            <PageStrip pages={pages} activePage={activePage} onPageClick={handlePageClick} />
          </div>
        )}

        {/* Active page narration preview */}
        {activePageData && (
          <div className="w-full max-w-md rounded-xl p-4 animate-fade-in"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              {isPlaying && (
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full animate-bounce"
                      style={{
                        background: "var(--accent)",
                        height: `${8 + Math.random() * 8}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Page {activePageData.page_number}
                {activePageData.headings[0] && ` — ${activePageData.headings[0].text}`}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {activePageData.narration_text?.slice(0, 200)}
              {(activePageData.narration_text?.length || 0) > 200 && "..."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
