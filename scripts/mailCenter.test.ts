// Guards for the Mail Center projection (Sprint IX). Pure, deterministic — no DB,
// no AI. Run: npx tsx scripts/mailCenter.test.ts
import { buildMailCenter, mailHealth, type MailLetter } from "../lib/mailCenter";

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
    hasResponse: false, responseOutcome: null, ...over,
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

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
