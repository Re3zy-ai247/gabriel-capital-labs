// Guards for the Mail Center Download workflow (Phase 1A, Agent D). Covers:
//   1. pickMailBand() — the ONE recommended-action band, its fallback ladder
//      (mail-scoped pick → kaiHome's own secondary note → kaiHome's own
//      sorted deadlines → quiet), and the static "never a second ranking" law
//      (SIM-REVIEW finding 13).
//   2. validateMailedAtInput() — the mark-mailed date capture/validation
//      (Phase 1A honesty triple, part c).
//   3. Static: the Approve control on the new Download Package review surface
//      renders OUTSIDE any Kai-labeled container (the shipped Approval()
//      conflation, B-MAIL-CENTER-EVOLUTION.md §3.2, is not repeated here).
//   4. Static: the §611 mis-anchor (SIM-REVIEW finding 2) is fixed on every
//      Download-path file this agent owns — no "mark it mailed so I can track
//      the window" instruction survives, and receipt/estimate framing exists
//      everywhere a window is rendered from mailedAt.
// Run: npx tsx scripts/mail-download.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickMailBand, validateMailedAtInput } from "../lib/mailCenter";
import type { KaiHomeData, KaiRecommendation } from "../lib/kaiHome";

let pass = 0, fail = 0;
function ok(label: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); } }

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ==== 1. pickMailBand — the fallback ladder, never a second ranking =========
{
  const rec = (over: Partial<KaiRecommendation>): KaiRecommendation => ({
    title: "t", body: "b", cta: "c", href: "/letters", basis: "rule", ...over,
  });
  const kai = (over: Partial<Pick<KaiHomeData, "recommendation" | "deadlines">>): Pick<KaiHomeData, "recommendation" | "deadlines"> => ({
    recommendation: null, deadlines: [], ...over,
  });

  // A. The top-level pick IS mail-scoped (href === "/letters" exactly) — render
  // it verbatim, unscoped.
  const mailScoped = pickMailBand(kai({ recommendation: rec({ title: "Escalate", body: "…", cta: "Go", href: "/letters", basis: "Rule: X" }) }));
  ok("mail-scoped recommendation (href === /letters) renders unscoped", mailScoped.scopeLabel === null);
  ok("...with the SAME title/body/cta/href/basis, verbatim (no re-authoring)",
    mailScoped.title === "Escalate" && mailScoped.sub === "…" && mailScoped.cta === "Go" && mailScoped.href === "/letters" && mailScoped.basis === "Rule: X");
  ok("mail-scoped band is not quiet", mailScoped.quiet === false);

  // B. Top-level pick is NOT mail-scoped (e.g. /upload) but carries a
  // secondary (starvation-guard demotion) — use THAT, never a fresh ranking.
  const withSecondary = pickMailBand(kai({
    recommendation: rec({ href: "/upload", secondary: { label: "Still verified, no follow-up", href: "/letters" } }),
  }));
  ok("non-mail-scoped pick WITH a secondary → scoped 'In the Mail Center:' band using the secondary", withSecondary.scopeLabel === "In the Mail Center:" && withSecondary.title === "Still verified, no follow-up" && withSecondary.href === "/letters");
  ok("...not quiet (there IS something to show)", withSecondary.quiet === false);

  // C. Non-mail-scoped, no secondary, but an open (not-yet-overdue) deadline
  // exists — kaiHome's OWN already-sorted deadlines[0], not a re-sort.
  const withDeadline = pickMailBand(kai({
    recommendation: rec({ href: "/upload" }),
    deadlines: [{ letterId: "l1", recipient: "Equifax", round: 1, daysElapsed: 10, daysLeft: 20 }],
  }));
  ok("non-mail-scoped, no secondary, open deadline → scoped band naming the recipient and days left", withDeadline.scopeLabel === "In the Mail Center:" && /Equifax/.test(withDeadline.title) && /20/.test(withDeadline.title));

  // D. An OVERDUE deadline (daysLeft <= 0) must NOT be used as the fallback —
  // that fact is already what would have driven kaiHome's own lapsed-window
  // branch; showing it here too would double-render the same fact.
  const withOverdue = pickMailBand(kai({
    recommendation: rec({ href: "/upload" }),
    deadlines: [{ letterId: "l2", recipient: "Experian", round: 1, daysElapsed: 40, daysLeft: -10 }],
  }));
  ok("an overdue deadline is never used as the fallback (quiet instead of a negative 'days left')", withOverdue.quiet === true);

  // E. Nothing recommended, nothing waiting → the exact ExecutiveQueue quiet
  // copy, for cross-room voice consistency.
  const quiet = pickMailBand(kai({}));
  ok("no recommendation, no deadlines → quiet, 'You're all caught up'", quiet.quiet === true && quiet.title === "You're all caught up");
  ok("quiet band carries no href/cta to click", quiet.href === "" && quiet.cta === "");

  // F. Phase 1A-R RB-3: a READY_TO_PREPARE package (generated, zero members
  // mailed) is reachable work — it must outrank the quiet fallback and the
  // passive deadlines rung, but never override rung 1 (kaiHome's own
  // /letters-subject pick) or rung 2 (kaiHome's own secondary note). This
  // function still computes no ranking of its own — the count is data
  // groupIntoPackages already produced.
  const rtpOverQuiet = pickMailBand(kai({}), 2);
  ok("RB-3: a READY_TO_PREPARE count > 0 overrides the quiet fallback", rtpOverQuiet.quiet === false && /ready to prepare/i.test(rtpOverQuiet.title));
  ok("RB-3: 'You're all caught up' is impossible while READY_TO_PREPARE packages exist", rtpOverQuiet.title !== "You're all caught up");
  ok("RB-3: the RTP rung names the count", /2/.test(rtpOverQuiet.title));
  ok("RB-3: the RTP rung is basis-carrying, like every other rung", rtpOverQuiet.basis.length > 0);

  const rtpOverDeadline = pickMailBand(kai({
    recommendation: rec({ href: "/upload" }),
    deadlines: [{ letterId: "l1", recipient: "Equifax", round: 1, daysElapsed: 10, daysLeft: 20 }],
  }), 1);
  ok("RB-3: RTP outranks the open-deadline rung (actionable-now beats watching-the-clock)",
    /ready to prepare/i.test(rtpOverDeadline.title) && !/Equifax/.test(rtpOverDeadline.title));

  const rtpUnderPrimary = pickMailBand(kai({ recommendation: rec({ title: "Escalate", body: "…", cta: "Go", href: "/letters", basis: "Rule: X" }) }), 3);
  ok("RB-3: RTP never overrides rung 1 — kaiHome's own /letters-subject pick stays primary even with RTP packages waiting",
    rtpUnderPrimary.title === "Escalate" && rtpUnderPrimary.scopeLabel === null);

  const rtpUnderSecondary = pickMailBand(kai({
    recommendation: rec({ href: "/upload", secondary: { label: "Still verified, no follow-up", href: "/letters" } }),
  }), 4);
  ok("RB-3 rung-order decision: kaiHome's own secondary/starvation note still outranks RTP (both are facts kaiHome's engine already computed; only the passive deadlines/quiet rungs are demoted)",
    rtpUnderSecondary.title === "Still verified, no follow-up");

  const rtpZero = pickMailBand(kai({}), 0);
  ok("RB-3: zero READY_TO_PREPARE packages falls through exactly as before (quiet)", rtpZero.quiet === true && rtpZero.title === "You're all caught up");
}

