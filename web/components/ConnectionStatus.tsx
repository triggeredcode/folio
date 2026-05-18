"use client";

import { useEffect, useState } from "react";

export default function ConnectionStatus() {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/health");
        setStatus(res.ok ? "connected" : "disconnected");
      } catch {
        setStatus("disconnected");
      }
    }
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  if (status === "connected") return null;

  return (
    <div
      className="fixed top-3 right-3 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 z-50"
      style={{
        background: status === "checking" ? "#f59e0b20" : "#ef444420",
        color: status === "checking" ? "var(--warning)" : "var(--danger)",
        border: `1px solid ${status === "checking" ? "#f59e0b40" : "#ef444440"}`,
      }}
    >
      <div
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ background: status === "checking" ? "var(--warning)" : "var(--danger)" }}
      />
      {status === "checking" ? "Connecting..." : "Backend offline"}
    </div>
  );
}
