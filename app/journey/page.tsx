import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireSession";
import { listKaiEvents } from "@/lib/kaiEvents";
import { getKaiHomeData } from "@/lib/kaiHome";
import { WATCHING_CLOCK_LINE } from "@/lib/mailCenter";
import { REINVESTIGATION_DAYS, daysElapsedSinceEstimatedReceipt } from "@/lib/forecast";
import { CheckCircle2, Circle, FileText, Mail, MailOpen, Search, Sparkles, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

// THE timeline (ADR-0007 E1 consumer; CX-3 merged the old static journey into
// this page). Sources, deduped: live KaiEvents + history synthesized from the
// user's own rows (reports/letters created before the event stream existed) +
// derived upcoming deadlines. One timeline — never two.
type Entry = {
  key: string;
  ts: Date;
  icon: "upload" | "search" | "file" | "mail" | "mailopen" | "done";
  text: string;
  sub?: string; // what it means / what happens next — rule-based, never invented
  href: string;
};

// Every event answers "what does it mean, what happens next" — one calm line,
// derived from the event type (and outcome where one exists).
function meaningFor(icon: Entry["icon"], outcome?: string): string {
  switch (icon) {
    case "upload": return "This file is the evidence base — everything I flag traces back to it.";
    case "search": return "Every account now carries a classification and my dispute-priority read.";
    case "file": return "Drafted and grounded in the statutes — it becomes real when you mail it.";
    case "mail": return `The bureau owes a reinvestigation within ~${REINVESTIGATION_DAYS} days of receiving it (§611).`;
    case "mailopen":
      if (outcome === "deleted") return "Watch your next report to confirm it stays gone — reinsertion requires notice (§611(a)(5)).";
      if (outcome === "verified") return "“Verified” is a claim, not the end — the method-of-verification demand is the counter.";
      if (outcome === "no_response") return "A non-answer doesn't satisfy §611 — that failure is the basis for escalation.";
      if (outcome === "updated") return "Compare the changed fields — a partial fix can still leave inaccurate data.";
      return "I read the response and lined up the next move on the letter.";
    case "done": return "This item is resolved on this dispute.";
  }
}

// CreditVector Mail milestones the customer sees on the timeline (Sprint XI). We
// surface the human moments and skip internal steps; each says what happened +
// what's next, no jargon, no fabricated provider progress.
function mailStatusLine(status: string): { icon: Entry["icon"]; text: string; sub: string } | null {
  switch (status) {
    case "IN_REVIEW":
      return { icon: "file", text: "I recommended mailing this dispute", sub: "Ready for your review and approval — I never send anything without your say-so." };
    case "APPROVED":
      return { icon: "done", text: "You approved this dispute for mailing", sub: "Your approval is recorded — the next step is confirming and queuing it." };
    case "PAID":
      return { icon: "file", text: "Saved to your mailing queue — no charge yet", sub: "Live mailing isn't switched on, so no card is charged. Your dispute is queued at today's listed price; you'll approve the final price before anything mails." };
    case "QUEUED":
      return { icon: "mail", text: "Queued for mailing", sub: "Your Mail Manifest is your proof of intent. It mails the moment live mailing is enabled." };
    default:
      return null; // provider stages (printed/delivered/…) aren't reached until live mailing
  }
}

const ICONS = {
  upload: Upload,
  search: Search,
  file: FileText,
  mail: Mail,
  mailopen: MailOpen,
  done: CheckCircle2,
} as const;

export default async function JourneyPage() {
  // P0-5: was a linkless "Please sign in." inside the full app chrome.
  const user = await requireUser("/journey");

  const [reports, tradelines, letters, events, kai] = await Promise.all([
    prisma.report.findMany({ where: { userId: user.id }, orderBy: { uploadedAt: "desc" } }),
    prisma.tradeline.count({ where: { userId: user.id } }),
    prisma.letter.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    listKaiEvents(user.id, 200),
    // Reused verbatim (Phase 1A Case Journey panel, below) — the same engine
    // Mission Control already composes with. Never a second, forked reader.
    getKaiHomeData(user.id),
  ]);

  // --- Live events → entries -------------------------------------------------
  const entries: Entry[] = [];
  const seen = new Set<string>(); // dedupe key: `${type}:${refId}` vs synthesized history
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const key = `${e.type}:${e.refId ?? e.id}`;
    seen.add(key);
    const base = { key: e.id, ts: new Date(e.occurredAt) };
    switch (e.type) {
      case "report.uploaded":
        entries.push({ ...base, icon: "upload", text: "Credit report uploaded", sub: meaningFor("upload"), href: "/tradelines" });
        break;
      case "report.analyzed":
        entries.push({ ...base, icon: "search", text: `Kai analyzed the report — ${String(p.tradelines ?? "")} accounts reviewed`, sub: meaningFor("search"), href: "/tradelines" });
        break;
      case "letter.generated":
        entries.push({ ...base, icon: "file", text: `Dispute letter generated${p.strategy ? ` (${String(p.strategy)})` : ""}`, sub: meaningFor("file"), href: "/letters" });
        break;
      case "letter.mailed":
        // Phase 1A-R M3 (CCO correction): receipt-anchored, matching
        // lib/operatorSession.ts's accomplishmentOf idiom.
        entries.push({ ...base, icon: "mail", text: `Round ${String(p.round ?? "")} mailed to ${String(p.recipient ?? "the bureau")} — the §611 clock starts once the bureau receives it`, sub: meaningFor("mail"), href: "/letters" });
        break;
      case "response.received":
        entries.push({ ...base, icon: "mailopen", text: `Bureau response logged — outcome: ${String(p.outcome ?? "recorded")}`, sub: meaningFor("mailopen", String(p.outcome ?? "")), href: "/letters" });
        break;
      case "dispute.resolved":
        entries.push({ ...base, icon: "done", text: "Item marked resolved", sub: meaningFor("done"), href: "/tradelines" });
        break;
      case "mail.status": {
        // CreditVector Mail lifecycle (Sprint XI). Render only the milestones a
        // customer cares about; skip internal steps. Kai's voice, no jargon.
        const line = mailStatusLine(String(p.status ?? ""));
        if (line) entries.push({ ...base, icon: line.icon, text: line.text, sub: line.sub, href: "/mail" });
        break;
      }
      // Kai Campaign Intelligence (Sprint XII). Show the moments the customer
      // decides on — the recommendation is chrome, the approval + start are real.
      case "campaign.approved":
        entries.push({ ...base, icon: "file", text: `Campaign ${String(p.sequence ?? "")} approved`, sub: "A focused set of disputes, reviewed and locked in — mail them and I'll keep them together.", href: "/campaigns" });
        break;
      case "campaign.active":
        entries.push({ ...base, icon: "mail", text: `Campaign ${String(p.sequence ?? "")} is underway`, sub: "A dispute in this campaign is queued — the response window opens once it's received.", href: "/campaigns" });
        break;
      default:
        break;
    }
  }

  // --- History predating the event stream (synthesized, deduped) --------------
  for (const r of reports) {
    if (!seen.has(`report.uploaded:${r.id}`)) {
      entries.push({ key: `hist-r-${r.id}`, ts: r.uploadedAt, icon: "upload", text: `Credit report uploaded (${r.fileName || "report"})`, sub: meaningFor("upload"), href: "/tradelines" });
    }
  }
  for (const l of letters) {
    if (!seen.has(`letter.generated:${l.id}`)) {
      entries.push({ key: `hist-lg-${l.id}`, ts: l.createdAt, icon: "file", text: `Round ${l.round} letter generated for ${l.recipientName}`, sub: meaningFor("file"), href: "/letters" });
    }
    if (l.mailedAt && !seen.has(`letter.mailed:${l.id}`)) {
      // Phase 1A-R M3 (CCO correction): receipt-anchored, matching the live
      // letter.mailed case above and lib/operatorSession.ts's idiom.
      entries.push({ key: `hist-lm-${l.id}`, ts: l.mailedAt, icon: "mail", text: `Round ${l.round} mailed to ${l.recipientName} — the §611 clock starts once the bureau receives it`, sub: meaningFor("mail"), href: "/letters" });
    }
    if (l.responseAt && !seen.has(`response.received:${l.id}`)) {
      entries.push({ key: `hist-lr-${l.id}`, ts: l.responseAt, icon: "mailopen", text: `${l.recipientName} responded — outcome: ${l.responseOutcome ?? "recorded"}`, sub: meaningFor("mailopen", l.responseOutcome ?? ""), href: "/letters" });
    }
  }
  entries.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  // --- Upcoming (derived — hollow nodes: due, not done) ------------------------
  const now = Date.now();
  const upcoming = letters
    .filter((l) => l.mailedAt && !l.responseAt)
    .map((l) => {
      // Receipt-anchored (lib/forecast.ts), not a bare mailedAt diff — matches
      // the Mail Center/Mission Control estimate for the same letter.
      const daysElapsed = daysElapsedSinceEstimatedReceipt(new Date(l.mailedAt as Date).getTime(), now);
      return { l, daysLeft: REINVESTIGATION_DAYS - daysElapsed };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4);

  // --- The 90-day phase checklist (kept from the original journey page) -------
  const phases = [
    { title: "Month 1 — Initial Disputes", steps: [
      { label: "Upload your credit report", done: reports.length > 0 },
      { label: "Review analyzed tradelines", done: tradelines > 0 },
      { label: "Generate first dispute letters", done: letters.length > 0 },
      { label: "Mail your first dispute letters", done: letters.some((l) => l.mailedAt) },
    ]},
    { title: "Month 2 — Responses & Escalations", steps: [
      { label: "Log bureau responses", done: letters.some((l) => l.responseAt) },
      { label: "Escalate unverified items (Round 2)", done: letters.some((l) => l.round >= 2) },
    ]},
    { title: "Month 3 — Resolution & Results", steps: [
      { label: "Confirm corrections/deletions", done: letters.some((l) => l.status === "RESOLVED") },
      { label: "File CFPB complaint if unresolved", done: false },
    ]},
  ];
  const allSteps = phases.flatMap((p) => p.steps);
  const completion = Math.round((allSteps.filter((s) => s.done).length / allSteps.length) * 100);

  // --- Case Journey progression panel (Phase 1A) -------------------------------
  // Composed entirely from facts already derived above — never a second,
  // independently-computed ladder (SIM-REVIEW finding 13's exact antipattern).
  // "Current step"/"next step" read the SAME allSteps checklist rendered below;
  // "waiting period" reads the SAME `upcoming` array as the "Coming up" card;
  // "Kai's recommendation" is `pickRecommendation()`'s own output, cited
  // verbatim via getKaiHomeData — never recomputed.
  const stepIndex = allSteps.findIndex((s) => !s.done);
  const currentStep = stepIndex >= 0 ? allSteps[stepIndex] : null;
  const nextStep = stepIndex >= 0 ? allSteps[stepIndex + 1] ?? null : null;

  const mailedCount = letters.filter((l) => l.mailedAt).length;
  const evidenceText = mailedCount === 0
    ? "Nothing mailed yet — evidence begins with your first mailed letter."
    : `${mailedCount} letter${mailedCount === 1 ? "" : "s"} marked mailed by you. For a self-mailed dispute, your own mailing record is the evidence — CreditVector doesn't hold a certified-mail receipt unless you mail through CreditVector.`;

  const waitingText = upcoming.length === 0
    ? "Nothing open right now."
    : (() => {
        const nearest = upcoming[0];
        const when = nearest.daysLeft <= 0 ? "has closed" : `closes in ${nearest.daysLeft} day${nearest.daysLeft === 1 ? "" : "s"}`;
        return `${upcoming.length} window${upcoming.length === 1 ? "" : "s"} open — nearest ${when}.`;
      })();
  // Reuse WATCHING_CLOCK_LINE verbatim (also rendered on the Mail Center row and
  // below on "Coming up") — only when a window is genuinely still running.
  const showWatchingClock = upcoming.length > 0 && upcoming[0].daysLeft > 0;

  const nextReviewText = upcoming.length === 0
    ? "Nothing scheduled right now — see your next step above."
    : (() => {
        const nearest = upcoming[0];
        if (nearest.daysLeft <= 0) return `Now — the ${nearest.l.recipientName} window has already closed.`;
        // From today + the same receipt-anchored daysLeft `upcoming` already
        // computed above — never re-derived from raw mailedAt (that was the
        // exact mailedAt-anchored math this reconcile removes).
        const closeAt = new Date(now + nearest.daysLeft * 86_400_000);
        const closeStr = closeAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `Around ${closeStr} — when the ${nearest.l.recipientName} window closes.`;
      })();

  const mostRecentEntry = entries[0] ?? null; // entries: already sorted newest-first, above
  const timelineText = mostRecentEntry
    ? `${entries.length} event${entries.length === 1 ? "" : "s"} logged. Most recent: ${mostRecentEntry.text} (${mostRecentEntry.ts.toLocaleDateString("en-US", { month: "short", day: "numeric" })}).`
    : "Nothing logged yet.";

  // Group entries by day for rendering.
  const byDay = new Map<string, Entry[]>();
  for (const e of entries.slice(0, 60)) {
    const day = e.ts.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    if (!byDay.has(day)) byDay.set(day, []);
    (byDay.get(day) as Entry[]).push(e);
  }

  return (
    <AppShell title="/ Timeline">
      <EduBanner />
      <div className="mb-1 flex items-center gap-2 animate-rise">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <h2 className="text-xl font-semibold">Your dispute timeline</h2>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Everything that has happened on your file, and what&apos;s coming next. {completion}% of the 90-day journey complete.
        {" "}<Link href="/mail" className="font-semibold text-brand-400 hover:underline">Track mailed disputes in the Mail Center →</Link>
      </p>
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion}
        aria-label={`90-day journey: ${completion}% complete`}
      >
        <div className="h-full bg-gradient-to-r from-brand-500 to-gold-400" style={{ width: `${completion}%` }} />
      </div>

      {/* Case progression (Phase 1A) — one composed read of where the case
          stands: every fact below is cited from data already loaded on this
          page (the checklist, the upcoming-windows list, Kai Home's own
          recommendation) — nothing here is a new engine. */}
      <div className="card mb-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Case progression</div>
        </div>
        <dl className="space-y-2.5 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current step</dt>
            <dd className="text-slate-200">{currentStep ? currentStep.label : "All mapped steps are complete."}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next step</dt>
            <dd className="text-slate-300">{nextStep ? nextStep.label : "Nothing further mapped yet."}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kai&apos;s recommendation</dt>
            <dd className="text-slate-300">
              {kai.recommendation ? (
                <>
                  {kai.recommendation.title}{" "}
                  <Link href={kai.recommendation.href} className="font-semibold text-brand-400 hover:underline">{kai.recommendation.cta} →</Link>
                </>
              ) : "Nothing new to recommend right now — quiet is allowed."}
            </dd>
            {(() => {
              // The starvation guard's demoted line (lib/kaiHome.ts) — the item
              // that would have been primary never disappears, it moves here.
              const secondary = kai.recommendation?.secondary;
              if (!secondary) return null;
              return (
                <p className="mt-1 text-xs text-slate-500">
                  Also waiting: <Link href={secondary.href} className="hover:underline">{secondary.label}</Link>
                </p>
              );
            })()}
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Timeline</dt>
            <dd className="text-slate-300">
              {timelineText}{" "}
              {entries.length > 0 && <a href="#timeline" className="font-semibold text-brand-400 hover:underline">See the full timeline ↓</a>}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence</dt>
            <dd className="text-slate-300">{evidenceText}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Waiting period</dt>
            <dd className="text-slate-300">{waitingText}{showWatchingClock ? ` ${WATCHING_CLOCK_LINE}` : ""}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next review</dt>
            <dd className="text-slate-300">{nextReviewText}</dd>
          </div>
        </dl>
      </div>

      {upcoming.length > 0 && (
        <div className="card mb-5 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Coming up</div>
          <div className="space-y-2">
            {upcoming.map(({ l, daysLeft }) => (
              <div key={l.id} className="flex items-start gap-3 text-sm">
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                <span className="min-w-0 flex-1 text-slate-300">
                  {/* Hollow node = due, not done — say so for screen readers. */}
                  <span className="sr-only">Due: </span>
                  {l.recipientName} response window {daysLeft <= 0 ? "has closed" : `closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`} (Round {l.round})
                  {daysLeft > 0 && (
                    // Finding 11 (SIM-REVIEW): distributes the same reassurance
                    // Mission Control already shows for a live window.
                    <span className="mt-0.5 block text-xs text-slate-500">{WATCHING_CLOCK_LINE}</span>
                  )}
                </span>
                <Link href="/letters" className="shrink-0 text-xs font-semibold text-brand-400 hover:underline">
                  {daysLeft <= 0 ? "act →" : "view →"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="text-sm font-semibold">Your timeline starts with one upload.</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Upload your credit report and I&apos;ll read every account, flag what can be disputed,
            and draft the letters. Each step lands here as it happens.
          </p>
          <Link href="/upload" className="btn-primary mt-4 inline-block">Upload your report</Link>
        </div>
      ) : (
        <div id="timeline" className="scroll-mt-16 space-y-5">
          {Array.from(byDay.entries()).map(([day, dayEntries], groupIndex) => (
            // Only the first day group animates in — one entrance per viewport, not a cascade.
            <div key={day} className={groupIndex === 0 ? "animate-rise" : undefined}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</div>
              {/* Tighter rail on small screens so icons + copy don't cramp at 375px. */}
              <div className="relative ml-1 space-y-3 border-l border-ink-700 pl-4 sm:ml-2 sm:pl-5">
                {dayEntries.map((e) => {
                  const Icon = ICONS[e.icon];
                  return (
                    <div key={e.key} className="relative">
                      <span className="absolute -left-[25px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink-900 ring-1 ring-ink-600 sm:-left-[27px]">
                        <Icon className={`h-3 w-3 ${e.icon === "done" ? "text-success-400" : "text-brand-400"}`} aria-hidden />
                      </span>
                      <Link href={e.href} className="group block">
                        <span className="text-sm text-slate-300 group-hover:text-slate-100">{e.text}</span>
                        {e.sub && <span className="mt-0.5 block text-xs text-slate-500">{e.sub}</span>}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {phases.map((p) => (
          <div key={p.title} className="card p-4">
            <div className="mb-3 text-sm font-semibold">{p.title}</div>
            <ul className="space-y-2">
              {p.steps.map((s) => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-400" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 text-slate-600" aria-hidden />}
                  <span className={s.done ? "text-slate-200" : "text-slate-400"}>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Disclaimer />
    </AppShell>
  );
}
