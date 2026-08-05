// Guards for the Operator Session Runtime's pure assembler (Phase 1A, Agent A).
// No DB, no network — assembleOperatorSession is a deterministic function of its
// inputs. Run: npx tsx scripts/operator-session.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assembleOperatorSession,
  type OperatorSessionInputs, type OperatorAccount, type WorkspaceClient, type RosterEntry,
} from "../lib/operatorSession";
import type { KaiHomeData } from "../lib/kaiHome";
import type { MailStatus } from "../lib/mail";

let pass = 0, fail = 0;
function ok(label: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); } }

// ---- fixtures -----------------------------------------------------------------

const NOW = new Date("2026-07-14T12:00:00.000Z").getTime(); // noon UTC — unambiguous day boundaries
const TODAY_START = Date.UTC(2026, 6, 14);   // 2026-07-14T00:00:00.000Z
const TODAY_END = Date.UTC(2026, 6, 15);     // 2026-07-15T00:00:00.000Z (exclusive)
const YDAY_START = Date.UTC(2026, 6, 13);    // 2026-07-13T00:00:00.000Z

const ACCOUNT_CONSUMER: OperatorAccount = { id: "u1", fullName: "Rey Gabriel", name: null, isAgency: false, agencyName: null };
const ACCOUNT_AGENCY: OperatorAccount = { id: "a1", fullName: "Marcus Chen", name: null, isAgency: true, agencyName: "Chen Credit Services" };
const ACCOUNT_NAMELESS: OperatorAccount = { id: "u2", fullName: null, name: null, isAgency: false, agencyName: null };
const CLIENT_ELENA: WorkspaceClient = { id: "c1", fullName: "Elena Ruiz", name: null };

const EMPTY_KAI: KaiHomeData = { overnight: [], recommendation: null, deadlines: [], recentEvents: [], responsesReceived: 0, lettersMailed: 0 };

type EventFixture = OperatorSessionInputs["events"][number];
function evt(over: Partial<EventFixture> & { type: string }): EventFixture {
  return {
    id: "e" + Math.random().toString(36).slice(2, 8), userId: "u1",
    refType: null, refId: null, payload: null, occurredAt: new Date(NOW),
    ...over,
  } as EventFixture;
}

type ManifestFixture = OperatorSessionInputs["manifests"][number];
function manifest(letterId: string, status: MailStatus, createdAt = "2026-07-10T00:00:00.000Z"): ManifestFixture {
  return { letterId, status, createdAt };
}

type LetterFixture = OperatorSessionInputs["letters"][number];
function letterRow(over: Partial<LetterFixture> & { id: string }): LetterFixture {
  return { recipientName: "Equifax", status: "GENERATED", mailedAt: null, createdAt: new Date("2026-07-10T00:00:00.000Z"), ...over };
}

function inputs(over: Partial<OperatorSessionInputs> = {}): OperatorSessionInputs {
  return {
    account: ACCOUNT_CONSUMER, client: null, kai: EMPTY_KAI,
    events: [], manifests: [], letters: [], now: NOW, ...over,
  };
}

// ==== 1. type/shape checks =======================================================
{
  const s = assembleOperatorSession(inputs({
    events: [evt({ type: "letter.generated" })],
    manifests: [manifest("L1", "IN_REVIEW")],
    letters: [letterRow({ id: "L2" })],
  }));
  ok("top-level shape has exactly the 5 documented fields", JSON.stringify(Object.keys(s).sort()) ===
    JSON.stringify(["identity", "interruptedWork", "sessionClose", "todayCompleted", "todaysPriorities", "yesterdayCompleted"].sort()));
  ok("identity.greetingName is a string", typeof s.identity.greetingName === "string");
  ok("identity.altitude is one of the 3 documented altitudes", ["consumer", "agency-owner", "workspace"].includes(s.identity.altitude));
  ok("todayCompleted.items is an array", Array.isArray(s.todayCompleted.items));
  ok("todayCompleted.moreCount is a number", typeof s.todayCompleted.moreCount === "number");
  ok("yesterdayCompleted.items is an array", Array.isArray(s.yesterdayCompleted.items));
  ok("interruptedWork is an array", Array.isArray(s.interruptedWork));
  ok("todaysPriorities is an array", Array.isArray(s.todaysPriorities));
  ok("sessionClose.doneToday.count is a number", typeof s.sessionClose.doneToday.count === "number");
  ok("sessionClose.doneToday.labels is an array", Array.isArray(s.sessionClose.doneToday.labels));
  ok("sessionClose.remaining.count is a number", typeof s.sessionClose.remaining.count === "number");
}

