"use client";

import { useState, useRef, useEffect } from "react";

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
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--accent-soft)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: "var(--accent)" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-lg font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              Ask about your pages
            </p>
            <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
              Questions are answered only from the pages you&apos;ve captured. Try asking about concepts, diagrams, or definitions.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3"
              style={{
                background: msg.role === "user"
                  ? "var(--accent)"
                  : msg.notInBook
                  ? "#f59e0b15"
                  : "var(--bg-surface)",
                border: msg.role === "user"
                  ? "none"
                  : msg.notInBook
                  ? "1px solid #f59e0b40"
                  : "1px solid var(--border)",
                color: msg.role === "user" ? "white" : "var(--text-primary)",
              }}
            >
              {msg.notInBook && (
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium"
                  style={{ color: "var(--warning)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Not found in your pages
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderWithCitations(msg.content, msg.role === "user" ? undefined : onCitationClick)}
              </p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {msg.citations.map((c) => (
                    <button
                      key={c.page}
                      onClick={() => onCitationClick?.(c.page)}
                      className="text-xs px-2 py-0.5 rounded-md font-medium transition-colors hover:opacity-80"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
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
          <div className="flex justify-start animate-fade-in">
            <div className="rounded-2xl px-5 py-4"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-muted)" }} />
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.15s]" style={{ background: "var(--text-muted)" }} />
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.3s]" style={{ background: "var(--text-muted)" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-3 flex gap-2"
        style={{ borderTop: "1px solid var(--border)" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the captured pages..."
          disabled={loading}
          className="flex-1 rounded-xl px-4 py-3 text-sm placeholder:opacity-50 focus:outline-none disabled:opacity-50"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "var(--border-focus)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "var(--border)";
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
          style={{ background: "var(--accent)", color: "white" }}
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
    if (match && onCitationClick) {
      const pageNum = parseInt(match[1]);
      return (
        <button
          key={i}
          onClick={() => onCitationClick(pageNum)}
          className="inline-flex items-center text-xs px-1.5 py-0.5 rounded mx-0.5 font-medium transition-colors hover:opacity-80"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          p{pageNum}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
