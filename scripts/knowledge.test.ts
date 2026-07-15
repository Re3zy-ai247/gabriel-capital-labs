// Guards for the Knowledge Graph (Sprint XIX). Pure — no DB.
// Run: npx tsx scripts/knowledge.test.ts
import { assembleKnowledge, buildGraph, type GraphRows } from "../lib/knowledge";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

function rows(over: Partial<GraphRows> = {}): GraphRows {
  return {
    hasReport: true,
    tradelines: [{ id: "T1", creditorName: "Midland" }],
    decisions: [{ id: "D1", tradelineId: "T1", strategyId: "validation" }],
    campaigns: [{ id: "C1", sequence: 1, status: "ACTIVE", items: [{ tradelineId: "T1", recipientType: "collector", letterId: "L1", decision: "included" }] }],
    letters: [{ id: "L1", tradelineId: "T1", parentLetterId: null, strategy: "validation", recipientName: "Midland", status: "RESPONSE_RECEIVED", mailedAt: "2026-06-01T00:00:00.000Z", responseAt: "2026-06-20T00:00:00.000Z", responseOutcome: "deleted" }],
    mail: [{ mailId: "mail_L1", letterId: "L1", status: "QUEUED" }],
    outcomes: [{ letterId: "L1", decisionId: "D1", tradelineId: "T1", outcome: "deleted" }],
    ...over,
  };
}

// ---- referential integrity: no edge points to a non-existent node ----
{
  const g = buildGraph(rows());
  const ids = new Set(g.nodes.map((n) => n.id));
  ok("every edge references real nodes (no fabricated relationships)", g.edges.every((e) => ids.has(e.from) && ids.has(e.to)));
  ok("nodes reference canonical ids (prefixed)", ids.has("tl:T1") && ids.has("cmp:C1") && ids.has("ltr:L1") && ids.has("mail:mail_L1") && ids.has("resp:L1") && ids.has("out:L1") && ids.has("dec:D1"));
  ok("OS-layer nodes present", ids.has("mission") && ids.has("roadmap") && ids.has("builder") && ids.has("mortgage_readiness"));
  ok("campaign→letter 'created' edge EXISTS for a present letter (two-pass build)", g.edges.some((e) => e.from === "cmp:C1" && e.to === "ltr:L1" && e.type === "created"));
}

// ---- an "updated" outcome is NOT labeled a favorable/improved change ----
{
  const g = buildGraph(rows({
    letters: [{ id: "L1", tradelineId: "T1", parentLetterId: null, strategy: "fcra_611", recipientName: "Experian", status: "RESPONSE_RECEIVED", mailedAt: "2026-06-01T00:00:00.000Z", responseAt: "2026-06-20T00:00:00.000Z", responseOutcome: "updated" }],
    outcomes: [{ letterId: "L1", decisionId: "D1", tradelineId: "T1", outcome: "updated" }],
  }));
  ok("updated outcome gets NO 'improved' edge (only a removal is favorable)", !g.edges.some((e) => e.type === "improved"));
  ok("updated outcome still links verified_by + resolved (structure intact)", g.edges.some((e) => e.type === "verified_by") && g.edges.some((e) => e.type === "resolved"));
}

// ---- an edge to a missing referenced object is dropped (never invented) ----
{
  // campaign item references letter L9 that doesn't exist → no edge to it
  const g = buildGraph(rows({ campaigns: [{ id: "C1", sequence: 1, status: "ACTIVE", items: [{ tradelineId: "T1", recipientType: "collector", letterId: "L9", decision: "included" }] }] }));
  ok("campaign→missing-letter edge is dropped", !g.edges.some((e) => e.to === "ltr:L9"));
}

// ---- the traceable chain: recommendation → item → campaign → letter → mail → response → outcome → profile ----
{
  const k = assembleKnowledge(rows());
  ok("a journey chain is produced", k.chains.length === 1);
  const types = k.chains[0].steps.map((s) => s.node.type);
  ok("chain traces decision→tradeline→campaign→letter→mail→response→outcome", ["decision", "tradeline", "campaign", "letter", "mail", "response", "outcome"].every((t) => types.includes(t as never)));
  ok("favorable outcome ends at profile (improved)", types[types.length - 1] === "profile");
}

// ---- outcome links back to the decision that started it + improves the profile ----
{
  const g = buildGraph(rows());
  ok("outcome resolves the decision", g.edges.some((e) => e.from === "out:L1" && e.to === "dec:D1" && e.type === "resolved"));
  ok("deleted outcome improves the profile", g.edges.some((e) => e.from === "out:L1" && e.to === "profile" && e.type === "improved"));
  ok("verified outcome is verified_by its letter", g.edges.some((e) => e.from === "out:L1" && e.to === "ltr:L1" && e.type === "verified_by"));
}

// ---- connected reasons cite evidence, no fabrication ----
{
  const k = assembleKnowledge(rows());
  ok("connected reasons produced with evidence", k.reasons.length > 0 && k.reasons.every((r) => r.evidence.length > 0));
  // Affirmative guarantee/approval claims are forbidden; the honest phrase
  // "never a prediction" is allowed (don't match the bare word "prediction").
  const FORBIDDEN = /guarantee|will (increase|be approved|raise)|your score will|approval odds|we predict|is likely to/i;
  ok("no predictive/guaranteed language in reasons", !k.reasons.some((r) => FORBIDDEN.test(r.text)));
}

// ---- empty case: no report → minimal graph, no chains ----
{
  const k = assembleKnowledge(rows({ hasReport: false, tradelines: [], letters: [], campaigns: [], mail: [], outcomes: [], decisions: [] }));
  ok("no records → no chains", k.chains.length === 0);
  ok("OS-layer nodes still present (the platform skeleton)", k.graph.nodes.some((n) => n.id === "mission"));
}

// ---- determinism ----
{
  ok("assembleKnowledge is deterministic", JSON.stringify(assembleKnowledge(rows())) === JSON.stringify(assembleKnowledge(rows())));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
