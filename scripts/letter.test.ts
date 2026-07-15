// Guards for Letter Intelligence (Sprint XXI). Pure — no DB, no AI.
// Verifies the deterministic template is recipient-differentiated (a collector is
// never asked for a §611 reinvestigation, a bureau is never asked to "validate"),
// stays compliance-safe, and honors the cross-bureau + round-escalation rules.
// Run: npx tsx scripts/letter.test.ts
import { buildContext, renderTemplateLetter, buildSystemPrompt, type LetterTradeline, type LetterConsumer } from "../lib/letter";
import { applyCompliance } from "../lib/compliance";
import type { BureauData } from "../lib/bureauData";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const consumer: LetterConsumer = { fullName: "Jane Q. Consumer", addressLine1: "1 Main St", city: "Austin", state: "TX", zip: "78701" };
const bk: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 128900, dofd: "2021-03-01" } };
const tl: LetterTradeline = { creditorName: "Midland Funding LLC", originalCreditor: "Synchrony Bank", balance: 128900, accountType: "COLLECTION", dateOfFirstDelinquency: "2021-03-01", bureauData: bk };

function gen(strategyId: string, round = 1, addr = true) {
  const ctx = buildContext(strategyId, tl, consumer, strategyId === "fcra_611" || strategyId === "fcra_623" ? "EQUIFAX" : undefined, round, addr ? { name: tl.creditorName, address: "PO Box 1\nSan Diego, CA 92193" } : undefined);
  return renderTemplateLetter(tl, ctx, consumer);
}

// ---- BUREAU (§611) ----
{
  const L = gen("fcra_611");
  ok("bureau: REINVESTIGATION demand", /REQUESTED ACTION — REINVESTIGATION/.test(L));
  ok("bureau: 30-day §611 deadline", /reinvestigation within 30 days/i.test(L) && /§611/.test(L));
  ok("bureau: demands method of verification (§611(a)(7))", /method of verification/i.test(L) && /611\(a\)\(7\)/.test(L));
  ok("bureau: does NOT ask to validate a debt", !/VALIDATION OF DEBT/.test(L) && !/§1692g/.test(L));
}

// ---- COLLECTOR (validation / FDCPA) — the corrected framing ----
{
  const L = gen("validation");
  ok("collector: VALIDATION demand", /REQUESTED ACTION — VALIDATION OF DEBT/.test(L));
  ok("collector: §1692g + chain of title + cease collection", /§1692g|1692g/.test(L) && /chain of title/i.test(L) && /cease collection/i.test(L));
  ok("collector: NEVER a §611 reinvestigation-in-30-days demand (the bug)", !/reinvestigation within 30 days/i.test(L) && !/REQUESTED ACTION — REINVESTIGATION/.test(L));
  ok("collector: does not acknowledge the debt", /waives any defense|acknowledges the debt/i.test(L));
  ok("collector: timeliness hedged, never asserted as fact", /to the extent it is timely/i.test(L) && !/this is a timely, written dispute/i.test(L));
}

// ---- FURNISHER (§623) ----
{
  const L = gen("fcra_623");
  ok("furnisher: §1681s-2(b) own investigation demand", /REQUESTED ACTION — FURNISHER INVESTIGATION/.test(L) && /1681s-2\(b\)/.test(L));
  ok("furnisher: demands account-level records (original agreement)", /original signed agreement/i.test(L));
  ok("furnisher: NOT a §611 30-day reinvestigation, NOT validation", !/reinvestigation within 30 days/i.test(L) && !/VALIDATION OF DEBT/.test(L));
}

// ---- Non-dispute strategies (goodwill / cease&desist / pay-for-delete) ----
{
  const g = gen("goodwill");
  ok("goodwill: courtesy only, no legal demand", /under no obligation/i.test(g) && !/REQUESTED ACTION — REINVESTIGATION/.test(g) && !/STATUTORY AUTHORITY/.test(g));
  ok("goodwill: coherent — no accuracy-challenge findings, no reinvestigation ask", !/SUMMARY OF FACTUAL CONCERNS/.test(g) && !/reasonable reinvestigation/i.test(g));
  const cd = gen("cease_desist");
  ok("cease_desist: §1692c(c) cease-communication + no admission", /1692c\(c\)/.test(cd) && /cease further communication/i.test(cd) && /does not acknowledge the debt/i.test(cd));
  ok("cease_desist: no incongruent validation/reinvestigation demand", !/cease collection until you have mailed the validation/i.test(cd) && !/SUMMARY OF FACTUAL CONCERNS/.test(cd));
  const pd = gen("pay_delete");
  ok("pay_delete: written-agreement-before-payment, no guarantee", /in writing BEFORE any payment/i.test(pd) && !/guarantee/i.test(pd));
  ok("pay_delete: settlement framing, no validation-dispute closing", /settlement offer/i.test(pd) && !/cease collection until you have mailed the validation/i.test(pd) && !/SUMMARY OF FACTUAL CONCERNS/.test(pd));
}

// ---- Compliance safety: the deterministic template is already clean for EVERY strategy ----
{
  const strategies = ["fcra_611", "fcra_609", "validation", "metro2", "fcra_605", "fcra_623", "fdcpa", "escalation", "goodwill", "pay_delete", "cease_desist", "cfpb_threat"];
  let clean = true, promissory = false;
  for (const s of strategies) {
    const L = gen(s);
    if (applyCompliance(L).flags.length > 0) clean = false;
    if (/\bwill be deleted\b|\bmust be deleted\b|\bguarantee\b|\b100% removal\b/i.test(L)) promissory = true;
  }
  ok("compliance: no strategy trips the scrubber (0 flags)", clean);
  ok("compliance: no promissory/guaranteed-deletion language anywhere", !promissory);
}

// ---- Cross-bureau discipline: single-bureau data → no other-bureau claims ----
{
  const L = gen("fcra_611");
  ok("single-bureau: solely-this-file disclaimer present", /relate solely to how this account is reported on my/i.test(L));
  ok("single-bureau: no reference to a non-target bureau", !/TransUnion|Experian/i.test(L));
}

// ---- Round escalation ladder ----
{
  const r4 = gen("fcra_611", 4);
  ok("round 4: regulatory record framing (CFPB + state AG)", /Consumer Financial Protection Bureau/.test(r4) && /Attorney General/.test(r4));
}

// ---- System prompt encodes the recipient-specific discipline ----
{
  const sys = buildSystemPrompt(1);
  ok("system prompt: recipient-specific demands rule present", /RECIPIENT-SPECIFIC DEMANDS/.test(sys) && /never ask a bureau to 'validate'/i.test(sys));
}

console.log(failures === 0 ? "\nAll letter-intelligence guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
