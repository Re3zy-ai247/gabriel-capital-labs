"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

// Phase 1A-R RB-4 — what render-time placeholder resolution (lib/letter.ts)
// found still missing across this package's not-yet-mailed members. Computed
// server-side in page.tsx (it needs to decrypt letter bodies); passed down so
// the warning renders directly beside the Approve control it gates the
// commitment on.
export interface DownloadPlaceholderWarning {
  senderIncomplete: boolean;
  recipientIncomplete: { letterId: string; recipient: string }[];
  fixRecipientHref: string;
}

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
export function DownloadApproval({
  members,
  placeholderWarning,
}: {
  members: { letterId: string; recipient: string }[];
  placeholderWarning?: DownloadPlaceholderWarning | null;
}) {
  const [reviewed, setReviewed] = useState(false);

  // Phase 1A-R RB-4 — rendered adjacent to the Approve control either way (the
  // button stays as-is, no hard block; the founder ruled out a flow redesign)
  // and again beside the download checklist once reviewed, since re-reading
  // isn't fixed by clicking through. Matches the existing /letters builder
  // warning idiom (AlertTriangle, gold border) — operator chrome, not
  // Kai-voiced, consistent with this whole panel sitting outside the Kai
  // Summary boundary.
  const warning = placeholderWarning && (placeholderWarning.senderIncomplete || placeholderWarning.recipientIncomplete.length > 0) ? (
    <div className="mb-3 flex gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 p-3 text-xs text-gold-400">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Before you mail this</p>
        {placeholderWarning.senderIncomplete && (
          <p className="mt-1">
            Your sender details are incomplete — at least one letter still reads [YOUR FULL NAME] / [YOUR ADDRESS] in
            place of your real name and mailing address.{" "}
            <Link href="/settings" className="font-semibold underline">Complete your profile in Settings →</Link>
          </p>
        )}
        {placeholderWarning.recipientIncomplete.length > 0 && (
          <p className="mt-1">
            The recipient&apos;s mailing address is missing for{" "}
            {placeholderWarning.recipientIncomplete.map((r) => r.recipient).join(", ")} — that letter still reads
            [Furnisher mailing address] and can&apos;t be mailed as printed.{" "}
            <Link href={placeholderWarning.fixRecipientHref} className="font-semibold underline">Add it →</Link>
          </p>
        )}
      </div>
    </div>
  ) : null;

  if (!reviewed) {
    return (
      <div>
        {warning}
        <button onClick={() => setReviewed(true)} className="btn-primary min-h-[44px]">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark reviewed — ready to mail
        </button>
      </div>
    );
  }
  return (
    <div>
      {warning}
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
