// Run: npx --no-install tsx scripts/lifecycle-honesty.test.ts
//
// RC1-S10 — LIFECYCLE / COPY HONESTY. Founder D-12: CONFIRMED DEFERRED — no
// §611/legal-deadline automation, no new cron, no email automation, no
// counsel-sensitive deadline representations. This slice is COPY/TRUTH
// ALIGNMENT ONLY, and this guard is what makes that a checkable claim rather
// than an assertion.
//
// THE FINDING THIS PINS (G-adversarial-review.md, G-M2, P1/P0-for-unassisted-use):
//   app/settings/page.tsx:370 (pre-slice) promised "this device can receive my
//   alerts when something on your account needs your attention" under the KAI
//   voice. That promise was false on every axis that matters to a consumer:
//     - lib/eventBus/subscribers/notificationCreated.ts is wired to the real
//       NOTIFICATION_CREATED event (subscribers/index.ts:12), but ships with NO
//       composePush (ADR-0036: content belongs to the emitting context). With
//       no composer wired anywhere in the tree, every consumer-facing push
//       fails closed with a console.warn and sends nothing. Verified: nothing
//       in app/ or lib/ (outside the eventBus subscriber/contract/envelope
//       files themselves) ever publishes a NOTIFICATION_CREATED event either —
//       the pipeline is dead at BOTH ends today.
//     - The only functions that ever actually call sendPushToUser /
//       sendPushToAdmins / sendEmail with a live effect are four admin/
//       moderation call sites (brief-draft approval, comment reports,
//       community reports) plus password reset and the Brief digest — none of
//       them a dispute-lifecycle, bureau-response, or §611-clock event.
//   This is COPY-ONLY: the fix is truthful settings text, not a new send path.
//   D-12 forecloses building the real alert (no cron, no email automation, no
//   deadline math) — so the honest move is to say what push delivers TODAY
//   ("nothing, yet") rather than promise what it doesn't.
//
// GRANT (coordinator, same round, recorded in the overlap ledger):
// components/PushToggle.tsx was unclaimed by any slice and handed to S10.
// Its own caption at the old :150 named a SPECIFIC example — "(e.g., a Brief
// draft awaiting approval)" — as if the viewer's device would receive it. That
// event is admin-only (app/api/admin/brief/route.ts:96, sendPushToAdmins);
// PushToggle is rendered ONLY from app/settings/page.tsx (verified: the only
// <PushToggle usage in app/ or components/), i.e. to whichever account is
// looking at their own Settings — for the overwhelming non-admin majority,
// naming that example is the same class of false promise as G-M2, just one
// component down. Fixed the same way: state what registering the device does
// today (nothing is sent), not a specific alert class that mostly never fires.
//
// NON-VACUITY (measured 2026-08-23, this worktree, branch base a6ea947 — both
// files are a6ea947's unmodified content before each was edited, confirmed by
// `git diff a6ea947 -- <path>` being empty immediately before its edit):
//   `git stash` (reverting the settings-page AND PushToggle edits together)
//   then running this file against the untouched a6ea947 text for both: 10
//   checks FAIL — all five section-1 checks, four of section 1b's five (the
//   fifth, the untouched iPhone instruction, is true on both versions so it
//   correctly still passes), and the section-2 cross-check that the shipped
//   truthful sentence exists — 21 passed / 10 failed. Restoring both fixes
//   returns the file to 31 passed / 0 failed. Exact transcript in the writer
//   report for this slice.
//
// Offline throughout: no database, no network, no Stripe/Anthropic client, no
// cron trigger, no email/push send. Source-text checks only.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export {};

let pass = 0,
  fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
// Prose in a comment must never satisfy — or break — a claim about what the
// PRODUCT says or does. Strip comments before any regex runs over source.
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// JSX text reflows across lines; collapse whitespace so a sentence is
// searchable as a sentence and a line-wrap cannot silently disarm a check.
const flat = (src: string) => codeOf(src).replace(/\s+/g, " ");

const SETTINGS_PATH = "app/settings/page.tsx";
const SETTINGS_RAW = read(SETTINGS_PATH);
const SETTINGS = flat(SETTINGS_RAW);

const PUSHTOGGLE_PATH = "components/PushToggle.tsx";
const PUSHTOGGLE_RAW = read(PUSHTOGGLE_PATH);
const PUSHTOGGLE = flat(PUSHTOGGLE_RAW);

// ── 1. The G-M2 false promise is gone, replaced by the truth ─────────────────
console.log("\n1. Phone Alerts no longer promises a channel that does not exist");
check(
  "the exact pre-slice false promise string is gone",
  !/this device can receive my alerts/i.test(SETTINGS)
);
check(
  "…and no rephrasing of the same claim (\"can receive my/your alerts …needs your attention\") survives",
  !/can receive (my|your) alerts?[^.]{0,40}needs your attention/i.test(SETTINGS)
);
check(
  "replaced by what push actually delivers today: nothing consumer-facing, honestly stated",
  /No dispute, bureau-response, or deadline alert exists yet/.test(SETTINGS)
);
check(
  "…framed as future-ready (D-12: no new alert may be BUILT), not as a live channel",
  /it only makes your device ready in case that changes/.test(SETTINGS)
);
check(
  "…and the reversibility promise (real: PushToggle really unsubscribes) is kept",
  /Turn it off any time; nothing else about your account changes/.test(SETTINGS)
);

