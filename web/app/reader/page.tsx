"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import PageStrip from "@/components/PageStrip";
import { PageData, ingestPageSSE, generateTTS } from "@/lib/api";

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <ReaderContent />
    </Suspense>
  );
}

function ReaderContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "";
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [status, setStatus] = useState("Point your camera at a book page");
  const [processing, setProcessing] = useState(false);
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
          if (stage === "vision_call_start") setStatus("Analyzing the page with AI...");
          else if (stage === "extract_text") setStatus("Extracting text...");
          else if (stage === "store") setStatus("Storing page...");
        } else if (event === "page_complete") {
          const page: PageData = JSON.parse(data);
          setPages((prev) => [...prev, page]);
          setActivePage(page.page_number);
          setStatus("Reading aloud...");

          generateTTS(page.narration_text).then((audioUrl) => {
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.play().catch(() => {});
            }
            setProcessing(false);
            setStatus("Done! Capture next page or listen again.");
          }).catch(() => {
            setProcessing(false);
            setStatus("Page captured. TTS unavailable.");
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
        setStatus("Re-reading page...");
        generateTTS(page.narration_text).then((audioUrl) => {
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(() => {});
          }
          setStatus("Listening...");
        });
      }
    },
    [pages]
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Folio</h1>
          <span className="text-xs text-purple-400">Reader Mode</span>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-300">
          Switch mode
        </a>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        <p className="text-2xl font-medium text-center text-gray-200 min-h-[2em]">
          {status}
        </p>

        <CameraCapture onCapture={handleCapture} disabled={processing} />

        <audio ref={audioRef} className="hidden" />

        {pages.length > 0 && (
          <div className="w-full max-w-md">
            <PageStrip pages={pages} activePage={activePage} onPageClick={handlePageClick} />
          </div>
        )}

        {activePage && (
          <div className="w-full max-w-md p-4 bg-gray-900 rounded-xl">
            <p className="text-sm text-gray-400">
              {pages.find((p) => p.page_number === activePage)?.narration_text?.slice(0, 200)}...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
