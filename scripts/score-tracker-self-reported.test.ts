// Regression guard for the Self-Reported Score Tracker correction (S-01..S-06,
// A3-letters-dispute-mail-scores.md).
// Run: npx tsx scripts/score-tracker-self-reported.test.ts
//
// Source-shape assertions (does the code say the right thing) plus direct
// execution of the pure helpers in lib/selfReportedScores.ts (does the logic
// actually do the right thing). Runtime execution of the session-gated
// route/layout lives in scripts/score-tracker-auth-runtime.test.ts.
//
// SCOPE NOTE (RC1 vs. the p0 source this was adapted from): the p0 lane's
// version of this file also asserted against lib/missionControl.ts,
// lib/missionEngine/engine.ts, lib/roadmap/engine.ts, lib/intelligence/*,
// lib/builder/engine.ts, lib/kai.ts, lib/auth.ts, lib/session.ts content,
// app/api/cxos/founder-bootstrap/route.ts, app/login/page.tsx and
// next.config.js. None of those files are owned by this slice (S9) and none
// of them were touched by this adoption — those assertions are dropped, not
// silently broken. Cross-file Score Tracker consumers (Mission Control,
// Roadmap, Builder, Kai) already read prisma.scoreEntry directly and are
// unaffected because the ScoreEntry Prisma model is unchanged here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_TIMEZONE_OFFSET_MINUTES,
  SELF_REPORTED_SCORE_COMPARABILITY_NOTE,
  SELF_REPORTED_SCORE_DISCLOSURE,
  buildSelfReportedScoreSeries,
  formatUserRecordedScoreChange,
  isFutureLocalDate,
  localDateIso,
  selfReportedScoreInventory,
  todayIso,
} from "../lib/selfReportedScores";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) { pass++; console.log(`✓ ${label}`); }
  else { fail++; console.error(`✗ ${label}`); }
}

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const page = read("app/scores/page.tsx");
const api = read("app/api/scores/route.ts");
const layout = read("app/scores/layout.tsx");
const css = read("app/globals.css");
const schema = read("prisma/schema.prisma");

