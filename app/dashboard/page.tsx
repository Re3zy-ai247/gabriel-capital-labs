import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { StatCard } from "@/components/ui/StatCard";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { BUREAU_LABEL } from "@/lib/bureaus";
import { yearsSince } from "@/lib/utils";
import { getKaiHomeData, REINVESTIGATION_DAYS } from "@/lib/kaiHome";
import type { Bureau } from "@prisma/client";

export const dynamic = "force-dynamic";

// Kai Home (ADR-0007 E2): the dashboard as a morning briefing — overnight
// delta, one recommended action with its receipt, the deadline radar, and a
// timeline snippet. All passive intelligence; zero AI calls on this page.
export default async function DashboardPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Kai Home"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const [tradelines, letters, reports, kai] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId: user.id } }),
    prisma.letter.findMany({ where: { userId: user.id } }),
    prisma.report.findMany({ where: { userId: user.id } }),
    getKaiHomeData(user.id),
  ]);

  // Single source of truth — every metric derives from these arrays so they reconcile.
  const negative = tradelines.length;
  const resolved = tradelines.filter((t) => t.resolved).length;
  const disputedIds = new Set(letters.map((l) => l.tradelineId).filter(Boolean));
  const disputed = disputedIds.size;
  const active = tradelines.filter((t) => disputedIds.has(t.id) && !t.resolved).length;
  const completion = negative ? Math.round((resolved / negative) * 100) : 0;

  // Quick wins: items past the 7-year FCRA §605 reporting window are the cleanest
  // removals (must drop off), so they should be attacked first.
  const aged = tradelines
    .filter((t) => !t.resolved)
    .map((t) => ({ t, yrs: yearsSince(t.dateOfFirstDelinquency) }))
    .filter((x): x is { t: (typeof tradelines)[number]; yrs: number } => x.yrs != null);
  const obsolete = aged.filter((x) => x.yrs >= 7).sort((a, b) => b.yrs - a.yrs);
  const nearObsolete = aged.filter((x) => x.yrs >= 6 && x.yrs < 7);

  const firstName = (user.fullName || user.name || "").trim().split(" ")[0] || "there";

  const byBureau = (b: Bureau) => {
    const inB = tradelines.filter((t) => {
      const d = t.bureauData as Record<string, { presence?: string }>;
      return d?.[b]?.presence === "PRESENT";
    });
    const res = inB.filter((t) => t.resolved).length;
    return { total: inB.length, resolved: res };
  };

  const eventLabel = (e: (typeof kai.recentEvents)[number]) => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    // Verb-first labels — each line reads as work done, not paperwork filed.
    switch (e.type) {
      case "report.uploaded": return "Uploaded a credit report";
      case "report.analyzed": return `Analyzed the report — ${String(p.tradelines ?? "")} accounts reviewed`;
      case "letter.generated": return "Generated a dispute letter";
      case "letter.mailed": return `Mailed Round ${String(p.round ?? "")} to ${String(p.recipient ?? "the bureau")}`;
      case "response.received": return `Logged a bureau response (${String(p.outcome ?? "recorded")})`;
      case "dispute.resolved": return "Marked an item resolved";
      default: return e.type;
    }
  };

  return (
    <AppShell title="/ Kai Home">
      <EduBanner />

      {/* Greeting — neutral wording on purpose: the server can't know the user's
          local time-of-day, and a wrong "good morning" costs more trust than a
          right one earns (Art. II applied to microcopy). */}
      <div className="mb-4 animate-rise">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
          <h2 className="text-2xl font-bold">Welcome back, {firstName}.</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {kai.overnight.length > 0 ? "Here's what I logged in the last two days:" : "I checked today. No new activity in the last two days — here's where everything stands."}
        </p>
        {kai.overnight.length > 0 && (
          <ul className="mt-2 space-y-1">
            {kai.overnight.map((o, i) => (
              <li key={i} className="text-sm text-slate-300">
                <span className="mr-1.5 text-brand-400" aria-hidden>✓</span>
                <Link href={o.href} className="hover:underline">{o.text}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* KAI RECOMMENDS — one action at a time, always with its receipt.
          Staggered entrance behind the greeting (the only two animated entries
          in the first viewport); .animate-rise-stagger respects reduced motion. */}
      {kai.recommendation && (
        <div className="card animate-rise-stagger mb-4 border-brand-500/40 bg-brand-500/[0.06] p-5" style={{ animationDelay: "90ms" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-300">Kai recommends</div>
          <div className="mt-1.5 text-base font-semibold">{kai.recommendation.title}</div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{kai.recommendation.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={kai.recommendation.href} className="btn-primary">{kai.recommendation.cta} →</Link>
            <span className="text-[11px] text-slate-500">{kai.recommendation.basis}</span>
          </div>
        </div>
      )}

      {/* Deadline radar — the §611 clock, per unanswered mailed letter. */}
      {kai.deadlines.length > 0 && (
        <div className="card mb-4 border-gold-500/30 bg-gold-500/[0.05] p-5">
          <div className="text-sm font-semibold text-gold-300">⏱ Deadline radar</div>
          <p className="mt-1 text-xs text-slate-400">
            Bureaus have ~{REINVESTIGATION_DAYS} days to reinvestigate after a dispute is mailed (FCRA §611). When a window closes, log the response or escalate.
          </p>
          <div className="mt-3 space-y-2">
            {kai.deadlines.map((d) => {
              const overdue = d.daysLeft <= 0;
              const closing = d.daysLeft > 0 && d.daysLeft <= 5;
              const dayNow = Math.min(REINVESTIGATION_DAYS, Math.max(0, d.daysElapsed));
              const pct = Math.min(100, Math.round((d.daysElapsed / REINVESTIGATION_DAYS) * 100));
              const clockLabel = `Response window: day ${dayNow} of ${REINVESTIGATION_DAYS} since mailing`;
              return (
                <div
                  key={d.letterId}
                  className={`rounded-lg border p-3 ${
                    overdue ? "border-rose-500/40 bg-rose-500/[0.05]" : closing ? "border-gold-500/40" : "border-ink-700/70"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">{d.recipient}</span>
                      <span className="ml-2 text-[11px] text-slate-500">Round {d.round} · day {d.daysElapsed} of {REINVESTIGATION_DAYS}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div
                        className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-ink-700 sm:block"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={REINVESTIGATION_DAYS}
                        aria-valuenow={dayNow}
                        aria-label={clockLabel}
                      >
                        <div className={`h-full ${overdue ? "bg-rose-500" : "bg-gold-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <Link href="/letters" className={`text-xs font-semibold hover:underline ${overdue ? "text-rose-300" : "text-slate-400"}`}>
                        {overdue ? "Window passed — act →" : `${d.daysLeft}d left`}
                      </Link>
                    </div>
                  </div>
                  {/* Mobile: the clock shows as a thin full-width bar under the row instead of disappearing. */}
                  <div
                    className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-700 sm:hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={REINVESTIGATION_DAYS}
                    aria-valuenow={dayNow}
                    aria-label={clockLabel}
                  >
                    <div className={`h-full ${overdue ? "bg-rose-500" : "bg-gold-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reports.length === 0 && !kai.recommendation && (
        <div className="card mb-4 flex flex-col items-start gap-3 border-brand-500/30 bg-brand-500/5 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold">Let&apos;s get started</div>
            <p className="mt-1 text-sm text-slate-400">
              Upload your credit report and Kai will analyze every account, flag what can be disputed, and draft your letters.
            </p>
          </div>
          <Link href="/upload" className="btn-primary shrink-0">Upload your report</Link>
        </div>
      )}

      {obsolete.length > 0 && (
        <div className="card mb-4 border-success-500/30 bg-success-500/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-success-300">
            ⚡ Quick Wins — easiest disputes first
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {obsolete.length} item{obsolete.length === 1 ? " is" : "s are"} past the 7-year FCRA reporting window (§605)
            and may no longer be reported. These are the cleanest disputes to open — the statute does the heavy lifting.
          </p>
          <div className="mt-3 space-y-2">
            {obsolete.slice(0, 6).map(({ t, yrs }) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.creditorName}</div>
                  <div className="text-[11px] text-slate-500">
                    First delinquency ~{Math.floor(yrs)} years ago · obsolete under FCRA §605
                  </div>
                </div>
                <Link
                  href={`/letters?tradeline=${t.id}&strategy=fcra_605`}
                  className="btn-primary shrink-0 !py-1.5 text-xs"
                >
                  Dispute as obsolete →
                </Link>
              </div>
            ))}
          </div>
          {(obsolete.length > 6 || nearObsolete.length > 0) && (
            <p className="mt-3 text-[11px] text-slate-500">
              {obsolete.length > 6 ? `+ ${obsolete.length - 6} more obsolete ${obsolete.length - 6 === 1 ? "item" : "items"}. ` : ""}
              {nearObsolete.length > 0
                ? `${nearObsolete.length} ${nearObsolete.length === 1 ? "item is" : "items are"} approaching the window (6+ years) — queue these next.`
                : ""}
            </p>
          )}
        </div>
      )}

      {/* Four numbers, each one a decision: what's wrong, what's engaged, what's
          in flight, what's already won. Activity counters (letters generated,
          reports uploaded) live on their own pages — not here. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Negative Items" value={negative} accent="rose" />
        <StatCard label="Items Disputed" value={disputed} accent="slate" />
        <StatCard label="Active Disputes" value={active} accent="gold" />
        <StatCard label="Items Resolved" value={resolved} accent="success" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">Dispute Completion</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="tnum text-3xl font-bold text-brand-400">{completion}%</div>
            <div className="pb-1 text-xs text-slate-500">{resolved} of {negative} items resolved</div>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion}
            aria-label={`Dispute completion: ${resolved} of ${negative} items resolved`}
          >
            <div className="h-full bg-brand-500" style={{ width: `${completion}%` }} />
          </div>
        </div>
        {/* Real derived signal (replaces the old estimated-points placeholder — CX-2). */}
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">Responses Received</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="tnum text-3xl font-bold text-gold-400">
              {kai.responsesReceived}<span className="text-lg text-slate-500"> / {kai.lettersMailed}</span>
            </div>
            <div className="pb-1 text-xs text-slate-500">responses to mailed disputes</div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Log each bureau reply on the letter — Kai reads it and lines up your next round.
          </p>
        </div>
      </div>

      <div className="card mt-3 p-5">
        <div className="mb-3 text-sm font-semibold">Dispute Progress by Bureau</div>
        {(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).map((b) => {
          const s = byBureau(b);
          const pct = s.total ? Math.round((s.resolved / s.total) * 100) : 0;
          return (
            <div key={b} className="mb-3 last:mb-0">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{BUREAU_LABEL[b]}</span>
                <span>{s.resolved} of {s.total} resolved</span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`${BUREAU_LABEL[b]}: ${s.resolved} of ${s.total} resolved`}
              >
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline snippet — the last few real events, linking to the full story. */}
      {kai.recentEvents.length > 0 && (
        <div className="card mt-3 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Your timeline</div>
            <Link href="/journey" className="text-xs font-semibold text-brand-400 hover:underline">view all →</Link>
          </div>
          <div className="space-y-2">
            {kai.recentEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-300">{eventLabel(e)}</span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {new Date(e.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Disclaimer />
    </AppShell>
  );
}
