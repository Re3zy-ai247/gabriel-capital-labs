// Mail Center projection (Sprint IX). Builds the customer-facing Mail Center
// experience ON TOP of the Sprint VIII mail architecture — no MailService change,
// no providers, no network, no payment. It reads the REAL source of truth today
// (the user's Letter rows + the statutory clock via lib/forecast.ts) and renders
// it in the canonical MailStatus vocabulary. Provider-mailed stages (payment,
// printing, carrier acceptance, delivery confirmation, tracking, certified
// receipt) are reserved placeholders until Sprint X wires the plumbing — shown
// honestly, never faked. Everything here is deterministic: no AI calls.
//
// CROA: every string explains PROCESS or a statutory window and is written for
// the CORRECT statute per recipient — bureau letters cite §611 (reinvestigation),
// furnisher letters §623, collector letters FDCPA §1692g. Nothing implies a
// deletion, a guaranteed outcome, or predicted bureau behavior.
import { MAIL_STATUS_LABEL, type MailStatus } from "@/lib/mail";
import { forecastFor, ownResponseLatencyDays, REINVESTIGATION_DAYS, type ForecastLetterInput } from "@/lib/forecast";

const DAY = 86_400_000;

// The subset of Letter fields the Mail Center reads (all already persisted).
export interface MailLetter extends ForecastLetterInput {
  recipientName: string;
  recipientType: string; // "bureau" | "furnisher" | "collector"
  creditorName: string | null;
  createdAt: Date | string;
  hasResponse: boolean;
  responseOutcome: string | null;
}

const BUREAU_SHORT: Record<string, string> = { EQUIFAX: "EQ", EXPERIAN: "EX", TRANSUNION: "TU" };

export type MailHealth =
  | "WAITING_NORMALLY" | "NEEDS_ATTENTION" | "RESPONSE_RECEIVED"
  | "READY_FOR_ROUND_2" | "ESCALATION_AVAILABLE" | "COMPLETED";

export const HEALTH_LABEL: Record<MailHealth, string> = {
  WAITING_NORMALLY: "Waiting normally",
  NEEDS_ATTENTION: "Needs attention",
  RESPONSE_RECEIVED: "Response received",
  READY_FOR_ROUND_2: "Ready for Round 2",
  ESCALATION_AVAILABLE: "Escalation available",
  COMPLETED: "Completed",
};

// Tone tokens (calm, evidence-first — success green only for genuine completion).
export const HEALTH_TONE: Record<MailHealth, string> = {
  WAITING_NORMALLY: "border-ocean-500/30 bg-ocean-500/10 text-ocean-300",
  NEEDS_ATTENTION: "border-gold-500/30 bg-gold-500/10 text-gold-400",
  RESPONSE_RECEIVED: "border-brand-500/30 bg-brand-500/10 text-brand-300",
  READY_FOR_ROUND_2: "border-brand-500/30 bg-brand-500/10 text-brand-300",
  ESCALATION_AVAILABLE: "border-gold-500/30 bg-gold-500/10 text-gold-400",
  COMPLETED: "border-success-500/30 bg-success-500/10 text-success-300",
};

export type StageState = "done" | "current" | "pending" | "placeholder";
export const STAGE_STATE_LABEL: Record<StageState, string> = {
  done: "Done", current: "In progress", pending: "Pending", placeholder: "Coming soon",
};

export interface TimelineStage {
  key: string;
  label: string;
  state: StageState;
  at: string | null;
  description: string;
}

export interface MailCenterRow {
  letterId: string;
  recipient: string;
  tradeline: string | null;
  bureau: string | null;
  round: number;
  selfMailed: boolean;            // did the user mark it mailed? (no assumed class)
  status: MailStatus;
  statusLabel: string;
  dateSent: string | null;
  responseWindow: string | null;
  recommendation: string;
  kaiIntel: string[];
  health: MailHealth;
  timeline: TimelineStage[];
}

const RESERVED = "Available after live mail integration.";
// SIM-REVIEW finding 11: the true "still tracking this" line that already
// exists on Mission Control (lib/missionControl.ts's waiting-state nextAction,
// "Kai is watching the clock[s]") — exported so every surface that renders a
// genuinely live §611 window (this file's WAITING_NORMALLY row, app/journey's
// waiting entries) reuses the exact same sentence instead of inventing a
// parallel one.
export const WATCHING_CLOCK_LINE = "Kai is watching the clock.";
const OUTCOME_LABEL: Record<string, string> = {
  deleted: "Removed on this bureau", verified: "Kept as reported", updated: "Updated",
  no_response: "No substantive response", unknown: "Logged",
};