// ==== 2. validateMailedAtInput — mark-mailed date capture (honesty triple c) =
{
  const CREATED = "2026-07-10T14:00:00.000Z";
  const NOW = Date.parse("2026-07-20T09:00:00.000Z");

  const missing = validateMailedAtInput(undefined, CREATED, NOW);
  ok("missing/undefined date → defaults to today (unchanged behavior for old callers)", missing.ok === true && missing.date?.getTime() === NOW);
  const empty = validateMailedAtInput("", CREATED, NOW);
  ok("empty-string date → also defaults to today", empty.ok === true);

  const malformed = validateMailedAtInput("not-a-date", CREATED, NOW);
  ok("malformed date string → rejected", malformed.ok === false && malformed.date === null);
  const wrongType = validateMailedAtInput(12345, CREATED, NOW);
  ok("non-string input → rejected", wrongType.ok === false);

  const future = validateMailedAtInput("2026-07-25", CREATED, NOW);
  ok("a future date is rejected", future.ok === false && /future/i.test(future.error ?? ""));

  const beforeCreated = validateMailedAtInput("2026-07-01", CREATED, NOW);
  ok("a date before the letter was generated is rejected", beforeCreated.ok === false && /generated/i.test(beforeCreated.error ?? ""));

  const valid = validateMailedAtInput("2026-07-15", CREATED, NOW);
  ok("a valid in-range date is accepted", valid.ok === true && (valid.date?.toISOString().startsWith("2026-07-15") ?? false));

  // Same-day edge case: the letter was generated at 14:00 UTC; mailing it
  // "today" (the same calendar day) must NOT be rejected just because
  // 00:00 UTC < 14:00 UTC — calendar days are compared, not raw timestamps.
  const sameDayAsCreated = validateMailedAtInput("2026-07-10", CREATED, NOW);
  ok("mailing on the SAME CALENDAR DAY the letter was generated is accepted (day comparison, not exact timestamp)", sameDayAsCreated.ok === true);

  const sameDayAsNow = validateMailedAtInput("2026-07-20", CREATED, NOW);
  ok("mailing 'today' (same calendar day as now) is accepted, not rejected as 'future'", sameDayAsNow.ok === true);

  // Phase 1A-R RB-5 — the US-evening reproduction (Founder Experience Gate
  // 1.0 §2): fixed `now`/`createdAt`, no Date.now(), deterministic. At
  // 10:46pm EDT on Aug 3 (UTC-4), the wall clock reads Aug 4 02:46 UTC — the
  // exact moment server-UTC "today" quietly becomes "tomorrow" for the
  // operator. The letter was generated the same evening, also after the UTC
  // midnight rollover (Aug 4 00:15 UTC = 8:15pm EDT) — the exact trap that
  // made createdStart === todayStart and froze the old min=max picker.
  const EVENING_NOW = Date.UTC(2026, 7, 4, 2, 46, 0);
  const EVENING_CREATED = new Date(Date.UTC(2026, 7, 4, 0, 15, 0));

  const trueLocalDate = validateMailedAtInput("2026-08-03", EVENING_CREATED, EVENING_NOW);
  ok("RB-5: the operator's TRUE local date (Aug 3, 10:46pm EDT) is accepted even though the letter's createdAt fell on UTC Aug 4 — the exact reported defect",
    trueLocalDate.ok === true);
  ok("RB-5: an accepted date stores at UTC NOON of the entered calendar day, not midnight (display-safe in every US timezone)",
    trueLocalDate.date?.toISOString() === "2026-08-03T12:00:00.000Z");

  const utcTodayStillFine = validateMailedAtInput("2026-08-04", EVENING_CREATED, EVENING_NOW);
  ok("RB-5: server-UTC 'today' (Aug 4) stays accepted too — tolerance only widens the window, it never narrows it", utcTodayStillFine.ok === true);

  const genuineFuture = validateMailedAtInput("2026-08-05", EVENING_CREATED, EVENING_NOW);
  ok("RB-5: a date no real timezone would call 'today' at this instant (Aug 5) is still rejected as future, even with tolerance",
    genuineFuture.ok === false && /future/i.test(genuineFuture.error ?? ""));

  const genuinePast = validateMailedAtInput("2026-08-02", EVENING_CREATED, EVENING_NOW);
  ok("RB-5: a date before the letter's creation day, beyond tolerance, is still rejected",
    genuinePast.ok === false && /generated/i.test(genuinePast.error ?? ""));
}

