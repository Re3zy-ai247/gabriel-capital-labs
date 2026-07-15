// Kai Credit — Plugin #1 migration guards (Sprint 2). Proves the kernel-routed capability
// is BYTE-IDENTICAL to the existing engine (zero behavior change) and that it routes through
// the Registry, Capability Resolution, the PEP, and Audit. Pure — no DB, no AI.
// Run: npx tsx scripts/credit-plugin.test.ts
import { buildContext, renderTemplateLetter, type LetterTradeline, type LetterConsumer } from "../lib/letter";
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

// ---- BYTE-IDENTICAL equivalence (wrap, don't rewrite) ----
{
  // Direct call to the existing engine.
  const direct = renderTemplateLetter(tradeline, buildContext("fcra_611", tradeline, consumer, "EQUIFAX", 1), consumer);
  // Same call, routed through the Kai Kernel.
  const k = appKernel({ clock: memoryClock() });
  const res = k.dispatch(actor, DRAFT, input, ent, "dispute");
  ok("dispatch: authorized + ok", res.ok);
  ok("ZERO BEHAVIOR CHANGE: kernel-routed letter === direct engine output (byte-identical)", res.ok && (res.data as { letter: string }).letter === direct);
  ok("receipt cites the strategy (explainable)", /FCRA §611/i.test(res.receipt.summary) || res.receipt.evidence.some((e) => /fcra_611/.test(e)));
}

// ---- Routes through the PEP + Audit ----
{
  const audit = inMemoryAudit();
  const k = appKernel({ clock: memoryClock(), audit });
  k.dispatch(actor, DRAFT, input, ent, "dispute");
  ok("audit: the draft flowed through the append-only audit log (allow)", audit.entries().some((e) => e.key === DRAFT && e.decision === "allow"));
}

// ---- The PEP actually gates (default-deny) ----
{
  const k = appKernel({ clock: memoryClock() });
  ok("PEP: non-permissible purpose denied", !k.dispatch(actor, DRAFT, input, ent, "marketing").ok);
  const noPerm = { ...ent, grantedPermissions: new Set<string>() };
  ok("PEP: missing permission denied", !k.dispatch(actor, DRAFT, input, noPerm, "dispute").ok);
  const notFlagged = { ...ent, flags: new Map([[DRAFT, false]]) };
  ok("PEP: flagged-off capability denied (coming_soon)", !k.dispatch(actor, DRAFT, input, notFlagged, "dispute").ok);
}

console.log(failures === 0 ? "\nAll Kai Credit plugin guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
