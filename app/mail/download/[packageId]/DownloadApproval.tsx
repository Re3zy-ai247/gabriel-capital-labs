"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText } from "lucide-react";

// The Approve control for the Download context (Phase 1A). Deliberately a
// LOCAL, non-persisted confirmation — there is no schema for a "package
// reviewed" flag, and the package itself is a derived read-model, never a
// stored row (lib/mailCenter.ts's groupIntoPackages). Confirming reveals the
// download checklist; nothing is written to the server here — Download never
// calls MailService (per the R1 law: Download needs no wallet, no submit, no
// hold — that machinery is Send-with-CreditVector-Fulfillment's alone).
//
// This component renders OUTSIDE the Kai Summary panel (see the KAI-PANEL-
// BOUNDARY comment in page.tsx) — the split app/mail/send/[letterId]/page.tsx
// still owes itself (B-MAIL-CENTER-EVOLUTION.md §3.2's "Approval() conflates
// the Kai badge with the Approve control" finding) is applied here from the
// start, not retrofitted.
export function DownloadApproval({ members }: { members: { letterId: string; recipient: string }[] }) {
  const [reviewed, setReviewed] = useState(false);

  if (!reviewed) {
    return (
      <button onClick={() => setReviewed(true)} className="btn-primary min-h-[44px]">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark reviewed — ready to mail
      </button>
    );
  }
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm text-success-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Reviewed — download each letter below, then mail them together.
      </p>
      <ol className="space-y-1.5 text-sm">
        {members.map((m, i) => (
          <li key={m.letterId} className="flex items-center gap-2">
            <span className="tnum text-xs text-slate-500">{i + 1}.</span>
            <Link
              href={`/letters/print/${m.letterId}`}
              target="_blank"
              className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden /> Download &amp; print — {m.recipient} →
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
