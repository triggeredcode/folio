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
      className={`text-xs px-2 py-1 rounded-full ${
        status === "checking"
          ? "bg-yellow-900/50 text-yellow-300"
          : "bg-red-900/50 text-red-300"
      }`}
    >
      {status === "checking" ? "Connecting..." : "Backend offline"}
    </div>
  );
}
