"use client";
import { useEffect } from "react";
import { Printer } from "lucide-react";

// Floating print bar (hidden when printing) + auto-open the print dialog once.
export function PrintActions() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 print:hidden">
      <span className="text-sm text-slate-600">
        Use your browser&apos;s print dialog to print or “Save as PDF.” Mail via USPS Certified Mail with Return Receipt.
      </span>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        <Printer className="h-4 w-4" /> Print
      </button>
    </div>
  );
}