// ==== 3. Static: pickMailBand imports the shared engine, invents no ranking =
const MAILCENTER_SRC = read("lib/mailCenter.ts");
{
  ok("lib/mailCenter.ts imports KaiHomeData from @/lib/kaiHome (type-only — the engine, not a fork)",
    /import\s+type\s*\{[^}]*\bKaiHomeData\b[^}]*\}\s*from\s*["']@\/lib\/kaiHome["']/.test(MAILCENTER_SRC));
  ok("does not locally reimplement pickRecommendation's branch conditions (no fcra_605/dateOfFirstDelinquency literals)",
    !/fcra_605/.test(MAILCENTER_SRC) && !/dateOfFirstDelinquency/.test(MAILCENTER_SRC));
  // The one sort this file performs on packages is a RECENCY ordering
  // (createdAt), never an urgency ladder — extract the sort call itself and
  // assert it references no health/priority concept.
  const sortCallMatch = /packages\.sort\(([^;]*)\);/.exec(MAILCENTER_SRC);
  ok("packages.sort(...) call exists (sanity — the check below isn't vacuous)", Boolean(sortCallMatch));
  ok("packages.sort(...) orders by createdAt only — never by health/priority (SIM-REVIEW finding 13: no second ladder)",
    Boolean(sortCallMatch) && /createdAt/.test(sortCallMatch![1]) && !/health/i.test(sortCallMatch![1]));
  ok("pickMailBand is exported (the ONE band function callers use)", /export function pickMailBand/.test(MAILCENTER_SRC));
}