// ==== 2. identity / altitude derivation ==========================================
{
  const consumer = assembleOperatorSession(inputs({ account: ACCOUNT_CONSUMER, client: null }));
  ok("plain account, no workspace → altitude consumer", consumer.identity.altitude === "consumer");
  ok("consumer → no onBehalfOf", consumer.identity.onBehalfOf === undefined);
  ok("greetingName takes the first name from fullName", consumer.identity.greetingName === "Rey");

  const agencyOwner = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: null }));
  ok("isAgency + no workspace → altitude agency-owner", agencyOwner.identity.altitude === "agency-owner");
  ok("agency-owner → no onBehalfOf", agencyOwner.identity.onBehalfOf === undefined);

  const workspace = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: CLIENT_ELENA }));
  ok("isAgency + workspace client open → altitude workspace", workspace.identity.altitude === "workspace");
  ok("workspace → onBehalfOf names the client", workspace.identity.onBehalfOf?.clientName === "Elena Ruiz");
  ok("workspace → greetingName is still the AGENCY operator, not the client", workspace.identity.greetingName === "Marcus");

  const nameless = assembleOperatorSession(inputs({ account: ACCOUNT_NAMELESS }));
  ok("no fullName/name → greetingName honestly falls back to 'there'", nameless.identity.greetingName === "there");
}

// ==== 3. day-window math (incl. timezone/boundary edges) ========================
{
  const at = (ms: number) => assembleOperatorSession(inputs({ events: [evt({ type: "letter.generated", occurredAt: new Date(ms) })] }));

  ok("event at exact UTC today-start → counted today", at(TODAY_START).todayCompleted.items.length === 1);
  ok("event at exact UTC today-start → NOT counted yesterday", at(TODAY_START).yesterdayCompleted.items.length === 0);
  ok("event 1ms before today-end (23:59:59.999 today) → counted today", at(TODAY_END - 1).todayCompleted.items.length === 1);
  ok("event at exact today-end (= tomorrow start) → NOT counted today (half-open interval)", at(TODAY_END).todayCompleted.items.length === 0);
  ok("event 1ms before today-start (23:59:59.999 yesterday) → counted yesterday, not today", (() => {
    const s = at(TODAY_START - 1);
    return s.yesterdayCompleted.items.length === 1 && s.todayCompleted.items.length === 0;
  })());
  ok("event at exact UTC yesterday-start → counted yesterday", at(YDAY_START).yesterdayCompleted.items.length === 1);
  ok("event 2 days ago → counted in neither list", (() => {
    const s = at(YDAY_START - DAY_MS_CONST());
    return s.todayCompleted.items.length === 0 && s.yesterdayCompleted.items.length === 0;
  })());
}
function DAY_MS_CONST() { return 86_400_000; }

// ==== 4. capping (honest moreCount) ==============================================
{
  const many = Array.from({ length: 10 }, (_, i) => evt({ type: "letter.generated", refId: `L${i}`, occurredAt: new Date(NOW - i * 60_000) }));
  const s = assembleOperatorSession(inputs({ events: many }));
  ok("10 same-day accomplishments cap the displayed list at 8", s.todayCompleted.items.length === 8);
  ok("...and report an honest moreCount of 2 (never silently dropped)", s.todayCompleted.moreCount === 2);
}