// ── Pure helpers (lib/selfReportedScores.ts) ─────────────────────────────────
const sample = [
  { id: "eq-1", bureau: "EQUIFAX", score: 600, recordedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T01:00:00.000Z" },
  { id: "eq-2", bureau: "EQUIFAX", score: 624, recordedAt: "2026-03-01T00:00:00.000Z", createdAt: "2026-03-01T01:00:00.000Z" },
  { id: "ex-1", bureau: "EXPERIAN", score: 710, recordedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T01:00:00.000Z" },
  { id: "ex-2", bureau: "EXPERIAN", score: 698, recordedAt: "2026-03-01T00:00:00.000Z", createdAt: "2026-03-01T01:00:00.000Z" },
  { id: "tu-1", bureau: "TRANSUNION", score: 680, recordedAt: "2026-02-01T00:00:00.000Z", createdAt: "2026-02-01T01:00:00.000Z" },
];
const series = buildSelfReportedScoreSeries(sample);
const eq = series.find((item) => item.bureau === "EQUIFAX");
const ex = series.find((item) => item.bureau === "EXPERIAN");

check("same-bureau positive change is computed from user entries only", eq?.change === 24);
check("same-bureau negative change is computed from user entries only", ex?.change === -12);
check("positive change copy is explicitly user-recorded and non-causal", formatUserRecordedScoreChange(24) === "User-recorded score change: +24 points.");
check("negative change copy is explicitly user-recorded and uses a true minus sign", formatUserRecordedScoreChange(-12) === "User-recorded score change: −12 points.");
check("zero change copy remains neutral", formatUserRecordedScoreChange(0) === "User-recorded score change: 0 points.");

// S-03: same-day entries must have a deterministic order (stable tie-break),
// so the delta's sign/color cannot flip between reloads.
const sameDay = [
  { id: "same-2", bureau: "EQUIFAX", score: 700, recordedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-04-01T02:00:00.000Z" },
  { id: "same-1", bureau: "EQUIFAX", score: 650, recordedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-04-01T01:00:00.000Z" },
];
check("same-day direction is deterministic by createdAt then id", buildSelfReportedScoreSeries(sameDay)[0].change === 50 && buildSelfReportedScoreSeries([...sameDay].reverse())[0].change === 50);

// L-1 (review): the prior sameDay fixture differs in createdAt, so the THIRD
// tie-break leg (id.localeCompare) was never exercised — both same-day
// entries here share IDENTICAL recordedAt AND createdAt, so only `id` can
// break the tie.
const sameInstant = [
  { id: "b-later-id", bureau: "EQUIFAX", score: 710, recordedAt: "2026-05-01T00:00:00.000Z", createdAt: "2026-05-01T01:00:00.000Z" },
  { id: "a-earlier-id", bureau: "EQUIFAX", score: 655, recordedAt: "2026-05-01T00:00:00.000Z", createdAt: "2026-05-01T01:00:00.000Z" },
];
check("when recordedAt AND createdAt are identical, the id leg alone breaks the tie (L-1)", buildSelfReportedScoreSeries(sameInstant)[0].change === 55 && buildSelfReportedScoreSeries([...sameInstant].reverse())[0].change === 55);

const inventory = selfReportedScoreInventory(sample);
check("inventory counts entries and bureaus without summing their changes", inventory.entryCount === 5 && inventory.bureauCount === 3 && inventory.stat === "5 entries");
check("canonical disclosure states self-entry, no retrieval/verification, and comparability limits", /entered by you/.test(SELF_REPORTED_SCORE_DISCLOSURE) && /does not pull live scores/.test(SELF_REPORTED_SCORE_DISCLOSURE) && /not independently verified/.test(SELF_REPORTED_SCORE_DISCLOSURE) && /model, source, and date/.test(SELF_REPORTED_SCORE_DISCLOSURE));
check("comparability note never claims like-for-like models or sources", /do not establish/.test(SELF_REPORTED_SCORE_COMPARABILITY_NOTE) && /model or monitoring source/.test(SELF_REPORTED_SCORE_COMPARABILITY_NOTE));

// ── S-02 required addition: local-date vs. UTC-date, a real Date instant ────
// 2026-08-13T02:00:00.000Z is 2026-08-12 19:00 in America/Los_Angeles (UTC-7,
// PDT) — a US-evening visitor for whom the OLD bug (`toISOString().slice(0,10)`,
// the UTC calendar day) silently reads as TOMORROW. This is the exact defect
// class the letters lane fixed for the mark-mailed picker (RB-5) and the A3
// report's S-02 finding for the Score Tracker.
{
  const prevTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  const usEveningInstant = new Date("2026-08-13T02:00:00.000Z");
  const utcCalendarDate = usEveningInstant.toISOString().slice(0, 10);
  const localCalendarDate = localDateIso(usEveningInstant);
  check("the UTC and local calendar dates genuinely differ for this instant (test is non-vacuous)", utcCalendarDate === "2026-08-13" && localCalendarDate === "2026-08-12");
  check("localDateIso reads the VISITOR's local evening date, not tomorrow's UTC date", localCalendarDate === "2026-08-12");
  check("localDateIso never returns the UTC-shifted date for a US-evening instant", localCalendarDate !== utcCalendarDate);
  if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;
}
{
  // A far-ahead zone (UTC+14) exercises the opposite direction: local date is
  // AHEAD of the UTC date, proving this isn't a US-only hardcoded offset.
  const prevTz = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati";
  const instant = new Date("2026-08-12T22:00:00.000Z");
  check("localDateIso also reads correctly ahead of UTC (Kiritimati, UTC+14)", localDateIso(instant) === "2026-08-13" && instant.toISOString().slice(0, 10) === "2026-08-12");
  if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;
}
check("todayIso() is a thin wrapper over localDateIso(new Date())", typeof todayIso() === "string" && /^\d{4}-\d{2}-\d{2}$/.test(todayIso()));

// ── M-1 (review remediation): isFutureLocalDate / the server-side leg ───────
// The route no longer compares recordedAt's UTC-midnight parse against the
// server's own Date.now() when the client sends a date-only string plus its
// own timezoneOffset — it compares CALENDAR DATES in the SUBMITTER's frame.
// This reproduces the review's own worked example: 2026-08-23T20:00:00.000Z
// (server "now") is still 2026-08-23 in UTC, but already 2026-08-24 in
// Sydney (UTC+10, getTimezoneOffset() === -600) and in Kolkata
// (UTC+5:30, getTimezoneOffset() === -330).
{
  const serverNowMs = new Date("2026-08-23T20:00:00.000Z").getTime();
  const sydneyOffset = -600;
  const kolkataOffset = -330;

  check("Sydney's own local today (one day ahead of the server's UTC date) is NOT future", !isFutureLocalDate("2026-08-24", new Date("2026-08-24").getTime(), sydneyOffset, serverNowMs));
  check("Kolkata's own local today is NOT future", !isFutureLocalDate("2026-08-24", new Date("2026-08-24").getTime(), kolkataOffset, serverNowMs));
  check("a date genuinely beyond Sydney's own local today (one more day out) IS future", isFutureLocalDate("2026-08-25", new Date("2026-08-25").getTime(), sydneyOffset, serverNowMs));
  check("the server's own UTC-behind date (2026-08-23) is never future for itself", !isFutureLocalDate("2026-08-23", new Date("2026-08-23").getTime(), 0, serverNowMs));

  // Fail-closed: no offset, or a non-finite offset, preserves the ORIGINAL
  // strict instant-vs-instant check — proving Sydney's today is future
  // under that exact prior behaviour (this is what M-1 reported as broken).
  check("with NO offset, Sydney's local today still fails closed to the strict prior check", isFutureLocalDate("2026-08-24", new Date("2026-08-24").getTime(), undefined, serverNowMs));
  check("a non-finite offset (NaN) also fails closed", isFutureLocalDate("2026-08-24", new Date("2026-08-24").getTime(), Number.NaN, serverNowMs));
  check("a non-numeric offset also fails closed", isFutureLocalDate("2026-08-24", new Date("2026-08-24").getTime(), "not-a-number", serverNowMs));

  // Clamp: an offset far outside any real timezone cannot buy more than
  // MAX_TIMEZONE_OFFSET_MINUTES (14h) of leniency in either direction.
  check("MAX_TIMEZONE_OFFSET_MINUTES is exactly 14 hours", MAX_TIMEZONE_OFFSET_MINUTES === 14 * 60);
  check("an absurd ahead-claiming offset is clamped to 14h, not trusted verbatim — 2 days out is still future", isFutureLocalDate("2026-08-25", new Date("2026-08-25").getTime(), -999999, serverNowMs));
  check("clamped to exactly +14h, Sydney's own one-day-ahead today is still accepted (the clamp doesn't UNDER-grant real zones)", !isFutureLocalDate("2026-08-24", new Date("2026-08-24").getTime(), -840, serverNowMs));

  // Only a bare date-only string gets this treatment — a full timestamp
  // (never sent by this app's client) always falls back to the strict
  // instant check, regardless of any offset supplied alongside it.
  const farFutureIso = new Date(serverNowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
  check("a full-timestamp recordedAt ignores any offset and stays on the strict check", isFutureLocalDate(farFutureIso, new Date(farFutureIso).getTime(), sydneyOffset, serverNowMs));
}


// ── Page copy / structure (app/scores/page.tsx) ──────────────────────────────
check("page heading and compact provenance badge are visibly SELF-REPORTED", /Self-Reported Score Tracker/.test(page) && /SELF-REPORTED/.test(page));
check("bureau cards expose self-reported provenance and unavailable state to assistive technology", /self-reported score: unavailable/.test(page) && /self-reported score: latest/.test(page));
check("history and form use explicit self-reported language", /Self-reported score history/.test(page) && /Add a self-reported score/.test(page) && /Add self-reported score/.test(page));
check("positive movement uses success treatment, negative movement uses the base app's rose tone (not a bespoke error style)", /change > 0 \? "text-success-400" : change < 0 \? "text-rose-400"/.test(page));
check("page has no affirmative verification, bureau-confirmation, dispute-success, deletion, or causal score claim", !/(?:report-verified|bureau-confirmed|successful dispute|successful deletion|CreditVector (?:raised|improved|increased)|Kai (?:raised|improved|increased)|dispute caused|deletion caused)/i.test(page));
// S-05 (VERIFIED NEGATIVE, must stay negative): tree-wide phrasing the A3
// report used to confirm no causal linkage exists anywhere in the product.
// Re-run against every file this slice writes, so this adoption cannot
// reintroduce what main correctly never had.
const causalPhrasing = /score improvement|points gained|boost your score|raise your score|increase your score|scoreDelta|estimatedPoints|score impact|score lift/i;
check("no file this slice writes ties a score change to a CreditVector action (S-05 stays negative)", !causalPhrasing.test(page) && !causalPhrasing.test(api) && !causalPhrasing.test(layout) && !causalPhrasing.test(read("lib/selfReportedScores.ts")));
check("mobile and tablet bureau cards stack until the large breakpoint", /grid-cols-1[^\n]*lg:grid-cols-3/.test(page));
check("legend wraps rather than overflowing narrow cards", /flex flex-wrap gap-x-4 gap-y-2 text-xs/.test(page));

check("form fields have associated labels and bounded numeric input", /htmlFor="self-reported-score-bureau"/.test(page) && /htmlFor="self-reported-score-value"/.test(page) && /type="number"/.test(page) && /min=\{300\} max=\{850\} step=\{1\}/.test(page));
check("recorded date hydrates from the visitor's local date via lib/selfReportedScores and rejects future dates", /todayIso\(\)/.test(page) && /max=\{today \|\| undefined\}/.test(page) && /Date recorded cannot be in the future/.test(api));
check("the client sends its own timezoneOffset alongside the date-only recordedAt (M-1)", /timezoneOffset: new Date\(\)\.getTimezoneOffset\(\)/.test(page));
check("the route derives the future-date decision through isFutureLocalDate, not a bare instant compare (M-1)", /import \{ isFutureLocalDate \} from "@\/lib\/selfReportedScores"/.test(api) && /isFutureLocalDate\(body\?\.recordedAt, recordedAt\.getTime\(\), body\?\.timezoneOffset, Date\.now\(\)\)/.test(api));
check("save confirmation and errors are announced", /role="status"[^>]*aria-live="polite"/.test(page) && /role="alert"/.test(page));
check("loading failure is distinct from an empty history", /setLoadError\("Your self-reported score history could not be loaded/.test(page) && /loadError \?/.test(page));
check("chart has a titled description and a visible exact-entry equivalent (S-01)", /aria-labelledby="self-reported-score-chart-title self-reported-score-chart-description"/.test(page) && /View exact self-reported entries/.test(page) && /Exact self-reported score history/.test(page));
check("point tooltips and exact table include bureau, score, date, and provenance", /<title>\{`\$\{ser\.label\} · SELF-REPORTED/.test(page) && /Bureau selected by you/.test(page) && /Self-reported score/.test(page) && /Date recorded/.test(page));
check("reduced motion lands chart lines in their final visible state (base globals.css, unmodified by this slice)", /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.animate-draw \{ stroke-dashoffset: 0 !important; \}/.test(css) && /motion-reduce:animate-none/.test(page));

// ── API (app/api/scores/route.ts) ────────────────────────────────────────────
check("manual API GET and POST remain current-user scoped ScoreEntry operations", /currentUserOrDemo\(\)/.test(api) && /scoreEntry\.findMany\(\{\s*where: \{ userId: user\.id \}/s.test(api) && /scoreEntry\.create\(\{\s*data: \{ userId: user\.id,/s.test(api));
check("manual API and pure series use stable same-day chronology (S-03)", /orderBy: \[\{ recordedAt: "asc" \}, \{ createdAt: "asc" \}, \{ id: "asc" \}\]/.test(api) && /sort\(compareSelfReportedScoreEntries\)/.test(page));
check("manual API does not read or write CreditScoreObservation", !/creditScoreObservation|CreditScoreObservation/.test(api));
// Checks for an actual IMPORT of the rejected preview-auth helper, not mere
// mention — the file headers above deliberately document what was REMOVED
// and name it in prose, so a bare substring match would false-positive on
// this file's own explanatory comments.
const importsRejectedHelper = (src: string) => /import\s*\{[^}]*currentScoreEntryUserId[^}]*\}\s*from/.test(src);
check("the rejected preview-auth dependency is not imported by any file this slice writes", !importsRejectedHelper(api) && !importsRejectedHelper(layout) && !importsRejectedHelper(page));

// ── Layout (app/scores/layout.tsx) — S-06 ───────────────────────────────────
check("the layout gate resolves the real base session helper and redirects an absent user (S-06)", /currentUserOrDemo\(\)/.test(layout) && /redirect\("\/login\?callbackUrl=\/scores"\)/.test(layout) && /export const dynamic = "force-dynamic"/.test(layout));
check("client 401s on load and submit send the visitor to the same login callback the layout uses", (page.match(/window\.location\.replace\("\/login\?callbackUrl=\/scores"\)/g) ?? []).length === 2);

// ── Schema (read-only — this slice does not modify prisma/schema.prisma) ────
const scoreEntryStart = schema.indexOf("model ScoreEntry");
const scoreEntryEnd = schema.indexOf("\n}", scoreEntryStart);
const scoreEntryModel = schema.slice(scoreEntryStart, scoreEntryEnd + 2);
check("ScoreEntry remains a self-reported model without report/model provenance claims (no migration in this slice)", scoreEntryStart >= 0 && !/reportVersion|modelKey|sourceMethod|verified/i.test(scoreEntryModel));

console.log(`\nscore-tracker-self-reported.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
