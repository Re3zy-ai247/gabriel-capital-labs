import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { ProbabilityBadge } from "@/components/ui/Badge";
import { AiPlan } from "./AiPlan";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireSession";
import { formatCents } from "@/lib/utils";
// RB-2 (Founder Experience Gate): a factually clean account (e.g. "pays as
// agreed, never late") must never be presented as a queued dispute
// opportunity — see lib/intelligence/snapshot.ts for the fact test.
// RC1-S3: the queue itself is derived there too, so this page and the Action
// Plan route (app/api/strategist/plan/route.ts) cannot disagree about its
// size — AiPlan compares the two to decide whether a plan has gone stale.
import { disputeQueue, factualCondition } from "@/lib/intelligence/snapshot";

export const dynamic = "force-dynamic";

export default async function StrategistPage() {
  // P0-5: this page had NO guard — an expired session fell through to an empty
  // tradeline list and the Strategy Desk rendered a complete, chrome-and-all
  // "0 High / 0 Medium / 0 Low" reading of a file it had never loaded. The S3
  // truth rework below is only truthful about facts we actually have.
  const user = await requireUser("/strategist");
  const tradelines = await prisma.tradeline.findMany({ where: { userId: user.id }, orderBy: { score: "desc" } });
  const queue = disputeQueue(tradelines);
  const excluded = tradelines.filter((t) => t.probability === "NOT_RECOMMENDED");
  // Everything else: analyzed, disputable in principle, but the report shows
  // nothing derogatory to work from. Listed below rather than silently dropped —
  // an account that vanishes from a page that just said it weighed every item
  // is its own false impression.
  const unqueued = tradelines.filter((t) => t.probability !== "NOT_RECOMMENDED" && !queue.includes(t));
  // The strength cards describe the QUEUE, not the file. Counting a never-late
  // account into "High" told the consumer they had a strong dispute where the
  // report gave us nothing to dispute.
  const counts = {
    HIGH: queue.filter((t) => t.probability === "HIGH").length,
    MEDIUM: queue.filter((t) => t.probability === "MEDIUM").length,
    LOW: queue.filter((t) => t.probability === "LOW").length,
    NR: excluded.length,
  };

  return (
    <AppShell title="/ Strategy Desk">
      <EduBanner />
      <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        Strategy Desk
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {tradelines.length === 0
          ? "This is where I rank your dispute queue — by account type, age, debt-buyer status, and verifiable inconsistencies."
          : queue.length > 0
            ? `I weighed ${tradelines.length === 1 ? "your item" : `all ${tradelines.length} of your items`} against account type, age, debt-buyer status, and verifiable inconsistencies. This is the order I'd work the queue.`
            : `I went through ${tradelines.length === 1 ? "your item" : `all ${tradelines.length} of your items`} and none of them shows something adverse I can rank a dispute around, so there's nothing for me to queue. What I could and couldn't confirm on each one is below.`}
      </p>

      <AiPlan currentItemCount={queue.length} storageKey={`cv-strategy-plan:${user.id}`} />

      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-brand-400">{counts.HIGH}</div><div className="text-[11px] uppercase text-slate-400">High</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-gold-400">{counts.MEDIUM}</div><div className="text-[11px] uppercase text-slate-400">Medium</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-300">{counts.LOW}</div><div className="text-[11px] uppercase text-slate-400">Low</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-rose-300">{counts.NR}</div><div className="text-[11px] uppercase text-slate-400">Excluded</div></div>
      </div>

      {tradelines.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium text-slate-300">Nothing on my desk yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Upload a credit report and I&apos;ll rank every tradeline by dispute strength — the queue builds itself from
            your real data.
          </p>
          <Link href="/upload" className="btn-primary mt-4 inline-flex">Upload your report</Link>
        </div>
      )}

      <div className="space-y-2">
        {/* RC1-S3: every row here is a confirmed factual negative, so the
            "Clean / nothing to dispute" branch this map used to carry is gone —
            a clean or unconfirmed account is no longer ranked at all, and is
            listed honestly below instead of wearing a queue position. */}
        {queue.map((t, i) => (
          <div key={t.id} className="card flex items-center gap-4 p-4">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-xs font-semibold text-slate-300">#{i + 1}</div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-xs font-bold text-brand-300">{t.score}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 truncate font-medium">
                {t.creditorName} <ProbabilityBadge p={t.probability} />
              </div>
              <div className="truncate text-xs text-slate-500">
                {t.reasons[0] || "—"} · {formatCents(t.balance)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Dispute strength</div>
              <div className="text-sm font-semibold text-brand-400">
                {t.probability === "HIGH" ? "Strong" : t.probability === "MEDIUM" ? "Moderate" : "Limited"}
              </div>
            </div>
            <Link href={`/letters?tradeline=${t.id}`} className="btn-ghost shrink-0 text-xs">Dispute →</Link>
          </div>
        ))}
      </div>

      {unqueued.length > 0 && (
        <div className="card mt-5 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-300">Not ranked — nothing derogatory to work from</div>
          <p className="mb-3 text-xs text-slate-400">
            I only rank an item when your report actually shows something adverse on it. These are still on your file
            and still yours to act on — you know it better than any report does.
          </p>
          {unqueued.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border-t border-ink-700/50 py-2 text-sm first:border-0">
              <span className="min-w-0 truncate">{t.creditorName}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {factualCondition(t) === "CLEAN"
                  ? "Your report states this account is in good standing."
                  : "I couldn't confirm this account's standing from what your report gave me."}
              </span>
            </div>
          ))}
          <Link href="/tradelines" className="mt-3 inline-flex text-xs font-semibold text-brand-400 hover:underline">
            See what the report says about each one →
          </Link>
        </div>
      )}

      {excluded.length > 0 && (
        <div className="card mt-5 p-4">
          <div className="mb-2 text-sm font-semibold text-rose-300">I pulled these out of the queue</div>
          <p className="mb-3 text-xs text-slate-400">They&apos;re government or statutory debts that generally cannot be disputed off a report. Disputing them wastes a cycle and can hurt your credibility with the bureaus — so I keep them off the desk.</p>
          {excluded.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-t border-ink-700/50 py-2 text-sm first:border-0">
              <span>{t.creditorName}</span><span className="text-xs text-slate-500">{formatCents(t.balance)}</span>
            </div>
          ))}
        </div>
      )}
      <Disclaimer />
    </AppShell>
  );
}
