// Operator Session Runtime (Phase 1A, Agent A — Session Runtime).
//
// SIM-REVIEW.md's verdict on the whole product experience: every room knows the
// CASE; no room knows the PERSON doing the work or the work itself as a unit
// ("THE ANSWER" + minimum-set item 1/3, docs/fulfillment/simulation/SIM-REVIEW.md).
// This file is that missing room, expressed as a derived read-model — not a page,
// not a new engine, not a new table.
//
// Zero AI. Zero network calls. Zero persistence. Zero schema. Every field below
// is a deterministic function of rows/events that already exist, composed from
// the engines that already compute them — getKaiHomeData (which itself already
// applies pickRecommendation), the agency roster ladder (as the caller already
// computes it at /api/agency/clients), PrismaMailStore, listKaiEvents. Nothing
// here re-scores a tradeline, re-ranks a roster, or re-derives a deadline; it only
// reads, filters, caps, and labels. Quiet is allowed: every list defaults to
// empty and every count defaults to zero — never a placeholder entry standing in
// for a fact that isn't there.
//
// Deliberately NOT lib/session.ts (the AUTH session — currentAccount/currentUser/
// currentWorkspace/sessionAccountState). This module never imports next-auth and
// exports nothing that collides with that file's names; it consumes lib/session.ts
// helpers' OUTPUT (the resolved account + workspace client) as plain data, so a
// server component composes them explicitly:
//
//   const { account, client } = await currentWorkspace();
//   const session = await buildOperatorSession(account, { client });
//
// Nothing in this file is wired into a page yet (Phase 1A Agent A scope) — later
// agents (Mission Control, Kai Experience) consume the exported shape below.
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKaiHomeData, REINVESTIGATION_DAYS, type KaiHomeData } from "@/lib/kaiHome";
import { listKaiEvents } from "@/lib/kaiEvents";
import { PrismaMailStore, isTerminal, type MailStatus } from "@/lib/mail";

const DAY_MS = 86_400_000;

// ---- Identity ----------------------------------------------------------------

export type Altitude = "consumer" | "agency-owner" | "workspace";

export interface OperatorIdentity {
  greetingName: string;
  altitude: Altitude;
  // Present only at "workspace" altitude — an agency operator acting inside a
  // client's case. Everywhere the static "Welcome back" text sits today, this is
  // the on-behalf-of register (SIM-REVIEW minimum-set item 3).
  onBehalfOf?: { clientName: string };
}

// ---- Accomplishments (yesterday / today) --------------------------------------

// Deliberately narrower than the full KaiEventType union (lib/kaiEvents.ts) — only
// the types the brief names as accomplishments. No new event types are added; the
// stream is read exactly as recorded (Reuse listKaiEvents law).
export type AccomplishmentKind =
  | "letter.generated"
  | "letter.mailed"
  | "response.received"
  | "dispute.resolved"
  | "report.analyzed"
  | "mail.queued"; // the mail.status → QUEUED transition, labeled honestly (not a raw KaiEventType)

export interface AccomplishmentEntry {
  kind: AccomplishmentKind;
  label: string;
  at: string; // ISO
  refId: string | null;
}

// A capped list that never hides a fact silently — moreCount is the honest
// overflow (total matches minus what's shown), zero when nothing was cut.
export interface CappedList<T> {
  items: T[];
  moreCount: number;
}

// ---- Interrupted work (resumable) ---------------------------------------------

export type InterruptedKind = "mail_in_review" | "mail_approved" | "letter_unmailed";

export interface InterruptedItem {
  kind: InterruptedKind;
  label: string;
  resumeHref: string;
  since: string; // ISO
}

// ---- Priorities ----------------------------------------------------------------

export interface PriorityEntry {
  label: string;
  basis: string; // the receipt — every priority states why, never a bare ranking
  href: string;
}

// ---- Session close ---------------------------------------------------------------

export interface SessionCloseSummary {
  doneToday: { count: number; labels: string[] };
  remaining: { count: number; labels: string[] };
}

// ---- The session object -----------------------------------------------------------

export interface OperatorSession {
  identity: OperatorIdentity;
  yesterdayCompleted: CappedList<AccomplishmentEntry>;
  todayCompleted: CappedList<AccomplishmentEntry>;
  interruptedWork: InterruptedItem[];
  todaysPriorities: PriorityEntry[];
  sessionClose: SessionCloseSummary;
}