// ── 2. No rephrasing of a bureau/deadline alert promise sneaks back in ───────
// Same technique as scripts/disclosure-truth.test.ts's assertedGuarantees(): a
// sentence only COUNTS as a promise if it asserts the alert-phrase without a
// negation in the same sentence, so the truthful "No … alert exists yet, …
// won't notify you" sentence above must NOT trip this scanner.
const ALERT_PROMISE =
  /(alert you|notify you|tell you|let you know|receive (my|your|an) alerts?)[^.]{0,100}(bureau|deadline|clock|response|reinvestigation|§\s?611|30-day)/i;
const NEGATED = /\b(no|not|n't|won't|never|nothing|none|doesn't|don't)\b/i;
function assertedAlertPromises(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => ALERT_PROMISE.test(sentence) && !NEGATED.test(sentence))
    .map((sentence) => sentence.trim().slice(0, 100));
}
// ── 1b. PushToggle's own caption stops naming an admin-only example ──────────
console.log("\n1b. PushToggle's caption is truthful for whichever audience is looking at it");
check(
  "the admin-only example claim is gone (a consumer's device never gets a Brief-draft-approval push)",
  !/e\.g\.,?\s*a Brief draft awaiting approval/i.test(PUSHTOGGLE)
);
check(
  "…and the unqualified 'sends a push for things that need attention' framing is gone with it",
  !/sends a push to this device for things that need attention/i.test(PUSHTOGGLE)
);
check(
  "replaced by what the toggle actually does today: registers the device, sends nothing yet",
  /Registers this device for push notifications/.test(PUSHTOGGLE) &&
    /nothing is sent through it today/.test(PUSHTOGGLE)
);
check(
  "the real, working iPhone instruction survives untouched (no functionality description lost)",
  /On iPhone, add\s*CreditVector to your Home Screen first\./.test(PUSHTOGGLE)
);
check(
  "PushToggle's fix does not contradict Settings' fix — neither promises a specific alert class",
  !/Brief draft/i.test(PUSHTOGGLE) && !/dispute|bureau|deadline/i.test(PUSHTOGGLE)
);

console.log("\n2. no bureau/deadline alert promise, worded any way, survives in Settings or PushToggle");
check(
  `Settings asserts no bureau-response/deadline alert promise (found: ${
    assertedAlertPromises(SETTINGS).join(" | ") || "none"
  })`,
  assertedAlertPromises(SETTINGS).length === 0
);
check(
  `PushToggle asserts no bureau-response/deadline alert promise (found: ${
    assertedAlertPromises(PUSHTOGGLE).join(" | ") || "none"
  })`,
  assertedAlertPromises(PUSHTOGGLE).length === 0
);
check(
  "the scanner is not vacuous: a planted bureau/deadline promise IS caught",
  assertedAlertPromises("Turn this on and I'll alert you the moment a bureau responds.").length === 1
);
check(
  "…and the shipped truthful sentence does NOT trip the same scanner (order + negation both matter)",
  assertedAlertPromises(SETTINGS).length === 0 &&
    /won&apos;t notify you/.test(SETTINGS)
);

// ── 3. Data-control claims match S8's privacy posture (no deletion/export promise) ──
console.log("\n3. Settings makes no data-control promise the product cannot keep (S8 alignment)");
check(
  "no account-deletion promise on Settings",
  !/delete your (whole )?account/i.test(SETTINGS) && !/request deletion of your account/i.test(SETTINGS)
);
check(
  "no data-export promise on Settings",
  !/export (all|everything)/i.test(SETTINGS) && !/download (all|everything) we hold/i.test(SETTINGS)
);
const PRIVACY = flat(read("app/legal/privacy/page.tsx"));
check(
  "the one data control Settings DOES claim (email/password update) matches what /legal/privacy says Settings can do",
  /Update your account email and password from Settings/i.test(PRIVACY) &&
    /Account Email/.test(SETTINGS_RAW) &&
    /Update password/.test(SETTINGS_RAW)
);
check(
  "privacy's own no-deletion-yet posture is still what it was (this slice must not be the one that regresses it)",
  /no self-service way to delete your whole account or to export everything/i.test(PRIVACY)
);

// ── 4. Untouched sections stay untouched (smallest honest diff) ──────────────
console.log("\n4. everything outside the Phone Alerts paragraph is byte-for-byte the same claim");
check(
  "S2's session-recovery block is LAW here — copy unchanged",
  /Your session ended/.test(SETTINGS_RAW) &&
    /Nothing has been changed or removed — sign in again and your details will be exactly as you left them\./.test(
      SETTINGS
    )
);
check(
  "Email Updates copy (already truthful — the Brief digest is real, lib/briefDigest.ts) is untouched",
  /I&apos;ll email you a weekly digest of the CreditVector Brief/.test(SETTINGS)
);
check(
  "outcome-contribution copy (off by default, reversible) is untouched",
  /Off by default, reversible any time\./.test(SETTINGS)
);
check(
  "the Phone Alerts section still renders the real PushToggle control (no functionality removed)",
  /<PushToggle \/>/.test(SETTINGS_RAW)
);