// ==== 5. empty-state honesty (quiet is allowed — no fabricated entries) ==========
{
  const s = assembleOperatorSession(inputs());
  ok("no events → todayCompleted is genuinely empty", s.todayCompleted.items.length === 0 && s.todayCompleted.moreCount === 0);
  ok("no events → yesterdayCompleted is genuinely empty", s.yesterdayCompleted.items.length === 0 && s.yesterdayCompleted.moreCount === 0);
  ok("no manifests/letters → interruptedWork is genuinely empty", s.interruptedWork.length === 0);
  ok("no recommendation/deadline → todaysPriorities is genuinely empty", s.todaysPriorities.length === 0);
  ok("sessionClose.doneToday is honestly zero, not a placeholder", s.sessionClose.doneToday.count === 0 && s.sessionClose.doneToday.labels.length === 0);
  ok("sessionClose.remaining is honestly zero, not a placeholder", s.sessionClose.remaining.count === 0 && s.sessionClose.remaining.labels.length === 0);

  // Only the brief's named accomplishment types count — an unrelated/unknown
  // event type must never surface as a fabricated accomplishment.
  const unknown = assembleOperatorSession(inputs({ events: [evt({ type: "campaign.recommended" }), evt({ type: "report.uploaded" })] }));
  ok("unlisted event types (campaign.recommended, report.uploaded) produce zero accomplishment entries", unknown.todayCompleted.items.length === 0);

  // mail.status events that AREN'T the QUEUED milestone must not surface either.
  const nonQueued = assembleOperatorSession(inputs({ events: [evt({ type: "mail.status", payload: { status: "PRINTED" } })] }));
  ok("mail.status !== QUEUED produces zero accomplishment entries", nonQueued.todayCompleted.items.length === 0);
  const queued = assembleOperatorSession(inputs({ events: [evt({ type: "mail.status", payload: { status: "QUEUED" } })] }));
  ok("mail.status === QUEUED DOES surface as an accomplishment", queued.todayCompleted.items.length === 1 && queued.todayCompleted.items[0].kind === "mail.queued");
}

// ==== 6. interruptedWork — resumable derivation + dedup ==========================
{
  const s = assembleOperatorSession(inputs({
    manifests: [
      manifest("L1", "IN_REVIEW"),
      manifest("L2", "APPROVED"),
      manifest("L3", "QUEUED"),    // in-flight, non-terminal, NOT one of the 2 resumable stages
      manifest("L4", "CANCELED"),  // terminal — releases the letter back to the pool
    ],
    letters: [
      letterRow({ id: "L3", status: "GENERATED", mailedAt: null }), // covered by its QUEUED manifest
      letterRow({ id: "L4", status: "GENERATED", mailedAt: null }), // its manifest is terminal — should resurface
      letterRow({ id: "L5", status: "GENERATED", mailedAt: new Date("2026-07-11") }), // self-mailed already
      letterRow({ id: "L6", status: "MAILED", mailedAt: new Date("2026-07-11") }),    // not GENERATED at all
      letterRow({ id: "L7", status: "GENERATED", mailedAt: null }), // no manifest at all — genuinely untouched
    ],
  }));
  const byHref = (id: string) => s.interruptedWork.find((i) => i.resumeHref === `/mail/send/${id}`);

  ok("IN_REVIEW manifest → a mail_in_review entry", byHref("L1")?.kind === "mail_in_review");
  ok("APPROVED manifest → a mail_approved entry", byHref("L2")?.kind === "mail_approved");
  ok("QUEUED manifest → no entry of its own (in-flight, not one of the 2 resumable stages)", !s.interruptedWork.some((i) => i.resumeHref === "/mail/send/L3"));
  ok("...and the underlying letter is NOT also flagged unmailed (no double-count of the same letter)", !byHref("L3"));
  ok("CANCELED (terminal) manifest releases its letter → letter_unmailed resurfaces", byHref("L4")?.kind === "letter_unmailed");
  ok("a letter already self-mailed (mailedAt set) never appears", !byHref("L5"));
  ok("a letter not in GENERATED status never appears via the unmailed path", !byHref("L6"));
  ok("a GENERATED, unmailed letter with no manifest at all → letter_unmailed", byHref("L7")?.kind === "letter_unmailed");
  ok("interruptedWork total count is exactly the 4 genuine cases (L1, L2, L4, L7)", s.interruptedWork.length === 4);
}