// ---- Inputs ---------------------------------------------------------------------

export type OperatorAccount = Pick<User, "id" | "fullName" | "name" | "isAgency" | "agencyName">;
export type WorkspaceClient = Pick<User, "id" | "fullName" | "name">;

// The agency roster ladder, exactly as the caller already computed it (the same
// needsAttention/daysSince facts /api/agency/clients derives and already returns
// needsAttention-first). This module NEVER recomputes needsAttention from raw
// Letter rows — that's the roster engine's job, and duplicating it here would be
// the "two independently specified ladders" defect SIM-REVIEW finding 13 names.
// Precondition: already ordered needsAttention-first (this module does not re-sort).
export interface RosterEntry {
  id: string;
  name: string;
  needsAttention: boolean;
  lastSentAt: string | null;
  daysSince: number | null;
}

type KaiEventRow = Awaited<ReturnType<typeof listKaiEvents>>[number];

interface ManifestSlice {
  letterId: string;
  status: MailStatus;
  createdAt: string;
}

interface LetterSlice {
  id: string;
  recipientName: string;
  status: string;
  mailedAt: Date | string | null;
  createdAt: Date | string;
}

export interface OperatorSessionInputs {
  account: OperatorAccount;
  client: WorkspaceClient | null;
  // Reused wholesale — recommendation + deadlines are already computed by the
  // existing engine (getKaiHomeData, which itself already applies
  // pickRecommendation). This file never re-derives either.
  kai: KaiHomeData;
  events: KaiEventRow[]; // newest-first (listKaiEvents order), any lookback window
  manifests: ManifestSlice[];
  letters: LetterSlice[];
  /** Agency roster ladder — see RosterEntry. Omit outside "agency-owner" altitude. */
  roster?: RosterEntry[];
  now?: number; // clock injection for deterministic tests; defaults to Date.now()
}

// ===== identity ======================================================================

function firstNameOf(a: { fullName?: string | null; name?: string | null }): string {
  return (a.fullName || a.name || "").trim().split(" ")[0] || "there";
}

function identityOf(
  account: OperatorAccount,
  client: WorkspaceClient | null
): { identity: OperatorIdentity; altitude: Altitude } {
  const greetingName = firstNameOf(account);
  if (client) {
    const altitude: Altitude = "workspace";
    return {
      altitude,
      identity: { greetingName, altitude, onBehalfOf: { clientName: client.fullName || client.name || "this client" } },
    };
  }
  const altitude: Altitude = account.isAgency ? "agency-owner" : "consumer";
  return { altitude, identity: { greetingName, altitude } };
}

// ===== day windows ====================================================================

// UTC-anchored calendar days — matching this repo's existing date convention
// (lib/utils.ts formatDate renders and parses calendar dates in UTC specifically
// so they never shift with server locale; Vercel functions also run UTC). "Today"
// and "yesterday" are half-open [start, end) UTC-day windows, so an event landing
// exactly on a midnight boundary is counted once, never twice and never dropped.
function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dayWindow(now: number, daysAgo: number): { start: number; end: number } {
  const start = utcDayStart(now) - daysAgo * DAY_MS;
  return { start, end: start + DAY_MS };
}

// ===== accomplishments =================================================================

function accomplishmentOf(e: KaiEventRow): AccomplishmentEntry | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const at = new Date(e.occurredAt).toISOString();
  switch (e.type) {
    case "letter.generated":
      return { kind: "letter.generated", label: "Generated a dispute letter", at, refId: e.refId };
    case "letter.mailed":
      return {
        kind: "letter.mailed",
        label: `Mailed Round ${String(p.round ?? "")} to ${String(p.recipient ?? "the bureau")} — the §611 clock started`,
        at, refId: e.refId,
      };
    case "response.received":
      return { kind: "response.received", label: `Logged a bureau response (${String(p.outcome ?? "recorded")})`, at, refId: e.refId };
    case "dispute.resolved":
      return { kind: "dispute.resolved", label: "Marked an item resolved", at, refId: e.refId };
    case "report.analyzed":
      return { kind: "report.analyzed", label: `Analyzed a report — ${String(p.tradelines ?? "the")} accounts reviewed`, at, refId: e.refId };
    case "mail.status":
      // Only the QUEUED milestone reads as an accomplishment — every other
      // mail.status transition is plumbing, not a thing the operator did today
      // (mirrors lib/kaiSeen.ts's own case-memory rendering of this event type).
      if (String(p.status) !== "QUEUED") return null;
      return { kind: "mail.queued", label: "Queued a dispute for CreditVector to mail", at, refId: e.refId };
    default:
      return null; // report.uploaded, campaign.* — not in the brief's accomplishment list
  }
}

