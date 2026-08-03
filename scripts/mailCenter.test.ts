// Guards for the Mail Center projection (Sprint IX). Pure, deterministic — no DB,
// no AI. Run: npx tsx scripts/mailCenter.test.ts
import { buildMailCenter, mailHealth, WATCHING_CLOCK_LINE, type MailLetter } from "../lib/mailCenter";

let failures = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}
function eq(label: string, got: unknown, want: unknown) {
  ok(`${label} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want));
}

const DAY = 86_400_000;
const now = Date.parse("2026-07-01T00:00:00Z");
function daysAgo(n: number) { return new Date(now - n * DAY).toISOString(); }

function L(over: Partial<MailLetter>): MailLetter {
  return {
    id: "l", targetBureau: "EQUIFAX", mailedAt: null, responseAt: null, round: 1, status: "GENERATED",
    recipientName: "Equifax", recipientType: "bureau", creditorName: "Midland", createdAt: daysAgo(40),
    hasResponse: false, responseOutcome: null, tradelineId: "t1", strategy: "fcra_611", ...over,
  };
}

// ---- health state machine (all six states reachable, driven by state) ----
eq("within window, no response → waiting normally", mailHealth(L({ status: "MAILED", mailedAt: daysAgo(10) }), false), "WAITING_NORMALLY");
eq("past window, no response → needs attention", mailHealth(L({ status: "MAILED", mailedAt: daysAgo(40) }), true), "NEEDS_ATTENTION");
eq("verified response → ready for round 2", mailHealth(L({ status: "MAILED", mailedAt: daysAgo(40), hasResponse: true, responseOutcome: "verified" }), true), "READY_FOR_ROUND_2");
eq("no-response outcome → escalation available", mailHealth(L({ status: "MAILED", mailedAt: daysAgo(40), hasResponse: true, responseOutcome: "no_response" }), true), "ESCALATION_AVAILABLE");
eq("unknown outcome logged → response received", mailHealth(L({ status: "MAILED", mailedAt: daysAgo(40), hasResponse: true, responseOutcome: "unknown" }), true), "RESPONSE_RECEIVED");
eq("deleted → completed", mailHealth(L({ status: "MAILED", hasResponse: true, responseOutcome: "deleted" }), true), "COMPLETED");
eq("resolved status → completed", mailHealth(L({ status: "RESOLVED" }), false), "COMPLETED");

// ---- projection: only mailed/responded letters enter the Mail Center ----
const center = buildMailCenter([
  L({ id: "unmailed", status: "GENERATED", mailedAt: null }),                                  // excluded
  L({ id: "waiting", status: "MAILED", mailedAt: daysAgo(12) }),                                // included
  L({ id: "overdue", status: "MAILED", mailedAt: daysAgo(45) }),                               // included
  L({ id: "answered", status: "MAILED", mailedAt: daysAgo(50), responseAt: daysAgo(30), hasResponse: true, responseOutcome: "verified", round: 1 }),
], now);
eq("unmailed letter excluded from Mail Center rows", center.rows.some((r) => r.letterId === "unmailed"), false);
eq("three mailed disputes shown", center.rows.length, 3);

// ---- dashboard stats are real ----
eq("generated counts ALL letters", center.stats.generated, 4);
eq("mailed counts mailedAt-set", center.stats.mailed, 3);
eq("waiting = mailed & unanswered", center.stats.waiting, 2);
eq("responses counts logged", center.stats.responses, 1);
eq("avg response withheld below 3 samples (honest)", center.stats.avgResponseDays, null);
eq("delivered is reserved (null)", center.stats.delivered, null);
eq("mail spend is 0 today (self-mail)", center.stats.totalSpendCents, 0);

// avg shows only with ≥3 logged responses (matches the forecast minimum sample)
const withAvg = buildMailCenter([
  L({ id: "a", status: "MAILED", mailedAt: daysAgo(50), responseAt: daysAgo(40), hasResponse: true, responseOutcome: "updated" }),
  L({ id: "b", status: "MAILED", mailedAt: daysAgo(50), responseAt: daysAgo(30), hasResponse: true, responseOutcome: "updated" }),
  L({ id: "c", status: "MAILED", mailedAt: daysAgo(50), responseAt: daysAgo(20), hasResponse: true, responseOutcome: "updated" }),
], now);
eq("avg response computes with 3 samples (10/20/30 → 20)", withAvg.stats.avgResponseDays, 20);

// ---- timeline honesty: real stages have state, provider stages are placeholders, none faked ----
const waiting = center.rows.find((r) => r.letterId === "waiting")!;
const gen = waiting.timeline.find((s) => s.key === "generated")!;
const mailed = waiting.timeline.find((s) => s.key === "mailed")!;
const delivery = waiting.timeline.find((s) => s.key === "delivery")!;
const resp = waiting.timeline.find((s) => s.key === "response")!;
ok("generated stage is done with a timestamp", gen.state === "done" && gen.at !== null);
ok("mailed stage is done for a mailed letter", mailed.state === "done");
ok("delivery (provider) stage is a placeholder, never done", delivery.state === "placeholder" && delivery.at === null);
ok("no provider stage is ever marked done", !waiting.timeline.some((s) => s.state === "done" && ["payment","provider_print","carrier","delivery","tracking","certified"].includes(s.key)));
ok("unanswered response stage is pending", resp.state === "pending");

// ---- CROA: no string implies deletion/guarantee/predicted bureau behavior ----
const FORBIDDEN = /guarantee|will be deleted|will delete|we delete|removed for you|remove it|guaranteed|will improve|score will/i;
const allStrings = center.rows.flatMap((r) => [r.recommendation, ...r.kaiIntel, ...r.timeline.map((s) => s.description)]);
ok("no forbidden outcome-promising phrase in any Mail Center string", !allStrings.some((s) => FORBIDDEN.test(s)));
ok("recommendations are non-empty process guidance", center.rows.every((r) => r.recommendation.length > 10));

// verified BUREAU item recommends the method-of-verification (process, statute-cited)
const answered = center.rows.find((r) => r.letterId === "answered")!;
ok("verified bureau → MoV recommendation", /method of verification|611\(a\)\(7\)/i.test(answered.recommendation));
ok("verified item health is Ready for Round 2", answered.health === "READY_FOR_ROUND_2");

// ---- recipient-correct statutes (the HIGH finding): non-bureau letters must
// NOT be framed as §611 bureau reinvestigations ----
const nonBureau = buildMailCenter([
  L({ id: "furn", recipientType: "furnisher", targetBureau: null, recipientName: "Capital One", status: "MAILED", mailedAt: daysAgo(10) }),
  L({ id: "coll", recipientType: "collector", targetBureau: null, recipientName: "Midland", status: "MAILED", mailedAt: daysAgo(10) }),
], now);
const furn = nonBureau.rows.find((r) => r.letterId === "furn")!;
const coll = nonBureau.rows.find((r) => r.letterId === "coll")!;
const furnWindow = furn.timeline.find((s) => s.key === "window")!;
const collWindow = coll.timeline.find((s) => s.key === "window")!;
ok("furnisher letter is framed §623, not §611", /§623|1681s-2/.test(furnWindow.description + furn.recommendation) && !/§611/.test(furnWindow.description));
ok("furnisher window label cites §623", /§623/.test(furnWindow.label));
ok("collector letter is framed FDCPA §1692g, not §611", /1692g/.test(collWindow.description + coll.recommendation) && !/§611/.test(collWindow.description));
ok("collector window label cites §1692g", /1692g/.test(collWindow.label));
ok("bureau letter still cites §611", /§611/.test(center.rows.find((r) => r.letterId === "waiting")!.timeline.find((s) => s.key === "window")!.description));

// ---- Phase 1A / SIM-REVIEW finding 11: "Kai is watching the clock" — reused
// verbatim from Mission Control, rendered ONLY for a genuinely live window ----
const clockCenter = buildMailCenter([
  L({ id: "live", status: "MAILED", mailedAt: daysAgo(10) }),  // WAITING_NORMALLY — a real, still-running window
  L({ id: "late", status: "MAILED", mailedAt: daysAgo(40) }),  // NEEDS_ATTENTION — window already passed
  L({ id: "done", status: "RESOLVED" }),                        // COMPLETED
], now);
const liveRow = clockCenter.rows.find((r) => r.letterId === "live")!;
const lateRow = clockCenter.rows.find((r) => r.letterId === "late")!;
const doneRow = clockCenter.rows.find((r) => r.letterId === "done")!;
ok("live window (WAITING_NORMALLY) → kaiIntel includes the watching-the-clock line", liveRow.kaiIntel.includes(WATCHING_CLOCK_LINE));
ok("past window (NEEDS_ATTENTION) → the line is NOT shown (no longer true)", !lateRow.kaiIntel.includes(WATCHING_CLOCK_LINE));
ok("resolved (COMPLETED) → the line is NOT shown", !doneRow.kaiIntel.includes(WATCHING_CLOCK_LINE));
ok("the exact exported constant is the literal shown (single source of truth)", WATCHING_CLOCK_LINE === "Kai is watching the clock." && liveRow.kaiIntel.includes("Kai is watching the clock."));

// ---- Phase 1A: Dispute Package grouping (schema-free) -----------------------
// Key: same tradelineId + strategy + round. A null tradelineId (orphaned
// letter) falls back to its own id, so it never merges with an unrelated one.
const pkgCenter = buildMailCenter([
  L({ id: "p1a", tradelineId: "tlA", strategy: "fcra_611", round: 1, recipientName: "Equifax", status: "MAILED", mailedAt: daysAgo(10), createdAt: daysAgo(15) }),
  L({ id: "p1b", tradelineId: "tlA", strategy: "fcra_611", round: 1, recipientName: "Experian", status: "MAILED", mailedAt: daysAgo(10), createdAt: daysAgo(15) }),
  L({ id: "p1c", tradelineId: "tlA", strategy: "fcra_611", round: 1, recipientName: "TransUnion", status: "GENERATED", mailedAt: null, createdAt: daysAgo(15) }),
  L({ id: "p2", tradelineId: "tlB", strategy: "fcra_611", round: 1, recipientName: "Capital One", status: "MAILED", mailedAt: daysAgo(5), createdAt: daysAgo(6) }),
  L({ id: "p3", tradelineId: null, strategy: "fcra_611", round: 1, recipientName: "Chase", status: "MAILED", mailedAt: daysAgo(3), createdAt: daysAgo(4) }),
  L({ id: "p4", tradelineId: null, strategy: "fcra_611", round: 1, recipientName: "Discover", status: "MAILED", mailedAt: daysAgo(3), createdAt: daysAgo(4) }),
], now);
eq("3 same-tradeline+strategy+round letters group to 1, + 1 other tradeline + 2 solo orphans → 4 packages", pkgCenter.packages.length, 4);
const tlAPkg = pkgCenter.packages.find((p) => p.members.some((m) => m.letterId === "p1a"))!;
ok("same tradeline+strategy+round letters group into ONE package", tlAPkg.members.length === 3 && tlAPkg.members.some((m) => m.letterId === "p1b") && tlAPkg.members.some((m) => m.letterId === "p1c"));
ok("a different tradeline never merges into that package", !tlAPkg.members.some((m) => m.letterId === "p2"));
ok("two orphaned (null tradelineId) letters never merge with each other — each is its own solo package", !pkgCenter.packages.some((p) => p.members.some((m) => m.letterId === "p3") && p.members.some((m) => m.letterId === "p4")));

// Determinism — identical input, same clock, always yields the same package
// id set (no randomness, no insertion-order artifact beyond a stable sort).
const detA = buildMailCenter([L({ id: "d1", tradelineId: "tlD", status: "MAILED", mailedAt: daysAgo(5) }), L({ id: "d2", tradelineId: "tlE", status: "MAILED", mailedAt: daysAgo(5) })], now).packages.map((p) => p.packageId).sort();
const detB = buildMailCenter([L({ id: "d1", tradelineId: "tlD", status: "MAILED", mailedAt: daysAgo(5) }), L({ id: "d2", tradelineId: "tlE", status: "MAILED", mailedAt: daysAgo(5) })], now).packages.map((p) => p.packageId).sort();
eq("package grouping is deterministic across repeated calls with identical input", detA, detB);

// A single letter is a package of one (spec).
const soloCenter = buildMailCenter([L({ id: "solo1", tradelineId: "tlSolo", status: "MAILED", mailedAt: daysAgo(5) })], now);
eq("a single letter forms a package of one", soloCenter.packages.length, 1);
eq("...with exactly one member", soloCenter.packages[0].members.length, 1);

// A package whose members are ALL still ungenerated-into-mail doesn't render
// at all — that belongs on /letters, not the Mail Center queue.
const allUnmailed = buildMailCenter([
  L({ id: "au1", tradelineId: "tlAU", status: "GENERATED", mailedAt: null }),
  L({ id: "au2", tradelineId: "tlAU", status: "GENERATED", mailedAt: null }),
], now);
eq("a package with zero in-mail members doesn't render", allUnmailed.packages.length, 0);

// ---- Rollup honesty: health = LEAST-PROGRESSED member, mailed fraction ------
const rollupCenter = buildMailCenter([
  L({ id: "r1", tradelineId: "tlR", strategy: "fcra_611", round: 1, recipientName: "Equifax", status: "RESOLVED", mailedAt: daysAgo(60), createdAt: daysAgo(65) }),
  L({ id: "r2", tradelineId: "tlR", strategy: "fcra_611", round: 1, recipientName: "Experian", status: "RESOLVED", mailedAt: daysAgo(60), createdAt: daysAgo(65) }),
  L({ id: "r3", tradelineId: "tlR", strategy: "fcra_611", round: 1, recipientName: "TransUnion", status: "MAILED", mailedAt: daysAgo(50), createdAt: daysAgo(65) }),
], now);
const rollupPkg = rollupCenter.packages[0];
eq("rollup health is the LEAST-PROGRESSED member (NEEDS_ATTENTION), never the 2 completed siblings' state", rollupPkg.health, "NEEDS_ATTENTION");
eq("mailedFraction counts all 3 as mailed regardless of the health rollup", rollupPkg.mailedFraction, { done: 3, total: 3 });

// The "2 of 3 mailed" fraction, rendered honestly when letters diverge
// (SIM-REVIEW finding 10) — the still-unmailed sibling is a real member with
// row === null, never silently hidden from the count.
const fractionCenter = buildMailCenter([
  L({ id: "f1", tradelineId: "tlF", strategy: "fcra_611", round: 1, recipientName: "Equifax", status: "MAILED", mailedAt: daysAgo(5), createdAt: daysAgo(6) }),
  L({ id: "f2", tradelineId: "tlF", strategy: "fcra_611", round: 1, recipientName: "Experian", status: "MAILED", mailedAt: daysAgo(5), createdAt: daysAgo(6) }),
  L({ id: "f3", tradelineId: "tlF", strategy: "fcra_611", round: 1, recipientName: "TransUnion", status: "GENERATED", mailedAt: null, createdAt: daysAgo(6) }),
], now);
const fractionPkg = fractionCenter.packages[0];
eq("2 of 3 mailed — the fraction reflects reality, not the 1-member-of-3 that's actually built into a row", fractionPkg.mailedFraction, { done: 2, total: 3 });
ok("the still-unmailed 3rd member is a real member (row=null, mailed=false), never dropped from the package", fractionPkg.members.some((m) => m.recipient === "TransUnion" && m.row === null && m.mailed === false));
eq("exactly 2 members have a built row (the 2 that are in-mail)", fractionPkg.members.filter((m) => m.row !== null).length, 2);

// ---- Evidence drawer truthfulness: no receipt/tracking claim on self-mail ---
const evCenter = buildMailCenter([
  L({ id: "e1", tradelineId: "tlE2", strategy: "fcra_611", round: 1, recipientName: "Equifax", status: "MAILED", mailedAt: daysAgo(5), createdAt: daysAgo(6) }),
], now);
const evPkg = evCenter.packages[0];
ok("send-only evidence (certified receipt, tracking) is ALWAYS unavailable — never fabricated as present", evPkg.evidence.sendOnly.every((e) => e.status === "unavailable"));
ok("send-only rows name exactly certified mail + tracking, honestly labeled", evPkg.evidence.sendOnly.some((e) => /certified/i.test(e.label)) && evPkg.evidence.sendOnly.some((e) => /tracking/i.test(e.label)));
ok("no non-sendOnly evidence item ever claims 'certified' or 'tracking' (no accidental promotion to available)",
  [...evPkg.evidence.letters, ...evPkg.evidence.mailingAttestations, ...evPkg.evidence.responses]
    .every((e) => !/certified|tracking/i.test(e.label) && !/certified|tracking/i.test(e.detail)));
ok("self-mail note appears once a member is mailed, and states the true limitation (no certified-mail receipt)", evPkg.evidence.selfMailNote !== null && /doesn't hold a certified-mail receipt/i.test(evPkg.evidence.selfMailNote!));
eq("exactly one mailing attestation for the one mailed member", evPkg.evidence.mailingAttestations.length, 1);
eq("exactly one letter-evidence row, linking to the existing print route", evPkg.evidence.letters[0].href, "/letters/print/e1");

const evCenterUnmailed = buildMailCenter([
  L({ id: "eu1", tradelineId: "tlEU", strategy: "fcra_611", round: 1, status: "MAILED", mailedAt: daysAgo(5), createdAt: daysAgo(6) }),
], now);
ok("mailingAttestations only lists letters actually marked mailed — never invents one for an unmailed sibling", evCenterUnmailed.packages[0].evidence.mailingAttestations.length === 1);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