// ==== 7. today's priorities — consumer/workspace composition (engine reuse) ======
{
  const overdueRec = { title: "The Equifax window has passed.", body: "…", cta: "Log it", href: "/letters", basis: "Rule: overdue" };
  const kaiOverdue: KaiHomeData = { ...EMPTY_KAI, recommendation: overdueRec, deadlines: [{ letterId: "L1", recipient: "Equifax", round: 1, daysElapsed: 35, daysLeft: -5 }] };
  const sOverdue = assembleOperatorSession(inputs({ kai: kaiOverdue }));
  ok("an overdue window's recommendation surfaces exactly once (no duplicate 'days left' entry for the same fact)", sOverdue.todaysPriorities.length === 1);
  ok("...and it IS the recommendation Kai Home already computed (no local re-derivation)", sOverdue.todaysPriorities[0].label === overdueRec.title);

  const kaiRunning: KaiHomeData = { ...EMPTY_KAI, deadlines: [{ letterId: "L2", recipient: "TransUnion", round: 1, daysElapsed: 10, daysLeft: 20 }] };
  const sRunning = assembleOperatorSession(inputs({ kai: kaiRunning }));
  ok("a still-running window (no recommendation) surfaces as its own priority", sRunning.todaysPriorities.length === 1 && /20 days? left/.test(sRunning.todaysPriorities[0].label));
  ok("...naming the recipient", /TransUnion/.test(sRunning.todaysPriorities[0].label));

  const sQuiet = assembleOperatorSession(inputs({ kai: EMPTY_KAI }));
  ok("nothing recommended, nothing waiting → zero priorities (quiet is allowed)", sQuiet.todaysPriorities.length === 0);

  // "workspace" altitude composes the SAME way as consumer (the client's own case).
  const sWorkspace = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: CLIENT_ELENA, kai: kaiRunning }));
  ok("workspace altitude reuses the consumer composition (on-behalf-of, not a 3rd ladder)", sWorkspace.todaysPriorities.length === 1);
}

// ==== 7b. F3 (dishonest quiet state): resume-as-priority fallback ================
{
  // No account-wide recommendation this cycle, but a real resumable letter
  // exists — the honest top priority IS picking that back up, never silence.
  const sResume = assembleOperatorSession(inputs({
    kai: EMPTY_KAI,
    letters: [letterRow({ id: "Lr", recipientName: "Experian", status: "GENERATED", mailedAt: null })],
  }));
  ok("recommendation null + interruptedWork non-empty → todaysPriorities is NOT empty (quiet would be dishonest here)", sResume.todaysPriorities.length > 0);
  ok("...the top priority IS composed from interruptedWork's own first entry (same label, same href — not a new ranking)",
    sResume.todaysPriorities[0].label === sResume.interruptedWork[0].label && sResume.todaysPriorities[0].href === sResume.interruptedWork[0].resumeHref);
  ok("...basis matches the brief's example phrasing for a generated-unmailed letter", sResume.todaysPriorities[0].basis === "Generated and ready to mail.");

  // A REAL recommendation still wins outright — the resume fallback only
  // fires when there is truly nothing else to lead with.
  const overdueRec2 = { title: "The Equifax window has passed.", body: "…", cta: "Log it", href: "/letters", basis: "Rule: overdue" };
  const sBothExist = assembleOperatorSession(inputs({
    kai: { ...EMPTY_KAI, recommendation: overdueRec2 },
    letters: [letterRow({ id: "Lr2", recipientName: "Experian", status: "GENERATED", mailedAt: null })],
  }));
  ok("a real recommendation still wins over the resume fallback (never both, never resume-first)", sBothExist.todaysPriorities[0].label === overdueRec2.title);
  ok("...the resumable letter still shows up in interruptedWork itself (not lost, just not double-promoted)", sBothExist.interruptedWork.length === 1);
}

// ==== 8. today's priorities — agency-owner roster ladder (trusts caller order) ===
{
  const roster: RosterEntry[] = [
    { id: "c1", name: "Alice", needsAttention: true, lastSentAt: "2026-06-01T00:00:00.000Z", daysSince: 35 },
    { id: "c2", name: "Bob", needsAttention: false, lastSentAt: null, daysSince: null },
    { id: "c3", name: "Carol", needsAttention: false, lastSentAt: "2026-07-10T00:00:00.000Z", daysSince: 4 },
  ];
  const s = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: null, roster }));
  ok("agency-owner altitude surfaces only actionable roster entries (needsAttention or awaiting-first)", s.todaysPriorities.length === 2);
  ok("a comfortably-waiting client (Carol) is not a priority (quiet is allowed)", !s.todaysPriorities.some((p) => /Carol/.test(p.label)));
  ok("every agency priority carries a non-empty basis (never a bare ranking)", s.todaysPriorities.every((p) => p.basis.length > 0));
  ok("every agency priority links to the roster", s.todaysPriorities.every((p) => p.href === "/agency"));

  // Order preservation: feed a LOWER-daysSince needsAttention client BEFORE a
  // HIGHER-daysSince one. If this module re-sorted internally (duplicating the
  // roster engine), the higher one would jump first; it must not.
  const unsorted: RosterEntry[] = [
    { id: "low", name: "LowDays", needsAttention: true, lastSentAt: "x", daysSince: 5 },
    { id: "high", name: "HighDays", needsAttention: true, lastSentAt: "y", daysSince: 50 },
  ];
  const sOrder = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: null, roster: unsorted }));
  ok("roster order is trusted verbatim, never re-sorted by this module", sOrder.todaysPriorities.map((p) => p.label).join("|") === "Follow up with LowDays|Follow up with HighDays");

  const sNoRoster = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: null }));
  ok("agency-owner with no roster supplied yet → honestly empty, never fabricated", sNoRoster.todaysPriorities.length === 0);
}