const ACCOMPLISHMENT_CAP = 8;

function capList<T>(items: T[], cap = ACCOMPLISHMENT_CAP): CappedList<T> {
  return { items: items.slice(0, cap), moreCount: Math.max(0, items.length - cap) };
}

// events arrive newest-first (listKaiEvents order); filtering preserves that order.
function completedWithin(events: KaiEventRow[], start: number, end: number): AccomplishmentEntry[] {
  const out: AccomplishmentEntry[] = [];
  for (const e of events) {
    const t = new Date(e.occurredAt).getTime();
    if (t < start || t >= end) continue;
    const a = accomplishmentOf(e);
    if (a) out.push(a);
  }
  return out;
}

// ===== interrupted / resumable work =====================================================

// The two resumable wizard stages this file surfaces (app/mail/send/[letterId]/page.tsx's
// own resume derivation: prep.status APPROVED/PAID → step 2, else step 1 — IN_REVIEW is
// step 1's steady state). Deliberately narrower than "every non-terminal status" — those
// are progressing, not interrupted.
const RESUMABLE_MANIFEST_STATUSES = new Set<MailStatus>(["IN_REVIEW", "APPROVED"]);

function interruptedWorkOf(manifests: ManifestSlice[], letters: LetterSlice[]): InterruptedItem[] {
  const items: InterruptedItem[] = [];
  // Any letter with a NON-TERMINAL manifest already has an active claim via the
  // Send wizard (mailId is deterministic per letter, so at most one manifest ever
  // exists for a given letterId) — it must never also appear as "unactioned"
  // below, whatever exact stage it's at (PAID/QUEUED/PRINTED/... are real
  // progress, not absence of action). A TERMINAL manifest (CANCELED/FAILED/
  // CLOSED/RETURNED) releases the letter back to the pool — if it's still
  // GENERATED and never self-mailed, that is honestly "not actioned".
  const inFlight = new Set<string>();
  for (const m of manifests) {
    if (isTerminal(m.status)) continue;
    inFlight.add(m.letterId);
    if (!RESUMABLE_MANIFEST_STATUSES.has(m.status)) continue;
    items.push({
      kind: m.status === "IN_REVIEW" ? "mail_in_review" : "mail_approved",
      label:
        m.status === "IN_REVIEW"
          ? "A dispute is ready for your review before it mails"
          : "An approved dispute is ready to confirm and queue",
      resumeHref: `/mail/send/${m.letterId}`,
      since: m.createdAt,
    });
  }
  for (const l of letters) {
    if (l.status !== "GENERATED" || l.mailedAt) continue;
    if (inFlight.has(l.id)) continue; // already actioned via the Send wizard — never double-count the same letter
    items.push({
      kind: "letter_unmailed",
      label: `A dispute letter to ${l.recipientName} is generated and ready to mail`,
      resumeHref: `/mail/send/${l.id}`,
      since: new Date(l.createdAt).toISOString(),
    });
  }
  return items;
}

// ===== today's priorities =================================================================

const PRIORITY_CAP = 8;

// Consumer (and "workspace" — an agency operator sees the CLIENT's own case,
// scoped by userId at the loader below, so the same composition applies).
function consumerPriorities(kai: KaiHomeData): PriorityEntry[] {
  const out: PriorityEntry[] = [];
  if (kai.recommendation) {
    out.push({ label: kai.recommendation.title, basis: kai.recommendation.basis, href: kai.recommendation.href });
  }
  const nearest = kai.deadlines[0] ?? null;
  // Only a STILL-RUNNING window is a distinct priority fact. An overdue window is
  // already what would have driven pickRecommendation's own lapsed-window branch
  // (surfaced above via kai.recommendation) — showing it again here would render
  // the same fact twice under two labels (and a negative "days left" reads oddly).
  if (nearest && nearest.daysLeft > 0) {
    out.push({
      label: `${nearest.daysLeft} day${nearest.daysLeft === 1 ? "" : "s"} left on the ${nearest.recipient} window`,
      basis: `Round ${nearest.round} mailed ${nearest.daysElapsed} day(s) ago — the ~${REINVESTIGATION_DAYS}-day §611 clock is running.`,
      href: "/letters",
    });
  }
  return out;
}

