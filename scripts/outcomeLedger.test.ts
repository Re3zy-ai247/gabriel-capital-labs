// Guards for the Verified Outcome Ledger pure logic (Sprint XIV). No DB.
// Run: npx tsx scripts/outcomeLedger.test.ts
import { computeOwnTrack, ownTrackLine, ownHistorySummary, toOutcomeRecord, type LedgerRow } from "../lib/outcomeLedger";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return { letterId: "L" + Math.random().toString(36).slice(2, 7), strategy: "fcra_611", recipientType: "bureau", bureau: "EQUIFAX", round: 1, accountType: "CHARGE_OFF", isDebtBuyer: false, outcome: "deleted", latencyDays: 20, ...over };
}

// ---- computeOwnTrack ----
{
  const rows = [
    row({ strategy: "fcra_611", outcome: "deleted", latencyDays: 18 }),
    row({ strategy: "fcra_611", outcome: "updated", latencyDays: 22 }),
    row({ strategy: "fcra_611", outcome: "verified", latencyDays: 30 }),
    row({ strategy: "validation", recipientType: "collector", outcome: "no_response", latencyDays: null }),
  ];
  const t = computeOwnTrack(rows);
  ok("total counts all rows", t.total === 4);
  ok("byStrategy fcra_611 sample 3", t.byStrategy["fcra_611"].sample === 3);
  ok("responded counts deleted/updated/verified", t.byStrategy["fcra_611"].responded === 3);
  ok("favorable = deleted+updated only", t.byStrategy["fcra_611"].favorable === 2);
  ok("favorableRate = 2/3 rounded", t.byStrategy["fcra_611"].favorableRate === 0.67);
  ok("median latency of [18,22,30] = 22", t.byStrategy["fcra_611"].medianLatencyDays === 22);
  ok("byRecipient groups bureau vs collector", !!t.byRecipient["bureau"] && !!t.byRecipient["collector"]);
  ok("no-response has null favorableRate is fine (responded>0)", t.byStrategy["validation"].favorableRate === 0);
}

// ---- ownTrackLine: gated on ≥3 own responses, history-not-prediction framing ----
{
  const thin = computeOwnTrack([row({ strategy: "fcra_611", outcome: "deleted" }), row({ strategy: "fcra_611", outcome: "verified" })]);
  ok("thin own history (2 responses) → no line", ownTrackLine(thin, "fcra_611") === null);
  const enough = computeOwnTrack([
    row({ strategy: "fcra_611", outcome: "deleted" }), row({ strategy: "fcra_611", outcome: "updated" }),
    row({ strategy: "fcra_611", outcome: "verified" }), row({ strategy: "fcra_611", outcome: "deleted" }),
  ]);
  const line = ownTrackLine(enough, "fcra_611");
  ok("≥3 own responses → a line", !!line);
  ok("line is history, not prediction", !!line && /not a prediction/i.test(line) && !/will|guarantee/i.test(line));
  ok("unknown strategy → no line", ownTrackLine(enough, "nope") === null);
}

// ---- ownHistorySummary: aggregate, gated ----
{
  ok("thin aggregate → null", ownHistorySummary(computeOwnTrack([row({ outcome: "deleted" }), row({ outcome: "verified" })])) === null);
  const s = ownHistorySummary(computeOwnTrack([row({ outcome: "deleted" }), row({ outcome: "updated" }), row({ outcome: "verified" })]));
  ok("≥3 aggregate → a summary line", !!s && /2 time/.test(s!) && /not a prediction/i.test(s!));
}

// ---- toOutcomeRecord: strips identity, keeps only the salted contributor key ----
{
  const rec = toOutcomeRecord(row({ strategy: "fcra_611", outcome: "deleted", latencyDays: 21 }), "saltedkey123");
  ok("record carries outcome facts", rec.strategy === "fcra_611" && rec.outcome === "deleted" && rec.latencyDays === 21);
  ok("record has NO userId (identifier stripped)", !("userId" in (rec as unknown as Record<string, unknown>)));
  ok("record carries only the salted userKey", rec.userKey === "saltedkey123");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