type RecipientKind = "bureau" | "furnisher" | "collector";
function recipientKind(l: MailLetter): RecipientKind {
  if (l.recipientType === "collector") return "collector";
  if (l.recipientType === "furnisher") return "furnisher";
  return "bureau";
}

const WINDOW_LABEL: Record<RecipientKind, string> = {
  bureau: "Reinvestigation window (§611)",
  furnisher: "Furnisher investigation (§623)",
  collector: "Validation (FDCPA §1692g)",
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return typeof d === "string" ? d : d.toISOString();
}

// Letter.status → canonical MailStatus for the row pill. Honest for self-mail:
// a mailed letter with no carrier tracking reads as IN_TRANSIT (in the mail),
// never DELIVERED (we can't confirm delivery without provider tracking).
function toMailStatus(l: MailLetter): MailStatus {
  if (l.status === "RESOLVED" || l.responseOutcome === "deleted") return "CLOSED";
  if (l.hasResponse || l.status === "RESPONSE_RECEIVED") return "RESPONSE_RECEIVED";
  if (l.status === "MAILED") return "IN_TRANSIT";
  return "GENERATED";
}

export function mailHealth(l: MailLetter, pastWindow: boolean): MailHealth {
  if (l.status === "RESOLVED" || l.responseOutcome === "deleted") return "COMPLETED";
  if (l.hasResponse) {
    if (l.responseOutcome === "verified" || l.responseOutcome === "updated") return "READY_FOR_ROUND_2";
    if (l.responseOutcome === "no_response") return "ESCALATION_AVAILABLE";
    return "RESPONSE_RECEIVED";
  }
  if (l.status === "MAILED" && pastWindow) return "NEEDS_ATTENTION";
  return "WAITING_NORMALLY";
}

// Recipient-correct window text (the §611 bureau clock only applies to bureau
// letters). Furnisher/collector letters get their own statutory framing.
function windowText(kind: RecipientKind, mailed: boolean, daysElapsed: number, pastWindow: boolean): string {
  if (kind === "bureau") {
    if (!mailed) return `Once mailed, the bureau owes a reinvestigation within ~${REINVESTIGATION_DAYS} days (§611).`;
    return pastWindow
      ? `The ~${REINVESTIGATION_DAYS}-day §611 window has passed. If nothing substantive arrived, that's grounds to follow up or escalate.`
      : `The bureau owes a §611 reinvestigation within ~${REINVESTIGATION_DAYS} days of receiving this — about ${REINVESTIGATION_DAYS - daysElapsed} day(s) left on the statutory clock.`;
  }
  if (kind === "furnisher") {
    return mailed
      ? "A direct dispute puts the furnisher's own investigation duty in play (§623/§1681s-2). There's no fixed bureau clock here — keep your proof of mailing and follow up if you don't hear back."
      : "Once mailed, the furnisher must investigate a direct dispute under §623. Keep your proof of mailing.";
  }
  // collector
  return mailed
    ? "Under FDCPA §1692g the collector must validate the debt before continuing to collect. If you disputed within 30 days of their first notice, collection pauses until they mail validation."
    : "Once mailed, FDCPA §1692g requires the collector to validate the debt before continuing to collect.";
}