// Agency-owner altitude only. Trusts the roster's OWN existing order
// (needsAttention-first, as /api/agency/clients already computes and returns) —
// this file filters and formats, it never re-ranks. Re-sorting here would be a
// second, potentially-diverging ladder (SIM-REVIEW finding 13's exact defect).
function agencyPriorities(roster: RosterEntry[]): PriorityEntry[] {
  return roster
    .filter((c) => c.needsAttention || !c.lastSentAt)
    .slice(0, PRIORITY_CAP)
    .map((c) => ({
      label: c.needsAttention ? `Follow up with ${c.name}` : `Send the first letter for ${c.name}`,
      basis: c.needsAttention
        ? `Day ${c.daysSince ?? "?"} since the last round — past the ~${REINVESTIGATION_DAYS}-day FCRA §611 window with no logged response.`
        : "No letters mailed to this client yet.",
      href: "/agency",
    }));
}

// ===== session close =======================================================================

function sessionCloseOf(today: CappedList<AccomplishmentEntry>, priorities: PriorityEntry[]): SessionCloseSummary {
  return {
    doneToday: { count: today.items.length + today.moreCount, labels: today.items.map((i) => i.label) },
    remaining: { count: priorities.length, labels: priorities.map((p) => p.label) },
  };
}

// ===== the pure assembler ===================================================================

// Deterministic given its inputs — no DB, no AI, no clock reads unless `now` is
// omitted. This is what scripts/operator-session.test.ts exercises directly.
export function assembleOperatorSession(x: OperatorSessionInputs): OperatorSession {
  const now = x.now ?? Date.now();
  const { identity, altitude } = identityOf(x.account, x.client);

  const today = dayWindow(now, 0);
  const yesterday = dayWindow(now, 1);
  const todayCompleted = capList(completedWithin(x.events, today.start, today.end));
  const yesterdayCompleted = capList(completedWithin(x.events, yesterday.start, yesterday.end));

  const interruptedWork = interruptedWorkOf(x.manifests, x.letters);

  const todaysPriorities = altitude === "agency-owner" ? agencyPriorities(x.roster ?? []) : consumerPriorities(x.kai);

  const sessionClose = sessionCloseOf(todayCompleted, todaysPriorities);

  return { identity, yesterdayCompleted, todayCompleted, interruptedWork, todaysPriorities, sessionClose };
}

// ===== the thin loader (real rows → the pure assembler) ======================================

// Mirrors lib/missionControl.ts's own assembleMission/getMissionControl split:
// this is the ONLY function in this file that touches the database, and every
// read it performs reuses an existing, already-shipped reader — getKaiHomeData
// (which already reuses pickRecommendation internally), listKaiEvents, and
// PrismaMailStore.listByUser. No engine is forked or reimplemented.
export async function buildOperatorSession(
  account: OperatorAccount,
  opts: { client?: WorkspaceClient | null; roster?: RosterEntry[]; now?: number } = {}
): Promise<OperatorSession> {
  const client = opts.client ?? null;
  // The effective data subject: the client's own case when a workspace is open
  // (mirrors lib/session.ts currentUser()'s exact resolution rule), otherwise the
  // signed-in account itself. `client` is only ever populated by a caller that
  // already resolved it via currentWorkspace(), which verifies agency ownership —
  // this module trusts that verification rather than repeating it.
  const userId = client?.id ?? account.id;

  const [kai, events, manifests, letters] = await Promise.all([
    getKaiHomeData(userId),
    listKaiEvents(userId, 100),
    new PrismaMailStore().listByUser(userId, 200).catch(() => []),
    prisma.letter.findMany({
      where: { userId },
      select: { id: true, recipientName: true, status: true, mailedAt: true, createdAt: true },
    }),
  ]);

  return assembleOperatorSession({
    account,
    client,
    kai,
    events,
    manifests: manifests.map((m) => ({ letterId: m.letterId, status: m.status, createdAt: m.createdAt })),
    letters,
    roster: opts.roster,
    now: opts.now,
  });
}
