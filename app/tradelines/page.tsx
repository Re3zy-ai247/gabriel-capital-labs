import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { ProbabilityBadge, BureauBadges } from "@/components/ui/Badge";
import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { StatCard } from "@/components/ui/StatCard";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import type { Bureau } from "@prisma/client";
import { presentBureaus, getBureauData, crossBureauConflicts, conflictFields } from "@/lib/bureauData";
import { BUREAU_SHORT, BUREAU_LABEL } from "@/lib/bureaus";
import { formatCents, formatDate } from "@/lib/utils";
import { fallOffInsight, formatMonthYear, duplicateGroups, groupAdjacentOrder } from "@/lib/tradelineInsights";
import { StatuteCard } from "@/components/StatuteCard";
import type { StatuteKey } from "@/lib/statutes";
import { explainTradeline } from "@/lib/explain";
import { recommendStrategy } from "@/lib/recommend";
import { KaiWhy } from "@/components/kai/KaiWhy";
import { RecommendationIntelPanel } from "@/components/kai/RecommendationIntel";
import { recommendationIntel } from "@/lib/recommendationIntel";
// RB-2 (Founder Experience Gate): a factually clean account (e.g. "pays as
// agreed, never late") must never be presented as a queued dispute
// opportunity — see lib/intelligence/snapshot.ts for the fact test.
import { isFactualNegative } from "@/lib/intelligence/snapshot";

const BUREAU_ORDER: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  REVOLVING: "Revolving", INSTALLMENT: "Installment", MORTGAGE: "Mortgage",
  COLLECTION: "Collection", CHARGE_OFF: "Charge-off", STUDENT_LOAN: "Student loan",
  PUBLIC_RECORD: "Public record", INQUIRY: "Inquiry", GOVERNMENT: "Government (non-disputable)", OTHER: "Other",
};

