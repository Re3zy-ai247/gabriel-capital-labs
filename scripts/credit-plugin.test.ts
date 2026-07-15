// Kai Credit — Plugin #1 migration guards (Sprint 2). Proves the kernel-routed capability
// is BYTE-IDENTICAL to the existing engine (zero behavior change) and that it routes through
// the Registry, Capability Resolution, the PEP, and Audit. Pure — no DB, no AI.
// Run: npx tsx scripts/credit-plugin.test.ts
import { buildContext, renderTemplateLetter, type LetterTradeline, type LetterConsumer } from "../lib/letter";
import { analyzeResponse } from "../lib/round2";
import { obsolescenceWindowYears } from "../lib/obsolescence";
import { fallOffInsight } from "../lib/tradelineInsights";
import { composeCampaign, type ComposerItem } from "../lib/campaign";
import { appKernel } from "../lib/os/host/kernel";
import { actorFromSession } from "../lib/os/host/identity";
import { entitlementSnapshot } from "../lib/os/host/entitlements";
import { memoryClock, inMemoryAudit, type CapabilityKey } from "../lib/os/kernel";
import type { BureauData } from "../lib/bureauData";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const DRAFT = "credit.letter.draft" as CapabilityKey;
const consumer: LetterConsumer = { fullName: "Jane Q. Consumer", addressLine1: "1 Main St", city: "Austin", state: "TX", zip: "78701" };
const bk: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 128900, dofd: "2021-03-01" } };
const tradeline: LetterTradeline = { creditorName: "Midland Funding LLC", originalCreditor: "Synchrony Bank", balance: 128900, accountType: "COLLECTION", dateOfFirstDelinquency: "2021-03-01", bureauData: bk };
const input = { strategyId: "fcra_611", tradeline, consumer, targetBureau: "EQUIFAX" as const, round: 1 };

const actor = actorFromSession({ id: "u1" });          // consumer: tenantId = own id
const ent = entitlementSnapshot({ premium: true });

// ---- Registry + Capability Resolution ----
{
  const k = appKernel({ clock: memoryClock() });
  ok("registry: credit module registered → capability available", k.resolve(DRAFT, ent) === "available");
  ok("resolution: unmigrated capability is unavailable (not registered yet)", k.resolve("credit.dispute.escalate" as CapabilityKey, ent) === "unavailable");
}

