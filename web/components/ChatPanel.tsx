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
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <p className="text-base" style={{ color: "var(--text-muted)" }}>
              Ask anything about your captured pages
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`animate-fade-in ${msg.role === "user" ? "flex justify-end" : ""}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[90%]">
                {msg.notInBook && (
                  <p className="text-xs mb-1.5 flex items-center gap-1"
                    style={{ color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--warning)" }}>&#x25CF;</span>
                    Not found in your pages
                  </p>
                )}
                <div className="text-[15px] leading-[1.7] whitespace-pre-wrap"
                  style={{ color: "var(--text-primary)" }}>
                  {renderWithCitations(msg.content, onCitationClick)}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {msg.citations.map((c) => (
                      <button
                        key={c.page}
                        onClick={() => onCitationClick?.(c.page)}
                        className="text-[11px] px-2 py-0.5 rounded font-medium transition-colors hover:opacity-70"
                        style={{
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                        }}
                      >
                        p.{c.page}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="animate-fade-in flex gap-1 py-2">
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-muted)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.15s]" style={{ background: "var(--text-muted)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.3s]" style={{ background: "var(--text-muted)" }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 flex gap-3"
        style={{ borderTop: "1px solid var(--border)" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          autoFocus
          className="flex-1 bg-transparent text-sm py-2 focus:outline-none disabled:opacity-40"
          style={{ color: "var(--text-primary)", caretColor: "var(--accent)" }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-20"
          style={{ color: "var(--accent)" }}
        >
          Send
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
          className="inline text-[11px] px-1 rounded transition-colors hover:opacity-70"
          style={{ color: "var(--accent)", background: "var(--accent-soft)" }}
        >
          p.{pageNum}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