// ==== 4. Static: Approve control renders OUTSIDE the Kai Summary panel ======
const DOWNLOAD_PAGE_SRC = read("app/mail/download/[packageId]/page.tsx");
const DOWNLOAD_APPROVAL_SRC = read("app/mail/download/[packageId]/DownloadApproval.tsx");
{
  const boundaryIdx = DOWNLOAD_PAGE_SRC.indexOf("KAI-PANEL-BOUNDARY");
  // The literal Approve control ("Mark reviewed…") lives in the imported
  // DownloadApproval island, not inlined in page.tsx — so the structural
  // check is where page.tsx RENDERS that island, not a text search for a
  // string that doesn't live in this file.
  const usageIdx = DOWNLOAD_PAGE_SRC.indexOf("<DownloadApproval");
  ok("the KAI-PANEL-BOUNDARY marker exists on the Download review page", boundaryIdx > -1);
  ok("<DownloadApproval> is imported, not inlined into the Kai Summary card's own JSX", /import\s*\{\s*DownloadApproval\s*\}/.test(DOWNLOAD_PAGE_SRC));
  ok("<DownloadApproval> (the Approve control) is rendered AFTER the boundary marker — never nested inside the Kai Summary card", usageIdx > -1 && usageIdx > boundaryIdx);
  // Belt-and-suspenders: no KAI badge marker sits between the boundary and
  // where the Approve island is rendered (a Kai badge re-appearing there
  // would mean a new Kai-labeled wrapper crept back around it).
  const between = boundaryIdx > -1 && usageIdx > boundaryIdx ? DOWNLOAD_PAGE_SRC.slice(boundaryIdx, usageIdx) : "";
  ok("no Kai badge marker sits between the boundary and the rendered Approve island", !/>KAI</.test(between));
  // And inside the island's OWN file: it never wraps its Approve button in a
  // Kai-labeled container either — the conflation this whole law guards
  // against could just as easily be reintroduced one file over.
  ok("DownloadApproval.tsx's own markup carries no KAI badge around its Approve button", !/>KAI</.test(DOWNLOAD_APPROVAL_SRC));
  ok("DownloadApproval.tsx renders the literal 'Mark reviewed' control", /Mark reviewed/.test(DOWNLOAD_APPROVAL_SRC));
}

