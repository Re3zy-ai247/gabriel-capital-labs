import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { buildMailCenter, buildPackageSummary, HEALTH_LABEL, HEALTH_TONE, type MailLetter } from "@/lib/mailCenter";
import { FileText, ShieldCheck } from "lucide-react";
import { DownloadApproval } from "./DownloadApproval";

export const dynamic = "force-dynamic";

// Package Review + Download (Phase 1A). `packageId` is lib/mailCenter.ts's
// derived grouping key, never a persisted row — this page recomputes the
// user's Dispute Packages from their own Letter rows on every load, exactly
// as /mail does, and looks up the one matching id. No schema, nothing cached.
//
// Download flow choice (FOUNDER-GATE: no new PDF dependency): of the two
// options named in the brief — a combined multi-letter print page, or
// sequential per-letter links presented as a checklist — this reuses the
// EXISTING, unchanged app/letters/print/[id] route per letter (sequential
// links). That is the least-new-surface option: zero changes to the working
// single-letter print/decrypt/enclosure machinery, zero risk of silently
// upgrading past browser print-to-PDF, and it is what the DownloadApproval
// checklist below opens once per letter.
export default async function DownloadPackagePage({ params }: { params: { packageId: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Download package"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const rawLetters = await prisma.letter.findMany({
    where: { userId: user.id },
    include: { tradeline: { select: { creditorName: true } } },
  });
  const letters: MailLetter[] = rawLetters.map((l) => ({
    id: l.id,
    targetBureau: l.targetBureau,
    mailedAt: l.mailedAt,
    responseAt: l.responseAt,
    round: l.round,
    status: l.status,
    recipientName: l.recipientName,
    recipientType: l.recipientType,
    creditorName: l.tradeline?.creditorName ?? null,
    createdAt: l.createdAt,
    hasResponse: Boolean(l.responseText),
    responseOutcome: l.responseOutcome,
    tradelineId: l.tradelineId,
    strategy: l.strategy,
  }));

  const packageId = decodeURIComponent(params.packageId);
  const { packages } = buildMailCenter(letters);
  const pkg = packages.find((p) => p.packageId === packageId);

  if (!pkg) {
    return (
      <AppShell title="/ Download package">
        <div className="card mx-auto max-w-2xl p-6">
          <p className="text-sm text-slate-300">
            This package isn&apos;t here anymore — it may have changed since you opened this link.
          </p>
          <Link href="/mail" className="btn-primary mt-4 inline-flex min-h-[44px]">Back to the Mail Center</Link>
        </div>
      </AppShell>
    );
  }

  // The Kai Summary digest (Phase 1A, Agent E) — the SAME MailLetter rows this
  // page already loaded, scoped to this package's members. Zero AI, zero new
  // query.
  const memberIds = new Set(pkg.members.map((m) => m.letterId));
  const summary = buildPackageSummary(letters.filter((l) => memberIds.has(l.id)));

  return (
    <AppShell title="/ Download package">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">{pkg.recipientSummary}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>Round {pkg.round}{pkg.tradeline ? ` · ${pkg.tradeline}` : ""}</span>
            <span className={`pill border ${HEALTH_TONE[pkg.health]}`}>{HEALTH_LABEL[pkg.health]}</span>
          </p>
        </div>

        {/* Evidence-asymmetry disclosure (Phase 1A honesty triple, part b) —
            wherever Download and Send are both presented. */}
        <p className="mb-4 text-[11px] text-slate-500">
          Evidence differs by path: self-mail leaves your own mailing record as proof. CreditVector Fulfillment
          (soon) adds a certified-mail receipt and tracking evidence once it&apos;s live.
        </p>

        {/* Step 1 — letters list + preview links (existing print route, reused
            verbatim). */}
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Letters in this package</h3>
          <ul className="divide-y divide-ink-700/50">
            {pkg.members.map((m) => (
              <li key={m.letterId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-slate-200">{m.recipient}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{m.mailed ? "Mailed" : "Not mailed yet"}</span>
                  <Link
                    href={`/letters/print/${m.letterId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden /> Preview &amp; print →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Step 2 — Kai Summary: a deterministic digest of this package (Phase
            1A, Agent E fills D's reserved slot) — zero AI, every line a
            receipt off the package's own letters (lib/mailCenter.ts
            buildPackageSummary). Clearly Kai-labeled; the Approve control
            further down stays outside this panel (see the boundary marker
            below it). */}
        <div className="card mt-4 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            <h3 className="text-sm font-semibold">Package summary</h3>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">This package contains</dt>
              <dd className="text-slate-200">{summary.contains}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Strategy</dt>
              <dd className="text-slate-300">{summary.strategyBasis}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">After mailing</dt>
              <dd className="text-slate-300">{summary.afterMailing}</dd>
            </div>
            {pkg.evidence.selfMailNote && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence</dt>
                <dd className="text-slate-300">{pkg.evidence.selfMailNote}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* KAI-PANEL-BOUNDARY: everything below is deliberately OUTSIDE the
            Kai-labeled panel above. app/mail/send/[letterId]/page.tsx's
            Approval() conflates its Approve control with a Kai-labeled card
            (B-MAIL-CENTER-EVOLUTION.md §3.2) — this Download surface applies
            that fix from the start rather than repeating the conflation. */}

        {/* Step 3 — Approve + Download: operator chrome, not Kai-voiced. */}
        <div className="card mt-4 p-5">
          <h3 className="mb-1 text-sm font-semibold">Ready to download?</h3>
          <p className="mb-3 text-sm text-slate-400">
            Review each letter above, then confirm you&apos;re ready — printing, signing, and mailing is still yours to do.
          </p>
          <DownloadApproval members={pkg.members.map((m) => ({ letterId: m.letterId, recipient: m.recipient }))} />
          <p className="mt-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3 text-xs text-slate-400">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-slate-500" aria-hidden />
            CreditVector is an educational tool, not a credit-repair organization or law firm, and this isn&apos;t
            legal advice. Downloading and mailing a dispute starts a process under the FCRA — it doesn&apos;t
            guarantee any item is removed or changed.
          </p>
        </div>

        <div className="mt-4">
          <Link href="/mail" className="btn-ghost min-h-[44px] text-xs">← Back to the Mail Center</Link>
        </div>

        <Disclaimer />
      </div>
    </AppShell>
  );
}