// The single, deterministic recommended next action — process-only, and cited to
// the statute that actually governs THIS recipient.
function recommendationFor(l: MailLetter, kind: RecipientKind, pastWindow: boolean): string {
  const resolved = l.status === "RESOLVED" || l.responseOutcome === "deleted";
  if (resolved) return "Done — watch your next report to confirm the item stays off (reinsertion requires notice, §611(a)(5)).";

  if (kind === "bureau") {
    if (l.responseOutcome === "verified") return "Send a method-of-verification demand — ask how, exactly, the bureau verified it (§611(a)(7)).";
    if (l.responseOutcome === "updated") return "Review the change against your records; a partial correction can still leave inaccurate data to dispute.";
    if (l.responseOutcome === "no_response") return "Escalate — a non-answer doesn't satisfy the §611 reinvestigation duty; the §623 furnisher and CFPB paths are open.";
    if (l.hasResponse) return "Review the logged response and decide the next round.";
    if (l.status === "MAILED" && pastWindow) return "The statutory window has passed — log the bureau's response, or send a method-of-verification demand / escalate.";
    if (l.status === "MAILED") return "No action needed yet — the §611 reinvestigation clock is running.";
    return "Print and mail this to start the §611 clock.";
  }
  if (kind === "furnisher") {
    if (l.responseOutcome === "verified") return "The furnisher says it's accurate — you can dispute through the bureau, which forces a §623 reinvestigation, or request their records.";
    if (l.responseOutcome === "updated") return "Review the change; a partial correction can still leave inaccurate data to dispute.";
    if (l.responseOutcome === "no_response") return "No answer — dispute through the bureau to trigger the furnisher's §623 investigation duty; the CFPB path is open.";
    if (l.hasResponse) return "Review the logged response and decide the next step.";
    if (l.status === "MAILED" && pastWindow) return "No response yet — dispute through the bureau to force the §623 reinvestigation, and keep your proof of mailing.";
    if (l.status === "MAILED") return "No action needed yet — keep your proof of mailing while the furnisher reviews.";
    return "Print and mail this to the furnisher.";
  }
  // collector
  if (l.responseOutcome === "no_response") return "No validation provided — a collector that can't validate under FDCPA §1692g shouldn't keep collecting; document it and dispute the reporting.";
  if (l.hasResponse) return "Review what the collector sent — if it doesn't actually validate the debt (§1692g), the continued reporting is disputable.";
  if (l.status === "MAILED" && pastWindow) return "No validation received — under FDCPA §1692g the collector must validate before continuing; document the gap.";
  if (l.status === "MAILED") return "No action needed yet — the collector must validate the debt before continuing (§1692g).";
  return "Print and mail this to the collector.";
}

interface RowContext {
  kind: RecipientKind;
  mailed: boolean;
  daysElapsed: number;
  pastWindow: boolean;
  recommendation: string;
  resolved: boolean;
  ownHistoryText: string | null;
}

function buildTimeline(l: MailLetter, ctx: RowContext): TimelineStage[] {
  const createdAt = iso(l.createdAt);
  const mailedAt = iso(l.mailedAt);
  const responseAt = iso(l.responseAt);
  const underway = ctx.mailed || l.hasResponse || ctx.resolved;

  const stages: TimelineStage[] = [
    { key: "generated", label: "Generated", state: "done", at: createdAt,
      description: "Kai drafted this letter, grounded in the statutes." },
    { key: "mailed", label: "Mailed", state: ctx.mailed ? "done" : underway ? "done" : "current",
      at: mailedAt,
      description: ctx.mailed
        ? "You mailed this — the response window started."
        : underway
          ? "This dispute is underway."
          : "Print and mail this to start the response window." },
    { key: "window", label: WINDOW_LABEL[ctx.kind],
      state: !ctx.mailed ? "pending" : (l.hasResponse || ctx.resolved) ? "done" : "current",
      at: null,
      description: windowText(ctx.kind, ctx.mailed, ctx.daysElapsed, ctx.pastWindow) },
    { key: "response", label: "Response", state: l.hasResponse ? "done" : "pending", at: responseAt,
      description: l.hasResponse
        ? `Response logged: ${OUTCOME_LABEL[l.responseOutcome ?? "unknown"] ?? "logged"}.`
        : "No response logged yet — log the reply here when it arrives." },
    { key: "recommendation", label: "Kai's recommendation", state: "current", at: null,
      description: ctx.recommendation },
    { key: "resolved", label: "Resolved", state: ctx.resolved ? "done" : "pending",
      at: ctx.resolved ? responseAt : null,
      description: ctx.resolved ? "This item is resolved on this dispute." : "Marked when the item is corrected or removed." },
  ];

  // Reserved delivery/proof stages — honestly pending until CreditVector mails on
  // the user's behalf (Sprint X). Never rendered as done.
  for (const [key, label] of [
    ["payment", "Payment"], ["provider_print", "CreditVector printing"],
    ["carrier", MAIL_STATUS_LABEL.CARRIER_ACCEPTED], ["delivery", "Delivery confirmation"],
    ["tracking", "USPS tracking"], ["certified", "Certified-mail receipt"],
  ] as const) {
    stages.push({ key, label, state: "placeholder", at: null, description: RESERVED });
  }
  return stages;
}

