"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function ReanalyzeButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function run() {
    setLoading(true);
    try {
      await fetch("/api/reports/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={run} disabled={loading} className="btn-ghost !py-1.5">
      <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {loading ? "Re-analyzing…" : "Re-analyze report"}
    </button>
  );
}
