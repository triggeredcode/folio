"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleModeSelect(mode: "reader" | "tutor") {
    setLoading(true);
    try {
      const session = await createSession(mode);
      localStorage.setItem("folio_session_id", session.session_id);
      localStorage.setItem("folio_mode", mode);
      router.push(`/${mode}?session=${session.session_id}`);
    } catch (err) {
      alert("Failed to connect to Folio backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">Folio</h1>
          <p className="text-lg text-gray-400">
            Reads any book aloud, teaches what it sees.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={() => handleModeSelect("reader")}
            disabled={loading}
            className="w-full p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/50 hover:border-purple-500 transition-all group disabled:opacity-50"
          >
            <div className="text-3xl mb-2">🔊</div>
            <h2 className="text-xl font-semibold mb-1 group-hover:text-purple-300">
              Reader Mode
            </h2>
            <p className="text-sm text-gray-400">
              Voice-first. Point your camera at a page — Folio reads it aloud and
              describes diagrams.
            </p>
          </button>

          <button
            onClick={() => handleModeSelect("tutor")}
            disabled={loading}
            className="w-full p-6 rounded-2xl bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/50 hover:border-blue-500 transition-all group disabled:opacity-50"
          >
            <div className="text-3xl mb-2">💬</div>
            <h2 className="text-xl font-semibold mb-1 group-hover:text-blue-300">
              Tutor Mode
            </h2>
            <p className="text-sm text-gray-400">
              Chat-first. Capture your chapter, then ask questions — answers come
              only from your book.
            </p>
          </button>
        </div>

        <p className="text-xs text-gray-600 pt-4">
          Powered by Gemma 4 · Everything runs locally · Your book never leaves this device
        </p>
      </div>
    </main>
  );
}
