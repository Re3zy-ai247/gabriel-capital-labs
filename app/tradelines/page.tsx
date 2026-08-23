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
// RB-2 (Founder Experience Gate) → RC1-S3 (Credit Truth Core): the CONDITION
// model. `factualCondition` answers what the report actually attests about an
// account — DEROGATORY / CLEAN / NEEDS_REVIEW / NOT_APPLICABLE — and refuses to
// launder silence into either verdict. See lib/intelligence/snapshot.ts.
import { factualCondition } from "@/lib/intelligence/snapshot";
// RC1-S4 (Consumer Fact Confirmation): the vocabulary the consumer confirms
// from, and the panel they confirm in.
import { ASSERTION_CHOICE_BY_TYPE, CONSUMER_NOTE_MAX, choicesForAccountType, isConsumerAssertionType } from "@/lib/letter";
import { FactConfirmation, type ExistingAssertion } from "@/components/tradelines/FactConfirmation";

const BUREAU_ORDER: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  REVOLVING: "Revolving", INSTALLMENT: "Installment", MORTGAGE: "Mortgage",
  COLLECTION: "Collection", CHARGE_OFF: "Charge-off", STUDENT_LOAN: "Student loan",
  PUBLIC_RECORD: "Public record", INQUIRY: "Inquiry", GOVERNMENT: "Government (non-disputable)", OTHER: "Other",
};