export default async function TradelinesPage() {
  const user = await currentUserOrDemo();
  const tradelines = user ? await prisma.tradeline.findMany({ where: { userId: user.id }, orderBy: { score: "desc" } }) : [];

  const high = tradelines.filter((t) => t.probability === "HIGH").length;
  const med = tradelines.filter((t) => t.probability === "MEDIUM").length;
  const weak = tradelines.filter((t) => t.probability === "LOW").length;

  // Real aggregate findings from fields already loaded — never invented.
  const conflictCount = tradelines.filter((t) => crossBureauConflicts(getBureauData(t.bureauData)).length > 0).length;
  const obsoleteCount = tradelines.filter((t) => t.reasons.some((r) => r.includes("§605"))).length;
  const debtBuyerCount = tradelines.filter((t) => t.isDebtBuyer).length;
  const groups = duplicateGroups(tradelines);
  const dupCount = tradelines.filter((t) => t.duplicateGroup && groups.has(t.duplicateGroup)).length;
  const setAsideCount = tradelines.filter((t) => t.probability === "NOT_RECOMMENDED").length;
  const findings = [
    conflictCount > 0 && `${conflictCount} carr${conflictCount === 1 ? "ies" : "y"} cross-bureau inconsistencies`,
    obsoleteCount > 0 && `${obsoleteCount} ${obsoleteCount === 1 ? "is" : "are"} past the §605 reporting window`,
    dupCount > 0 && `${dupCount} appear to be the same underlying debt reported more than once`,
    debtBuyerCount > 0 && `${debtBuyerCount} ${debtBuyerCount === 1 ? "is a debt-buyer collection" : "are debt-buyer collections"}`,
    setAsideCount > 0 &&
      `${setAsideCount} ${setAsideCount === 1 ? "is" : "are"} government/statutory — I set ${setAsideCount === 1 ? "it" : "them"} aside so you don't spend a dispute round where it can't work`,
  ].filter(Boolean);
  const ordered = groupAdjacentOrder(tradelines, groups);

  // Contextual statute cards (W13) — only the laws this user's rows actually
  // invoke, never a generic law dump.
  const relevantStatutes: StatuteKey[] = [];
  if (tradelines.some((t) => t.probability !== "NOT_RECOMMENDED")) relevantStatutes.push("fcra_611");
  if (obsoleteCount > 0 || tradelines.some((t) => t.reasons.some((r) => r.includes("§605")))) relevantStatutes.push("fcra_605");
  if (tradelines.some((t) => t.accountType === "COLLECTION")) relevantStatutes.push("fdcpa_809");

  return (
    <AppShell title="/ Tradelines">
      <EduBanner />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tradeline Analysis</h2>
        <ReanalyzeButton />
      </div>

      {tradelines.length > 0 && (
        <div className="card mb-4 p-4">
          <p className="text-sm text-slate-300">
            <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            I classified {tradelines.length === 1 ? "the tradeline" : `all ${tradelines.length} tradelines`} on your report.{" "}
            {findings.length > 0
              ? `${findings.join(", ")}. My read on each item is in its row.`
              : "No §605 or cross-bureau flags stand out yet — my read on each item is in its row."}
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="High confidence" value={high} accent="brand" />
        <StatCard label="Medium" value={med} accent="gold" />
        <StatCard label="Weak / low priority" value={weak} />
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-ink-700 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500">
          <div className="col-span-4">Creditor</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Balance</div>
          <div className="col-span-2">Bureaus</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1"></div>
        </div>
        {ordered.map((t) => {
          const data = getBureauData(t.bureauData);
          const present = presentBureaus(data).map((b) => BUREAU_SHORT[b]);
          const dupSize = t.duplicateGroup ? groups.get(t.duplicateGroup) : undefined;
          const fallOff = fallOffInsight(t);
          // Quiet countdown chip only when the §605 clock is actually in play:
          // already past the window, or ending within two years. Silence otherwise.
          const showClock = fallOff && (fallOff.pastWindow || fallOff.monthsRemaining <= 24);
          // W2 — "this account appears N ways": expandable only when at least one
          // bureau gave us real field data to show. Absence of data stays silent.
          const known = BUREAU_ORDER.filter((b) => data[b]);
          const hasDetail = known.some((b) => {
            const f = data[b]!;
            return Boolean(f.status || f.balanceCents != null || f.dateReported || f.dofd || f.remarks);
          });
          const diff = conflictFields(data);
          const conflictLines = crossBureauConflicts(data);
          // Kai Explainability Layer — the structured "why" for this item, from
          // real data + the deterministic engines. Every DISPUTABLE row expands
          // so the recommendation can always answer "why", even single-bureau.
          const strat = t.probability !== "NOT_RECOMMENDED"
            ? recommendStrategy({ accountType: t.accountType, isDebtBuyer: t.isDebtBuyer, probability: t.probability, dateOfFirstDelinquency: t.dateOfFirstDelinquency, bureauData: t.bureauData, creditorName: t.creditorName })
            : null;
          const explanation = explainTradeline({
            accountType: t.accountType, isDebtBuyer: t.isDebtBuyer, balance: t.balance,
            probability: t.probability, reasons: t.reasons, dateOfFirstDelinquency: t.dateOfFirstDelinquency,
            bureauData: t.bureauData, creditorName: t.creditorName, recommendedStrategy: strat?.strategyId ?? null,
          });
          // Engine 2 recommendation intelligence — own-data + deterministic engines.
          // Cross-user history stays gated (no CCO consumer approval yet) → shows
          // the honest "still gathering data" state.
          const intel = strat ? recommendationIntel({
            accountType: t.accountType, isDebtBuyer: t.isDebtBuyer, balance: t.balance,
            probability: t.probability, reasons: t.reasons, dateOfFirstDelinquency: t.dateOfFirstDelinquency,
            bureauData: t.bureauData, creditorName: t.creditorName, recommendedStrategy: strat.strategyId,
          }) : null;
          // RB-2 (Founder Experience Gate): a factually clean account (no
          // derogatory account type, no delinquency event on file) never
          // expands into Kai's dispute read — there is nothing to explain.
          // Gated on NOT_RECOMMENDED too so a government/statutory debt (which
          // is also outside isFactualNegative's definition, for a DIFFERENT
          // reason — it can't be effectively disputed off a report, not that
          // it's in good standing) keeps its existing "set aside" treatment
          // below instead of being mislabeled clean.
          const clean = t.probability !== "NOT_RECOMMENDED" && !isFactualNegative(t);
          // RB-2 RESIDUAL-2: `clean` gates only the dispute/Kai half below —
          // a clean row with real per-bureau field data still expands to show
          // it (restores the pre-RB-2 behavior for that half); it just never
          // expands SOLELY because it has a strategy (the second disjunct is
          // suppressed when clean).
          const expandable = hasDetail || (t.probability !== "NOT_RECOMMENDED" && !clean);
          const wrapperClass = `block border-b border-ink-700/50 last:border-0 ${dupSize ? "border-l-2 border-l-ocean-500/50" : ""}`;
          const row = (
            <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
              <div className="col-span-4 min-w-0">
                <div className="truncate font-medium">
                  {t.creditorName}
                  {t.isDebtBuyer && <span className="ml-2 pill bg-rose-500/10 text-rose-300">debt buyer</span>}
                </div>
                {(dupSize || showClock) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dupSize && (
                      <span
                        className="pill border border-ocean-500/30 bg-ocean-500/10 text-ocean-300"
                        title={`These ${dupSize} entries appear to report the same underlying debt. They're grouped together here — start with the strongest one.`}
                      >
                        same debt ×{dupSize}
                      </span>
                    )}
                    {showClock && fallOff.pastWindow && (
                      <span
                        className="pill border border-brand-500/30 bg-brand-500/10 text-brand-300"
                        title={`Past the ${fallOff.windowYears}-year FCRA §605 reporting window based on the first-delinquency date on file — a strong obsolescence dispute.`}
                      >
                        §605 window passed
                      </span>
                    )}
                    {showClock && !fallOff.pastWindow && (
                      <span
                        className="pill border border-ink-600 bg-ink-700/60 text-slate-400"
                        title={`FCRA §605 limits how long this can report. Based on the first-delinquency date on file, its window ends around ${formatMonthYear(fallOff.fallOffDate)}.`}
                      >
                        §605 window ends ~{formatMonthYear(fallOff.fallOffDate)}
                      </span>
                    )}
                  </div>
                )}
                {clean ? (
                  <div className="truncate text-xs text-slate-500" title="Account in good standing — no derogatory history on file.">
                    Account in good standing — no derogatory history on file.
                  </div>
                ) : t.reasons[0] && (
                  <div className="truncate text-xs text-slate-500" title={t.reasons[0]}>
                    {t.reasons[0]}
                    {/* Full, untruncated text for screen readers (title alone is unreliable). */}
                    <span className="sr-only"> {t.reasons[0]}</span>
                  </div>
                )}
              </div>
              <div className="col-span-2 text-xs text-slate-400">{TYPE_LABEL[t.accountType]}</div>
              <div className="col-span-2 text-slate-300">{formatCents(t.balance)}</div>
              <div className="col-span-2">
                <BureauBadges bureaus={present} />
                {expandable && (
                  <div className="mt-0.5 text-[10px] font-medium text-brand-400">
                    {/* RB-2 RESIDUAL-2: a clean row can only expand into the
                        per-bureau detail (never Kai's dispute read), so the
                        affordance label says so honestly. */}
                    <span className="group-open:hidden">{clean ? "Bureau detail ▾" : "Kai's read ▾"}</span>
                    <span className="hidden group-open:inline">close ▴</span>
                  </div>
                )}
              </div>
              <div className="col-span-1">{clean ? <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">Clean</span> : <ProbabilityBadge p={t.probability} />}</div>
              {/* Action lives OUTSIDE this grid (rendered as a sibling overlay) so
                  the interactive Dispute link is never nested inside <summary>. */}
              <div className="col-span-1" aria-hidden />
            </div>
          );

          const action =
            t.probability === "NOT_RECOMMENDED" ? (
              <span
                className="text-[11px] text-slate-500"
                title={t.reasons[0] ?? "Government/statutory debt generally can't be disputed off a report — I've excluded it so you don't waste a round."}
              >
                set aside
                <span className="sr-only">. {t.reasons[0] ?? "Government or statutory debt generally can't be disputed off a report, so it's excluded so you don't waste a round."}</span>
              </span>
            ) : clean ? (
              // RB-2: honest state for a factually clean account — never a
              // live "Dispute" action presented next to a queued opportunity.
              <span className="text-[11px] text-slate-500" title="Account in good standing — no derogatory history on file.">
                nothing to dispute
                <span className="sr-only">. Account in good standing — no derogatory history on file.</span>
              </span>
            ) : (
              <Link
                href={`/letters?tradeline=${t.id}`}
                className="inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-400 underline-offset-2 hover:text-brand-300 hover:underline"
              >
                Dispute →
              </Link>
            );

          if (!expandable) {
            return (
              <div key={t.id} className={`relative ${wrapperClass}`}>
                {row}
                <div className="absolute right-4 top-3 z-10 text-right">{action}</div>
              </div>
            );
          }
          return (
            <details key={t.id} className={`group relative ${wrapperClass}`}>
              <summary className="block cursor-pointer list-none transition hover:bg-ink-800/40 focus-visible:bg-ink-800/40 [&::-webkit-details-marker]:hidden">
                {row}
              </summary>
              {/* Sibling of <summary>, pinned to the header row — keeps the
                  interactive Dispute CTA out of the disclosure toggle. */}
              <div className="pointer-events-none absolute right-4 top-3 z-10 text-right [&_a]:pointer-events-auto">{action}</div>
              <div className="space-y-3 border-t border-ink-700/40 bg-ink-800/30 px-4 py-4">
                {/* RB-2 RESIDUAL-2: the dispute/Kai recommendation half is
                    gated on `!clean` — a factually clean account still gets
                    the per-bureau comparison below (real data, no dispute
                    read attached), but never Kai's dispute explanation. */}
                {!clean && (
                  <>
                    {/* The structured "why" — always present for a disputable row. */}
                    <KaiWhy e={explanation} />
                    {intel && <RecommendationIntelPanel intel={intel} />}
                  </>
                )}

                {/* Per-bureau side-by-side, only when we hold real field data. */}
                {hasDetail && (
                <div>
                {/* Phase 1A-R M5 (CCO correction): the "that's the dispute
                    angle" framing never renders for a factually clean row —
                    the per-bureau comparison table itself (below) still
                    shows for clean rows with real field data; only this
                    dispute-angle sentence is gated on `!clean`. */}
                {conflictLines.length > 0 && !clean && (
                  <p className="mb-3 text-xs text-slate-300">
                    <span className="mr-2 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                    This account doesn&apos;t tell one story: {conflictLines.join(" ")} Inconsistent data can&apos;t all
                    be accurate — that&apos;s the dispute angle.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  {known.map((b) => {
                    const f = data[b]!;
                    if (f.presence === "ABSENT") {
                      return (
                        <div key={b} className="rounded-lg border border-ink-700 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{BUREAU_LABEL[b]}</div>
                          <p className="mt-1.5 text-xs text-slate-500">Not reporting this account.</p>
                        </div>
                      );
                    }
                    return (
                      <div key={b} className="rounded-lg border border-ink-700 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{BUREAU_LABEL[b]}</div>
                        <dl className="mt-2 space-y-1 text-xs">
                          {f.status && <Field label="Status" value={f.status} hot={diff.has("status")} />}
                          {f.balanceCents != null && <Field label="Balance" value={formatCents(f.balanceCents)} hot={diff.has("balance")} />}
                          {f.dateReported && <Field label="Reported" value={formatDate(f.dateReported)} />}
                          {f.dofd && <Field label="First delinquency" value={formatDate(f.dofd)} hot={diff.has("dofd")} />}
                          {f.remarks && <Field label="Remarks" value={f.remarks} />}
                        </dl>
                      </div>
                    );
                  })}
                </div>
                </div>
                )}
              </div>
            </details>
          );
        })}
        {!tradelines.length && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-300">Nothing for me to classify yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
              Upload a credit report and I&apos;ll break down every tradeline — type, balance, bureaus reporting it, and
              my dispute-priority read on each one.
            </p>
            <Link href="/upload" className="btn-primary mt-4 inline-flex">Upload your report</Link>
          </div>
        )}
      </div>
      {relevantStatutes.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-slate-200">The law behind these reads</h3>
            <span className="text-[11px] text-slate-500">only the statutes your rows actually invoke</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {relevantStatutes.map((k) => (
              <StatuteCard key={k} statute={k} />
            ))}
          </div>
        </div>
      )}
      <Disclaimer />
    </AppShell>
  );
}

// One labeled value in a bureau's comparison card. `hot` marks a field that
// crossBureauConflicts flagged as disagreeing across bureaus.
function Field({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd
        className={`text-right ${hot ? "font-semibold text-gold-400" : "text-slate-300"}`}
        title={hot ? "This value differs across the bureaus reporting this account." : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
