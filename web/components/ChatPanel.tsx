"use client";

import { useState, useRef, useEffect } from "react";
import { AskResponse } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { page: number }[];
  notInBook?: boolean;
}

interface ChatPanelProps {
  onSend: (question: string) => void;
  messages: Message[];
  loading?: boolean;
  onCitationClick?: (pageNumber: number) => void;
}

export default function ChatPanel({
  onSend,
  messages,
  loading = false,
  onCitationClick,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    onSend(q);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg mb-2">Ask about what you&apos;ve captured</p>
            <p className="text-sm">
              Questions are answered only from the pages in your session.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : msg.notInBook
                  ? "bg-amber-900/50 border border-amber-600/50 text-amber-100"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {renderWithCitations(msg.content, onCitationClick)}
              </p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {msg.citations.map((c) => (
                    <button
                      key={c.page}
                      onClick={() => onCitationClick?.(c.page)}
                      className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full hover:bg-blue-500/40"
                    >
                      Page {c.page}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the captured pages..."
          disabled={loading}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function renderWithCitations(
  text: string,
  onCitationClick?: (page: number) => void
): React.ReactNode[] {
  const parts = text.split(/(\[page\s+\d+\])/gi);
  return parts.map((part, i) => {
    const match = part.match(/\[page\s+(\d+)\]/i);
    if (match) {
      const pageNum = parseInt(match[1]);
      return (
        <button
          key={i}
          onClick={() => onCitationClick?.(pageNum)}
          className="inline-flex items-center text-xs bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded mx-0.5 hover:bg-blue-500/50"
        >
          p{pageNum}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