// ==== 9. sessionClose — a derived rollup, not a new data source ==================
{
  const many = Array.from({ length: 10 }, (_, i) => evt({ type: "dispute.resolved", refId: `d${i}`, occurredAt: new Date(NOW) }));
  const roster: RosterEntry[] = [
    { id: "c1", name: "Alice", needsAttention: true, lastSentAt: "x", daysSince: 40 },
    { id: "c2", name: "Bob", needsAttention: true, lastSentAt: "y", daysSince: 31 },
  ];
  const s = assembleOperatorSession(inputs({ account: ACCOUNT_AGENCY, client: null, events: many, roster }));
  ok("sessionClose.doneToday.count is the TRUE total (capped items + moreCount), not just what's displayed", s.sessionClose.doneToday.count === 10);
  ok("sessionClose.doneToday.labels mirrors the capped, displayed items only", s.sessionClose.doneToday.labels.length === 8);
  // This fixture supplies no manifests/letters, so interruptedWork is empty —
  // remaining mirrors todaysPriorities exactly here. See 9b below for the
  // case where interruptedWork is non-empty (the F3 union/dedup behavior).
  ok("sessionClose.remaining mirrors todaysPriorities exactly (interruptedWork empty in this fixture)", s.sessionClose.remaining.count === s.todaysPriorities.length &&
    JSON.stringify(s.sessionClose.remaining.labels) === JSON.stringify(s.todaysPriorities.map((p) => p.label)));
}

// ==== 9b. F3: sessionClose.remaining honestly includes interruptedWork ===========
{
  // Priorities would otherwise be empty (no recommendation, no running
  // deadline) — but 7b's resume fallback promotes the one resumable letter
  // into todaysPriorities[0], so it must be counted ONCE, never twice.
  const sOpen = assembleOperatorSession(inputs({
    kai: EMPTY_KAI,
    letters: [letterRow({ id: "Lo1", recipientName: "Equifax", status: "GENERATED", mailedAt: null })],
  }));
  ok("a resume item promoted into priorities is counted once, not twice, in remaining", sOpen.sessionClose.remaining.count === 1 && sOpen.todaysPriorities.length === 1);
  ok("...and this is NOT the quiet state (doneToday and remaining are not both zero)", !(sOpen.sessionClose.doneToday.count === 0 && sOpen.sessionClose.remaining.count === 0));

  // Two resumable items: only the first is promoted to a priority — the
  // SECOND must still be counted in remaining (the honest union, never
  // silently dropped just because it wasn't the one chosen to lead with).
  const sTwoOpen = assembleOperatorSession(inputs({
    kai: EMPTY_KAI,
    letters: [
      letterRow({ id: "Lo2", recipientName: "Equifax", status: "GENERATED", mailedAt: null, createdAt: new Date("2026-07-09T00:00:00.000Z") }),
      letterRow({ id: "Lo3", recipientName: "Experian", status: "GENERATED", mailedAt: null, createdAt: new Date("2026-07-10T00:00:00.000Z") }),
    ],
  }));
  ok("a second, un-promoted interruptedWork item still counts in remaining (priorities + the ONE extra, not priorities alone)",
    sTwoOpen.sessionClose.remaining.count === sTwoOpen.todaysPriorities.length + (sTwoOpen.interruptedWork.length - 1));

  // Agency-owner altitude: agencyPriorities never touches interruptedWork
  // (it only reads the roster) — so ALL of interruptedWork must land in
  // remaining as pure addition, no dedup collision (the hrefs never match:
  // roster priorities link to /agency, interruptedWork links to /mail/send/...).
  const sAgencyOpen = assembleOperatorSession(inputs({
    account: ACCOUNT_AGENCY, client: null, kai: EMPTY_KAI,
    letters: [letterRow({ id: "Lo4", recipientName: "Equifax", status: "GENERATED", mailedAt: null })],
  }));
  ok("agency-owner altitude: interruptedWork is never promoted into the roster ladder, so remaining = priorities + ALL interruptedWork",
    sAgencyOpen.sessionClose.remaining.count === sAgencyOpen.todaysPriorities.length + sAgencyOpen.interruptedWork.length);

  // The genuinely empty fixture (section 5) is the ONLY case where the quiet
  // line's precondition holds — priorities, interruptedWork, and
  // todayCompleted all truly empty at once.
  const sTrueQuiet = assembleOperatorSession(inputs());
  ok("F3: remaining.count === 0 only when priorities AND interruptedWork are BOTH genuinely empty",
    sTrueQuiet.sessionClose.remaining.count === 0 && sTrueQuiet.todaysPriorities.length === 0 && sTrueQuiet.interruptedWork.length === 0);
}