// ── 5. Protective: no new cron, no new sendEmail/sendPush call site (D-12) ───
console.log("\n5. no new cron and no new sendEmail/sendPush call site were introduced");
const VERCEL = read("vercel.json");
const cronPaths = [...VERCEL.matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1]).sort();
check(
  `vercel.json still has exactly the two pre-existing Brief crons and nothing else (found: ${cronPaths.join(", ")})`,
  JSON.stringify(cronPaths) === JSON.stringify(["/api/cron/brief-digest", "/api/cron/brief-ingest"])
);
check(
  "no cron path or schedule name references a dispute/letter/lifecycle/deadline job",
  !/dispute|letter|lifecycle|reminder|deadline|611/i.test(VERCEL)
);

function walkSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkSources(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}
const ALL_SOURCES = [...walkSources("app"), ...walkSources("lib")].sort();

function callerFiles(pattern: RegExp, excludeFiles: string[]): string[] {
  return ALL_SOURCES.filter((rel) => !excludeFiles.includes(rel))
    .filter((rel) => pattern.test(codeOf(read(rel))))
    .sort();
}
function callCount(pattern: RegExp, excludeFiles: string[]): number {
  const global = new RegExp(pattern.source, "g");
  return ALL_SOURCES.filter((rel) => !excludeFiles.includes(rel)).reduce(
    (n, rel) => n + (codeOf(read(rel)).match(global) ?? []).length,
    0
  );
}

// Same methodology G-M2 itself used: "exhaustive grep of sendEmail call sites
// outside lib/email.ts". This is the pin — if a future edit (this slice or any
// other, before merge) adds a new sender anywhere in app/ or lib/, the swept
// set changes and this fails. D-12 forbids this slice from adding one itself.
const EMAIL_CALLERS = callerFiles(/\bsendEmail\(/, ["lib/email.ts"]);
const EXPECTED_EMAIL_CALLERS = ["app/api/auth/forgot-password/route.ts", "lib/briefDigest.ts"];
check(
  `sendEmail() callers outside lib/email.ts pinned to baseline (${EMAIL_CALLERS.join(", ")})`,
  JSON.stringify(EMAIL_CALLERS) === JSON.stringify(EXPECTED_EMAIL_CALLERS)
);
check(
  "…exactly 3 call expressions total (forgot-password + briefDigest's test-send + its real digest send) — G-M2's own count",
  callCount(/\bsendEmail\(/, ["lib/email.ts"]) === 3
);

const PUSH_USER_CALLERS = callerFiles(/\bsendPushToUser\(/, ["lib/push.ts"]);
const PUSH_ADMIN_CALLERS = callerFiles(/\bsendPushToAdmins\(/, ["lib/push.ts"]);
const EXPECTED_PUSH_ADMIN_CALLERS = [
  "app/api/admin/brief/route.ts",
  "app/api/brief/comments/[id]/report/route.ts",
  "app/api/community/reports/route.ts",
  "lib/briefIngest.ts",
].sort();
check(
  "sendPushToUser() has NO direct caller outside lib/push.ts (the only path in is the fail-closed eventBus indirection, unchanged by this slice)",
  JSON.stringify(PUSH_USER_CALLERS) === JSON.stringify([])
);
check(
  `sendPushToAdmins() callers outside lib/push.ts pinned to baseline, all admin/moderation (${PUSH_ADMIN_CALLERS.join(", ")})`,
  JSON.stringify(PUSH_ADMIN_CALLERS) === JSON.stringify(EXPECTED_PUSH_ADMIN_CALLERS)
);
check(
  "…none of the four pinned push senders is reachable from a consumer-facing route (all four files are under app/api/admin, brief-comment moderation, community moderation, or the ingest cron)",
  PUSH_ADMIN_CALLERS.every((rel) => /admin|comments\/\[id\]\/report|community\/reports|briefIngest/.test(rel))
);

// The composer indirection stays fail-closed: still no composePush wired
// anywhere outside the guard fixture that proves the fail-closed default.
const NOTIFY_SUBSCRIBER = codeOf(read("lib/eventBus/subscribers/notificationCreated.ts"));
check(
  "notificationCreated's default deps still wire NO composePush (fail-closed default is unchanged)",
  /const defaultDeps: NotifyDeps = \{/.test(NOTIFY_SUBSCRIBER) &&
    !/composePush:\s*\(/.test(NOTIFY_SUBSCRIBER.replace(/composePush\?:[^\n]*\n/, ""))
);
check(
  "…and nothing in app/ or lib/ publishes a NOTIFICATION_CREATED event (the pipeline is dead at both ends, not just one)",
  !ALL_SOURCES.filter((rel) => !rel.startsWith("lib/eventBus/")).some((rel) =>
    /"NOTIFICATION_CREATED"|'NOTIFICATION_CREATED'/.test(codeOf(read(rel)))
  )
);

console.log(`\nlifecycle-honesty.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