export default async function TradelinesPage() {
  const user = await currentUserOrDemo();
  const [tradelines, assertionRows] = user
    ? await Promise.all([
        prisma.tradeline.findMany({ where: { userId: user.id }, orderBy: { score: "desc" } }),
        // RC1-S4: every fact this consumer has confirmed, still standing. One
        // query for the page, grouped below — never one per row.
        prisma.consumerAssertion.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true, tradelineId: true, assertionType: true, consumerNote: true, bureauScope: true, createdAt: true },
          // NOTE: rows whose tradelineId is NULL are ORPHANS — the report they
          // were confirmed against has since been re-analyzed or deleted, and
          // the FK set the link to NULL (review H-2). They are history, not live
          // confirmations, and are skipped below: the freshly parsed row shows
          // as unconfirmed, which is the truth. Their immutable snapshot keeps
          // them meaningful as the authorization record for letters already
          // composed from them.
        }),
      ])
    : [[], []];
  const assertionsByTradeline = new Map<string, ExistingAssertion[]>();
  for (const a of assertionRows) {
    if (!a.tradelineId) continue; // orphaned by re-analysis / report deletion — see the note above
    if (!isConsumerAssertionType(a.assertionType)) continue; // unknown vocabulary → not shown, never invented
    const list = assertionsByTradeline.get(a.tradelineId) ?? [];
    list.push({
      id: a.id,
      assertionType: a.assertionType,
      prompt: ASSERTION_CHOICE_BY_TYPE[a.assertionType].prompt,
      consumerNote: a.consumerNote,
      bureauScope: a.bureauScope,
      bureauLabel: a.bureauScope ? BUREAU_LABEL[a.bureauScope] : null,
      createdAt: a.createdAt.toISOString(),
    });
    assertionsByTradeline.set(a.tradelineId, list);
  }

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

      {/* A1-10: with nothing on file the page used to render 0/0/0 stat cards
          and a table header over an empty body — no explanation, no way
          forward. The empty state now REPLACES both, the way
          app/journey/page.tsx already does it. */}
      {tradelines.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium text-slate-300">Nothing for me to classify yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Upload a credit report and I&apos;ll break down every tradeline — type, balance, bureaus reporting it, and
            my dispute-priority read on each one. You decide what&apos;s wrong; I only draft what you confirm.
          </p>
          <Link href="/upload" className="btn-primary mt-4 inline-flex">Upload your report</Link>
        </div>
      ) : (
      <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="High confidence" value={high} accent="brand" />
        <StatCard label="Medium" value={med} accent="gold" />
        <StatCard label="Weak / low priority" value={weak} />
      </div>

      <div className="card overflow-hidden">
        {/* A1-10: the 12-column grid is a DESKTOP layout. Below md it was
            ~110px of creditor name and ~55px of balance inside an
            overflow-hidden card, which clipped rather than scrolled. The
            header is hidden on small screens (each row carries its own
            labels) and the rows stack instead. */}
        <div className="hidden gap-2 border-b border-ink-700 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500 md:grid md:grid-cols-12">
          <div className="md:col-span-4">Creditor</div>
          <div className="md:col-span-2">Type</div>
          <div className="md:col-span-2">Balance</div>
          <div className="md:col-span-2">Bureaus</div>
          <div className="md:col-span-1">Priority</div>
          <div className="md:col-span-1"></div>
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
          // REMEDIATION M-3: only claims that can be TRUE of this kind of row.
          // An inquiry has no balance, status, payment history or delinquency
          // date, so it is offered the inquiry vocabulary instead of the account
          // one (the API enforces the same rule server-side).
          const availableChoices = choicesForAccountType(t.accountType);
          // Suggested-first ordering. A suggestion is a prompt to LOOK, never a
          // claim: it changes the order of the list and nothing else.
          const suggestedTypes = strat?.suggestedAssertions ?? [];
          const orderedChoices = [
            ...availableChoices.filter((c) => suggestedTypes.includes(c.type)),
            ...availableChoices.filter((c) => !suggestedTypes.includes(c.type)),
          ].map((c) => ({ type: c.type, prompt: c.prompt, help: c.help, requiresNote: c.requiresNote }));
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
          // RC1-S3: the report's own verdict about this account. Three states
          // matter here and they are NOT interchangeable:
          //   DEROGATORY   — the report attests something adverse.
          //   CLEAN        — the report affirmatively states good standing.
          //   NEEDS_REVIEW — we could not tell. Silence, not a verdict.
          // The old code had only "negative" and "not negative", and rendered
          // the second as "Account in good standing — no derogatory history on
          // file." That printed a claim about the consumer's own account that
          // the report had never made (A2-01, inverted): parser silence became
          // a clean bill of health.
          const setAside = t.probability === "NOT_RECOMMENDED";
          const condition = factualCondition(t);
          const clean = !setAside && condition === "CLEAN";
          const unknownStanding = !setAside && condition === "NEEDS_REVIEW";
          // RC1-S4: which rows the consumer can confirm a fact on. Never a
          // CLEAN row (the report says it is fine and nothing is queued), never
          // a set-aside government/statutory debt. DEROGATORY and NEEDS_REVIEW
          // are the two the slice names; INQUIRY rows are included because the
          // product still offers "Dispute →" on them, and without a way to
          // confirm a fact that link would dead-end in the new refusal from
          // POST /api/letters/generate.
          const canAssert = !setAside && condition !== "CLEAN" && t.accountType !== "GOVERNMENT";
          const existingAssertions = assertionsByTradeline.get(t.id) ?? [];
          // Kai's DISPUTE read is shown only where the report itself attests
          // something adverse. On a NEEDS_REVIEW row we do not know what the
          // account's standing is, so presenting a dispute explanation would
          // assert an opportunity we cannot evidence — the same over-claim as
          // the "in good standing" line, pointed the other way. Such a row gets
          // the confirmation panel and the per-bureau data instead, and the
          // consumer decides.
          const showDisputeRead = !setAside && condition === "DEROGATORY";
          // RB-2 RESIDUAL-2: `clean` gates only the dispute/Kai half below —
          // a clean row with real per-bureau field data still expands to show
          // it (restores the pre-RB-2 behavior for that half); it just never
          // expands SOLELY because it has a strategy (the second disjunct is
          // suppressed when clean).
          const expandable = hasDetail || canAssert || showDisputeRead;
          const wrapperClass = `block border-b border-ink-700/50 last:border-0 ${dupSize ? "border-l-2 border-l-ocean-500/50" : ""}`;
          const row = (
            <div className="flex flex-col gap-2 px-4 py-3 text-sm md:grid md:grid-cols-12 md:items-center md:gap-2">
              {/* pr-24 keeps the creditor name clear of the absolutely
                  positioned action overlay on a narrow screen. */}
              <div className="min-w-0 pr-24 md:col-span-4 md:pr-0">
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
                  // ATTRIBUTED, not asserted: this is what the consumer's own
                  // report says, and the sentence says so.
                  <div className="text-xs text-slate-500 md:truncate" title="Your report shows no derogatory status for this account.">
                    Your report shows no derogatory status for this account.
                  </div>
                ) : unknownStanding ? (
                  <div
                    // Wraps on a phone, truncates only where there is a column
                    // to truncate into: this line tells the consumer what to do.
                    className="text-xs text-slate-400 md:truncate"
                    title="We couldn't determine this account's standing from your report — review it yourself."
                  >
                    We couldn&apos;t determine this account&apos;s standing from your report — review it yourself.
                  </div>
                ) : t.reasons[0] && (
                  <div className="truncate text-xs text-slate-500" title={t.reasons[0]}>
                    {t.reasons[0]}
                    {/* Full, untruncated text for screen readers (title alone is unreliable). */}
                    <span className="sr-only"> {t.reasons[0]}</span>
                  </div>
                )}
              </div>
              {/* `md:contents` dissolves this wrapper at the desktop
                  breakpoint so its children sit directly in the 12-column
                  grid; below md they wrap as labelled chips instead of being
                  squeezed into unreadable columns. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 md:contents">
                <div className="text-xs text-slate-400 md:col-span-2">
                  <span className="mr-1 text-slate-500 md:hidden">Type</span>
                  {TYPE_LABEL[t.accountType]}
                </div>
                <div className="text-slate-300 md:col-span-2">
                  <span className="mr-1 text-xs text-slate-500 md:hidden">Balance</span>
                  {formatCents(t.balance)}
                </div>
                <div className="md:col-span-2">
                  <BureauBadges bureaus={present} />
                  {expandable && (
                    <div className="mt-0.5 text-[10px] font-medium text-brand-400">
                      {/* RB-2 RESIDUAL-2 / RC1-S4: the affordance names what is
                          actually behind it. A clean row only ever opens into
                          per-bureau detail; a row the consumer can confirm a
                          fact on says so. */}
                      <span className="group-open:hidden">
                        {clean ? "Bureau detail ▾" : canAssert ? "Review the facts ▾" : "Kai's read ▾"}
                      </span>
                      <span className="hidden group-open:inline">close ▴</span>
                    </div>
                  )}
                </div>
                <div className="md:col-span-1">
                  {clean ? (
                    <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">Clean</span>
                  ) : unknownStanding ? (
                    <span
                      className="pill border border-ink-600 bg-ink-700/60 text-slate-400"
                      title="Your report didn't say enough about this account for us to tell."
                    >
                      Needs review
                    </span>
                  ) : (
                    <ProbabilityBadge p={t.probability} />
                  )}
                </div>
              </div>
              {/* Action lives OUTSIDE this grid (rendered as a sibling overlay) so
                  the interactive Dispute link is never nested inside <summary>. */}
              <div className="hidden md:col-span-1 md:block" aria-hidden />
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
              <span className="text-[11px] text-slate-500" title="Your report shows no derogatory status for this account.">
                nothing to dispute
                <span className="sr-only">. Your report shows no derogatory status for this account.</span>
              </span>
            ) : existingAssertions.length === 0 && canAssert ? (
              // RC1-S4: with nothing confirmed there is nothing to draft from,
              // and POST /api/letters/generate will say so. Sending the
              // consumer to the confirmation instead of to a refusal is the
              // honest affordance — and it is the same <details> panel this
              // row already opens into, so the link is the disclosure itself.
              <span className="text-[11px] text-slate-500">
                confirm the facts first
                <span className="sr-only">
                  . Open this row and confirm which fact is wrong before a letter can be drafted.
                </span>
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
                {/* RC1-S4: the consumer's own account of what is wrong, FIRST —
                    ahead of any read of ours. `suggested` only orders the
                    choices; nothing is pre-selected and no assertion is ever
                    created except by the consumer's own POST. */}
                {canAssert && (
                  <FactConfirmation
                    tradelineId={t.id}
                    creditorName={t.creditorName}
                    choices={orderedChoices}
                    existing={existingAssertions}
                    bureaus={known.map((b) => ({ value: b, label: BUREAU_LABEL[b] }))}
                    suggested={strat?.suggestedAssertions ?? []}
                    noteMax={CONSUMER_NOTE_MAX}
                  />
                )}

                {/* RB-2 RESIDUAL-2 / RC1-S4: the dispute/Kai recommendation
                    half is gated on `showDisputeRead` — a factually clean
                    account, and now an account whose standing the report never
                    stated, both still get the per-bureau comparison below (real
                    data, no dispute read attached), but never Kai's dispute
                    explanation. */}
                {showDisputeRead && (
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
                {conflictLines.length > 0 && showDisputeRead && (
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
      </div>
      </>
      )}
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