async function main() {
// ---- BYTE-IDENTICAL equivalence (wrap, don't rewrite) ----
{
  const direct = renderTemplateLetter(tradeline, buildContext("fcra_611", tradeline, consumer, "EQUIFAX", 1), consumer);
  const k = appKernel({ clock: memoryClock() });
  const res = await k.dispatch(actor, DRAFT, input, ent, "dispute");
  ok("dispatch: authorized + ok", res.ok);
  ok("ZERO BEHAVIOR CHANGE: kernel-routed letter === direct engine output (byte-identical)", res.ok && (res.data as { letter: string }).letter === direct);
  ok("receipt cites the strategy (explainable)", /FCRA §611/i.test(res.receipt.summary) || res.receipt.evidence.some((e) => /fcra_611/.test(e)));
}

// ---- Routes through the PEP + Audit ----
{
  const audit = inMemoryAudit();
  const k = appKernel({ clock: memoryClock(), audit });
  await k.dispatch(actor, DRAFT, input, ent, "dispute");
  ok("audit: the draft flowed through the append-only audit log (allow)", audit.entries().some((e) => e.key === DRAFT && e.decision === "allow"));
}

// ---- The PEP actually gates (default-deny) ----
{
  const k = appKernel({ clock: memoryClock() });
  ok("PEP: non-permissible purpose denied", !(await k.dispatch(actor, DRAFT, input, ent, "marketing")).ok);
  const noPerm = { ...ent, grantedPermissions: new Set<string>() };
  ok("PEP: missing permission denied", !(await k.dispatch(actor, DRAFT, input, noPerm, "dispute")).ok);
  const notFlagged = { ...ent, flags: new Map([[DRAFT, false]]) };
  ok("PEP: flagged-off capability denied (coming_soon)", !(await k.dispatch(actor, DRAFT, input, notFlagged, "dispute")).ok);
}

// ---- Response Intelligence (migration #6): async capability, wraps lib/round2 ----
{
  const ANALYZE = "credit.response.analyze" as CapabilityKey;
  const k = appKernel({ clock: memoryClock() });
  ok("response.analyze: premium → available", k.resolve(ANALYZE, ent) === "available");
  ok("response.analyze: gated to premium (free → not_entitled)", k.resolve(ANALYZE, entitlementSnapshot({ premium: false })) === "not_entitled");
  // Equivalence: the kernel-routed capability delegates to lib/round2 — both agree (null → not-ok
  // in this env; no fabrication). Proves the async ABI + wrap without a live AI key.
  const direct = await analyzeResponse("original letter text", "short");
  const res = await k.dispatch(actor, ANALYZE, { originalLetter: "original letter text", responseText: "short" }, ent, "response_analysis");
  ok("response.analyze: delegation matches lib/round2 (async ABI, no fabrication)", (direct === null) === (!res.ok));
}

// ---- Investigation / §605 (migration #7): deterministic, byte-identical ----
{
  const OBS = "credit.obsolescence.window" as CapabilityKey;
  const k = appKernel({ clock: memoryClock() });
  const oInput = { accountType: "COLLECTION" as const, creditorName: "Midland", text: "" };
  const direct = obsolescenceWindowYears(oInput);
  const res = await k.dispatch(actor, OBS, oInput, ent, "obsolescence");
  ok("obsolescence: kernel-routed === lib/obsolescence (byte-identical)", res.ok && (res.data as { years: number }).years === direct);
}

// ---- Document/tradeline §605 fall-off (migration #8): deterministic, byte-identical ----
{
  const INS = "credit.tradeline.insight" as CapabilityKey;
  const k = appKernel({ clock: memoryClock() });
  const iInput = { accountType: "COLLECTION" as const, creditorName: "Midland", bureauData: {}, dateOfFirstDelinquency: "2021-03-01" };
  const direct = fallOffInsight(iInput);
  const res = await k.dispatch(actor, INS, iInput, ent, "obsolescence");
  ok("tradeline.insight: kernel-routed === lib/tradelineInsights (byte-identical)", res.ok && JSON.stringify(res.data) === JSON.stringify(direct));
}

// ---- Workflow / campaign compose (migration #9): deterministic, byte-identical ----
{
  const COMPOSE = "credit.campaign.compose" as CapabilityKey;
  const k = appKernel({ clock: memoryClock() });
  const mk = (over: Partial<ComposerItem>): ComposerItem => ({
    tradelineId: "t1", creditorName: "Midland", accountType: "COLLECTION", isDebtBuyer: true, probability: "HIGH",
    score: 80, recipientType: "bureau", strategyId: "fcra_611", strategyLabel: "FCRA §611", strategyReason: "cross-bureau conflict",
    bureaus: ["EQUIFAX"], pastWindow: false, monthsToFallOff: 12, hasConflicts: true, duplicateGroup: null,
    estimatedPages: 2, activeInvestigation: false, priorRounds: 0, lastOutcome: null, alreadyInFlight: false, ...over,
  });
  const items = [mk({ tradelineId: "t1" }), mk({ tradelineId: "t2", creditorName: "Portfolio Recovery", hasConflicts: false, probability: "MEDIUM", score: 55 })];
  const direct = composeCampaign(items, { nextSequence: 1 });
  const res = await k.dispatch(actor, COMPOSE, { items, nextSequence: 1 }, ent, "campaign");
  ok("campaign.compose: available to all (deterministic → free)", k.resolve(COMPOSE, entitlementSnapshot({ premium: false })) === "available");
  ok("campaign.compose: kernel-routed === lib/campaign (byte-identical)", res.ok && JSON.stringify(res.data) === JSON.stringify(direct));
}

// ---- Marketplace: capabilities are self-describing metadata ----
{
  const m = appKernel({ clock: memoryClock() }).manifest();
  const credit = m.filter((s) => s.plugin === "credit"); // manifest is now multi-plugin (credit + platform notify)
  ok("manifest: all 5 credit capabilities carry marketplace metadata", credit.length === 5 && credit.every((s) => s.description.length > 0 && s.plugin === "credit" && typeof s.premium === "boolean" && s.inputSchema.length > 0 && s.outputSchema.length > 0));
  ok("manifest: premium classification correct (analyze paid, obsolescence free)", m.find((s) => s.key === "credit.response.analyze")!.premium && !m.find((s) => s.key === "credit.obsolescence.window")!.premium);
}
}

main().then(() => {
  console.log(failures === 0 ? "\nAll Kai Credit plugin guards passed." : `\n${failures} guard(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
});
