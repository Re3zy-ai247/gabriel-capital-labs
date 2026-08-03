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

console.log(`\nmail-download.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