// ==== 5. Static: §611 receipt-anchored honesty — the mis-anchor is fixed ====
{
  const PRINT_PAGE_SRC = read("app/letters/print/[id]/page.tsx");
  ok("the print page's mailing guide no longer instructs 'mark mailed so I can track the response window' (the exact finding-2 phrase)",
    !/track the response window with you/i.test(PRINT_PAGE_SRC));
  ok("the print page's mailing guide now states the estimate honestly (mentions the bureau receiving it)",
    /bureau (actually )?receives it/i.test(PRINT_PAGE_SRC));
  ok("the print page cross-references the SAME transit-allowance constant (MAIL_TRANSIT_DAYS), not an invented number",
    /MAIL_TRANSIT_DAYS/.test(PRINT_PAGE_SRC));

  const LETTERS_PAGE_SRC = read("app/letters/page.tsx");
  ok("app/letters/page.tsx no longer claims the §611 window 'just opened' the moment a letter is mailed",
    !/window just opened/i.test(LETTERS_PAGE_SRC));
  ok("app/letters/page.tsx's mailed-letter day math is RECEIPT-anchored (uses the shared helper, not a bare mailedAt diff for the §611 window)",
    /daysElapsedSinceEstimatedReceipt/.test(LETTERS_PAGE_SRC));

  const FORECAST_SRC = read("lib/forecast.ts");
  ok("lib/forecast.ts exports the shared transit allowance", /export const MAIL_TRANSIT_DAYS/.test(FORECAST_SRC));
  ok("lib/forecast.ts's windowText states the estimate honestly (receipt language, not a bare mailing-date claim)",
    /receiving this, not mailing it/i.test(FORECAST_SRC));

  ok("lib/mailCenter.ts's bureau windowText is receipt-anchored (mirrors lib/forecast.ts's framing)",
    /receives your dispute, not when you mail it/i.test(MAILCENTER_SRC));
  ok("lib/mailCenter.ts imports the shared transit allowance rather than inventing its own number",
    /MAIL_TRANSIT_DAYS/.test(MAILCENTER_SRC) && /from\s*["']@\/lib\/forecast["']/.test(MAILCENTER_SRC));
}

// ==== 6. Static: evidence-asymmetry disclosure present at every named fork ==
{
  const SENTENCE = /Evidence differs by path: self-mail leaves your own mailing record as proof/;
  ok("the letters page states the evidence-asymmetry disclosure (Download vs Send fork)", SENTENCE.test(read("app/letters/page.tsx")));
  ok("the send wizard entry states the SAME disclosure (consistent wording, not a competing claim)", SENTENCE.test(read("app/mail/send/[letterId]/page.tsx")));
  ok("the new package Download flow states the SAME disclosure", SENTENCE.test(read("app/mail/download/[packageId]/page.tsx")));
}

// ==== 7. Static: F1 — Download reachable before mailing (/letters entry) ====
{
  const LETTERS_PAGE_SRC = read("app/letters/page.tsx");
  ok("app/letters/page.tsx exposes a 'Review & download package' action on generated letters", /Review &amp; download package|Review & download package/.test(LETTERS_PAGE_SRC));
  ok("...routing to the package Download flow (/mail/download/[packageId])", /\/mail\/download\/\$\{encodeURIComponent\(/.test(LETTERS_PAGE_SRC));
  ok("...computed with the SAME tl:{tradelineId}:{strategy}:{round} / solo:{id} package-key format lib/mailCenter.ts's packageKeyFor uses (mailCenter.test.ts pins the literal produced id)",
    /`tl:\$\{[^}]*\.tradelineId\}:\$\{[^}]*\.strategy\}:\$\{[^}]*\.round\}`/.test(LETTERS_PAGE_SRC) && /`solo:\$\{[^}]*\.id\}`/.test(LETTERS_PAGE_SRC));
  ok("the SavedLetter shape carries tradelineId (needed to compute the package id client-side)", /tradelineId:\s*string \| null/.test(LETTERS_PAGE_SRC));

  const LETTERS_ROUTE_SRC = read("app/api/letters/route.ts");
  ok("/api/letters exposes tradelineId (an already-persisted field, no schema change) for the client to compute the package id",
    /tradelineId:\s*l\.tradelineId/.test(LETTERS_ROUTE_SRC));

  const MAILCENTER_SRC2 = read("lib/mailCenter.ts");
  ok("Phase 1A F1: groupIntoPackages no longer drops a package with zero in-mail members (the exact `if (memberRows.length === 0) continue;` early-return is gone)",
    !/if \(memberRows\.length === 0\) continue;/.test(MAILCENTER_SRC2));
  ok("...it renders such a package with the honest READY_TO_PREPARE health instead", /"READY_TO_PREPARE"/.test(MAILCENTER_SRC2));

  const MAIL_PAGE_SRC = read("app/mail/page.tsx");
  ok("/mail renders a distinct 'Ready to prepare' group, never mixed silently into the same list as in-mail packages", /Ready to prepare/.test(MAIL_PAGE_SRC));
  ok("...partitioned by the READY_TO_PREPARE health (not a second, independently-computed grouping)", /p\.health === "READY_TO_PREPARE"/.test(MAIL_PAGE_SRC));
}

// ==== 8. Static: §611 GENERAL negative pattern (Phase 1A-R M4) ==============
// Section 5's checks above are PHRASE-specific (particular substrings
// asserted present/absent) — that exact shape of guard read lib/mailCenter.ts
// and still missed the Phase 1A-R M2 defect (a NEW sentence, "...mail to
// start the §611 clock.", was simply never on any list — extending the list
// with another literal would reproduce the same failure mode against the
// next new sentence). Replaced here with a GENERAL pattern that needs no
// update when the wording changes: strip comments (English contractions like
// "doesn't"/"isn't" in comment prose would otherwise misread as string
// delimiters) and quoted ALL-CAPS status/enum literals ("MAILED",
// "GENERATED", ... — code, never prose), then scan for any sentence-ish
// chunk that names mail/mailed/mailing in the same breath as an ACTIVE
// §611/clock/window claim (starts/started/begins/is running — the "mailing
// switched it on" shape), carrying no receipt/arrival anchor and no negation
// governing the claim. File coverage: lib/mailCenter.ts (M2 + two M4
// findings below), lib/kaiHome.ts (M1's file, one M4 finding), lib/kaiSeen.ts
// and app/journey/page.tsx (the M3 files), and app/mail/page.tsx (the M4
// review's named candidate) — every source this concern actually lived in.
function stripCommentsAndEnumLiterals(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    // Quoted ALL-CAPS tokens are status/enum literals in this codebase
    // (Letter.status/MailStatus values: "MAILED", "GENERATED", "RESOLVED",
    // "RESPONSE_RECEIVED", ...) — a general structural exclusion (prose
    // never writes "MAILED" in caps), not a per-sentence whitelist. Without
    // this, `if (l.status === "MAILED") return "...clock is running.";`
    // falsely counts as "mailing language" next to an adjacent, unrelated
    // §611 sentence.
    .replace(/"[A-Z][A-Z_]{2,}"/g, '""');
}
const MAIL_RE = /\bmail(?:ed|ing)?\b/i;
const CLOCKWORD_RE = /(§\s?611|\bclock\b|\bwindow\b)/i;
// The defect is a CLAIM that the clock/window is already active as of
// mailing — not any sentence that merely mentions both a mailing fact and a
// clock/window noun (e.g. a package "lands here with its §611 clock" only
// labels what's displayed, asserting nothing about timing). Requiring an
// active/started verb targets the actual false statement, not bare topical
// co-mention.
const ACTIVE_RE = /\b(start(?:s|ed|ing)?|begins?|began|beginning|running|ticking)\b/i;
// Anchored-safe: the clock/window is tied to receipt/arrival, not mailing.
const RECEIPT_RE = /\breceiv(?:e[sd]?|ing)\b|\breceipt\b|\barriv(?:e[sd]?|ing)\b/i;
// A negation governing the clock/window/active claim itself ("no §611 clock
// has started") is a TRUE, honest statement this guard must leave alone —
// only a negation within a few words of the clock-noun or the active-verb
// counts, so an unrelated EARLIER negation in the same sentence ("not mailed
// yet ... to start the clock") can't launder a real violation.
const NEGATION_RE = /\b(no|not|never|isn't|hasn't|doesn't|didn't|wasn't|aren't)\b(?:\s+\S+){0,3}\s+(?:§\s?611|clock|window|started|starts|starting|begun|began|running)\b/i;

function findUnanchoredMailClockClaims(rawSrc: string): string[] {
  const noComments = stripCommentsAndEnumLiterals(rawSrc);
  // Collapse whitespace (so a claim split across source LINES — JSX text
  // wraps at the formatter's line width, e.g. app/mail/page.tsx's
  // Ready-to-prepare paragraph — still reads as the one continuous sentence
  // a user actually sees), then chunk on '.', '!', '?', ';' — plain-English
  // sentence-enders AND JS statement terminators (adjacent `return "...";`
  // statements must never bleed into each other). Deliberately NOT '{'/'}':
  // those sit INSIDE template-literal interpolations (`${p.recipient}` sits
  // between "went out to" and "clock started" in one real string in this
  // codebase) and would fragment a single claim into unrelated pieces.
  const norm = noComments.replace(/\s+/g, " ").trim();
  const chunks = norm.split(/(?<=[.!?;])\s*/).map((x) => x.trim()).filter(Boolean);
  const hits: string[] = [];
  for (const s of chunks) {
    if (MAIL_RE.test(s) && CLOCKWORD_RE.test(s) && ACTIVE_RE.test(s) && !RECEIPT_RE.test(s) && !NEGATION_RE.test(s)) {
      hits.push(s);
    }
  }
  return hits;
}

{
  // (a) Negative control: the pattern must catch the OLD M2 sentence,
  // verbatim, if it were ever reintroduced — proven directly against the
  // sentence text, independent of any file on disk.
  const OLD_M2_SENTENCE = "Generated, not mailed yet — review, download, and mail to start the §611 clock.";
  ok("general §611 pattern: catches the OLD M2 sentence verbatim if reintroduced (negative control)",
    findUnanchoredMailClockClaims(OLD_M2_SENTENCE).length === 1);

  // (b) Must not cry wolf on legitimately receipt/arrival-anchored or
  // honestly-negated copy already shipped elsewhere in the product (pulled
  // from app/letters/page.tsx and lib/mailCenter.ts's furnisher branch,
  // neither of which this slice touches).
  const safeControls = [
    "Ready to mail — the §611 clock starts when the bureau receives it.",
    "Ready to mail — the response clock starts once it arrives.",
    "There's no fixed bureau clock here — keep your proof of mailing and follow up if you don't hear back.",
    "Generated, not mailed yet — nothing's mailed and no §611 clock has started.",
  ];
  for (const s of safeControls) {
    ok(`general §611 pattern: no false positive on "${s}"`, findUnanchoredMailClockClaims(s).length === 0);
  }

  // (c) Applied to every corrected source this concern lives in — must come
  // back clean on all of them.
  const KAIHOME_SRC = read("lib/kaiHome.ts");
  const KAISEEN_SRC = read("lib/kaiSeen.ts");
  const JOURNEY_PAGE_SRC = read("app/journey/page.tsx");
  const MAILPAGE_SRC2 = read("app/mail/page.tsx");
  // Coordinator extension (1A-R-C): the generalized pattern surfaced the same
  // defect class in two more files during the slice — cover them permanently
  // so a future rewording there is caught the same way.
  const MISSIONCONTROL_SRC = read("lib/missionControl.ts");
  const LETTERS_PAGE_SRC = read("app/letters/page.tsx");

  for (const [label, src] of [
    ["lib/mailCenter.ts", MAILCENTER_SRC],
    ["lib/kaiHome.ts", KAIHOME_SRC],
    ["lib/kaiSeen.ts", KAISEEN_SRC],
    ["app/journey/page.tsx", JOURNEY_PAGE_SRC],
    ["app/mail/page.tsx", MAILPAGE_SRC2],
    ["lib/missionControl.ts", MISSIONCONTROL_SRC],
    ["app/letters/page.tsx", LETTERS_PAGE_SRC],
  ] as const) {
    const hits = findUnanchoredMailClockClaims(src);
    ok(`general §611 pattern: ${label} carries no unanchored mail+clock claim${hits.length ? ` (found: ${hits.join(" || ")})` : ""}`, hits.length === 0);
  }

  // (d) Supplementary, targeted check for lib/kaiSeen.ts's own "letter.mailed"
  // entry specifically: its idiom says "went out to X" rather than "mailed
  // to X" (a domain-specific synonym the literal mail/mailed/mailing
  // vocabulary above doesn't cover — every LABEL entry in that one file is
  // inherently mail-lifecycle copy by construction). Rather than broaden the
  // general pattern's core vocabulary for one file's word choice, this
  // asserts the actual PROPERTY the general pattern enforces everywhere
  // else — "an active clock/window claim must be receipt-anchored" —
  // directly against that one entry.
  const letterMailedEntry = /"letter\.mailed":[\s\S]*?href:\s*"\/letters"\s*\}\)/.exec(KAISEEN_SRC);
  ok("kaiSeen.ts's letter.mailed entry is found (sanity — the check below isn't vacuous)", Boolean(letterMailedEntry));
  if (letterMailedEntry) {
    const entry = letterMailedEntry[0];
    ok("kaiSeen.ts's letter.mailed entry does make a §611/clock claim (sanity — a claim exists to anchor)",
      CLOCKWORD_RE.test(entry) && ACTIVE_RE.test(entry));
    ok("kaiSeen.ts's letter.mailed entry: its §611/clock claim is receipt-anchored", RECEIPT_RE.test(entry));
  }
}

console.log(`\nmail-download.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