// ==== 10. engine-composition (static): reuses getKaiHomeData, never reimplements ==
const root = join(__dirname, "..");
const SRC = readFileSync(join(root, "lib", "operatorSession.ts"), "utf8");
{
  ok("imports getKaiHomeData from @/lib/kaiHome (the engine that already applies pickRecommendation)",
    /import\s*\{[^}]*\bgetKaiHomeData\b[^}]*\}\s*from\s*["']@\/lib\/kaiHome["']/.test(SRC));
  ok("does not locally reimplement pickRecommendation's branch conditions (no fcra_605/dateOfFirstDelinquency/verified literals)",
    !/fcra_605/.test(SRC) && !/dateOfFirstDelinquency/.test(SRC) && !/responseOutcome\s*===\s*["']verified["']/.test(SRC));
  ok("does not locally reimplement the agency roster's needsAttention computation (no raw managedByAgencyId scoring)",
    !/managedByAgencyId/.test(SRC));
  ok("imports REINVESTIGATION_DAYS rather than hardcoding the §611 day count",
    /REINVESTIGATION_DAYS/.test(SRC) && !/\b30\b\s*\*\s*DAY/.test(SRC));
}

// ==== 11. zero-schema assertion ====================================================
{
  ok("no raw SQL / self-heal DDL introduced by this file", !/\$executeRaw|\$queryRaw|CREATE TABLE|ALTER TABLE/i.test(SRC));
  const prismaModelCalls = [...SRC.matchAll(/\bprisma\.(\w+)\./g)].map((m) => m[1]);
  ok("at least one direct prisma read exists (sanity — the allowlist check below isn't vacuous)", prismaModelCalls.length > 0);
  const ALLOWED_MODELS = new Set(["letter"]);
  ok("every direct prisma.<model> call is an existing, already-read model (letter only — every other read reuses an existing lib function)",
    prismaModelCalls.every((m) => ALLOWED_MODELS.has(m)));
}

// ==== 12. auth-session non-collision ===============================================
{
  ok("does not import next-auth", !/from\s*["']next-auth/.test(SRC));

  function exportedNames(src: string): Set<string> {
    const names = new Set<string>();
    const patterns = [
      /export\s+(?:async\s+)?function\s+(\w+)/g, /export\s+const\s+(\w+)/g,
      /export\s+type\s+(\w+)/g, /export\s+interface\s+(\w+)/g, /export\s+class\s+(\w+)/g,
    ];
    for (const re of patterns) for (const m of src.matchAll(re)) names.add(m[1]);
    return names;
  }
  const SESSION_SRC = readFileSync(join(root, "lib", "session.ts"), "utf8");
  const mine = exportedNames(SRC);
  const theirs = exportedNames(SESSION_SRC);
  const collisions = [...mine].filter((n) => theirs.has(n));
  ok(`no exported-name collisions with lib/session.ts (${mine.size} exports here vs ${theirs.size} there)`, collisions.length === 0);
  ok("this module exports its own OperatorSession/buildOperatorSession names (sanity — the check above isn't vacuous)",
    mine.has("OperatorSession") && mine.has("buildOperatorSession"));
}

console.log(failSummary());
process.exit(fail === 0 ? 0 : 1);

function failSummary() {
  return `\noperator-session.test.ts: ${pass} passed, ${fail} failed`;
}