export interface MailDashboardStats {
  generated: number;
  mailed: number;
  delivered: number | null;
  waiting: number;
  responses: number;
  avgResponseDays: number | null;
  totalSpendCents: number;
  roundDistribution: { round: number; count: number }[];
}

export interface MailCenter { rows: MailCenterRow[]; stats: MailDashboardStats; }

export function buildMailCenter(letters: MailLetter[], now: number = Date.now()): MailCenter {
  const ownLatency = ownResponseLatencyDays(letters);
  const inMail = letters.filter((l) => l.mailedAt || l.hasResponse || l.status === "RESOLVED");

  const rows: MailCenterRow[] = inMail.map((l) => {
    const kind = recipientKind(l);
    const mailed = l.status === "MAILED" && Boolean(l.mailedAt);
    const daysElapsed = l.mailedAt ? Math.max(0, Math.floor((now - new Date(l.mailedAt).getTime()) / DAY)) : 0;
    const pastWindow = mailed && daysElapsed >= REINVESTIGATION_DAYS;
    const resolved = l.status === "RESOLVED" || l.responseOutcome === "deleted";
    const recommendation = recommendationFor(l, kind, pastWindow);
    const health = mailHealth(l, pastWindow);
    const status = toMailStatus(l);
    // Own-history note only for bureau letters (forecast is §611-specific), and
    // only above the forecast's minimum sample so one point is never a "pattern".
    const forecast = kind === "bureau" ? forecastFor(l, ownLatency, now) : null;
    const ownHistoryText = forecast?.ownHistoryText ?? null;
    const win = windowText(kind, mailed, daysElapsed, pastWindow);

    const kaiIntel: string[] = [];
    if (mailed && !l.hasResponse) {
      kaiIntel.push(`You mailed this ${daysElapsed === 0 ? "today" : `${daysElapsed} day${daysElapsed === 1 ? "" : "s"} ago`}.`);
    }
    kaiIntel.push(win);
    // Only for a genuinely live window: WAITING_NORMALLY, within `rows` (built
    // from `inMail` below), always means mailed + unanswered + not past window
    // — the same gate NEEDS_ATTENTION already carves out. Never claimed once
    // the window lapses or a response lands.
    if (health === "WAITING_NORMALLY") kaiIntel.push(WATCHING_CLOCK_LINE);
    if (ownHistoryText) kaiIntel.push(ownHistoryText);
    kaiIntel.push(recommendation);

    const ctx: RowContext = { kind, mailed, daysElapsed, pastWindow, recommendation, resolved, ownHistoryText };
    return {
      letterId: l.id,
      recipient: l.recipientName,
      tradeline: l.creditorName,
      bureau: l.targetBureau ? (BUREAU_SHORT[l.targetBureau] ?? l.targetBureau) : null,
      round: l.round,
      selfMailed: Boolean(l.mailedAt),
      status,
      statusLabel: MAIL_STATUS_LABEL[status],
      dateSent: iso(l.mailedAt),
      responseWindow: mailed ? win : null,
      recommendation,
      kaiIntel,
      health,
      timeline: buildTimeline(l, ctx),
    };
  });

  const mailed = letters.filter((l) => l.mailedAt).length;
  const responses = letters.filter((l) => l.hasResponse).length;
  const waiting = letters.filter((l) => l.status === "MAILED" && !l.hasResponse).length;
  const spans: number[] = [];
  for (const l of letters) {
    const m = l.mailedAt ? new Date(l.mailedAt).getTime() : null;
    const r = l.responseAt ? new Date(l.responseAt).getTime() : null;
    if (m != null && r != null && r >= m) spans.push(Math.round((r - m) / DAY));
  }
  // Only show an average once there are enough observations to be honest (matches
  // the forecast layer's minimum sample — one data point is not an "average").
  const avgResponseDays = spans.length >= 3 ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null;

  const roundMap = new Map<number, number>();
  for (const l of inMail) roundMap.set(l.round, (roundMap.get(l.round) ?? 0) + 1);
  const roundDistribution = [...roundMap.entries()].sort((a, b) => a[0] - b[0]).map(([round, count]) => ({ round, count }));

  return {
    rows,
    stats: {
      generated: letters.length, mailed, delivered: null, waiting, responses,
      avgResponseDays, totalSpendCents: 0,
      roundDistribution,
    },
  };
}
