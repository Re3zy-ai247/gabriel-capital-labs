// Guards for Letter Intelligence (Sprint XXI). Pure — no DB, no AI.
// Verifies the deterministic template is recipient-differentiated (a collector is
// never asked for a §611 reinvestigation, a bureau is never asked to "validate"),
// stays compliance-safe, and honors the cross-bureau + round-escalation rules.
// Run: npx tsx scripts/letter.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildContext, renderTemplateLetter, buildSystemPrompt,
  resolveSenderPlaceholders, detectPlaceholders, planLetterRegeneration,
  type LetterTradeline, type LetterConsumer,
} from "../lib/letter";
import { applyCompliance } from "../lib/compliance";
import type { BureauData } from "../lib/bureauData";
import type { Bureau } from "@prisma/client";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

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

// ---- Phase 1A-R RB-4: placeholder detection + render-time sender resolution ----
{
  const emptyConsumer: LetterConsumer = {};
  const bureauCtx = buildContext("fcra_611", tl, emptyConsumer, "EQUIFAX", 1, undefined);
  const bodyWithPlaceholders = renderTemplateLetter(tl, bureauCtx, emptyConsumer);

  const before = detectPlaceholders(bodyWithPlaceholders);
  ok("RB-4: raw body has sender placeholders when the profile is empty", before.senderIncomplete);
  ok("RB-4: a bureau letter has no recipient placeholder (bureau addresses are always known)", !before.recipientIncomplete);
  ok("RB-4: hasPlaceholder is the OR of both", before.hasPlaceholder === (before.senderIncomplete || before.recipientIncomplete));

  const filled: LetterConsumer = { fullName: "Jane Q. Consumer", addressLine1: "1 Main St", city: "Austin", state: "TX", zip: "78701" };
  const rendered = resolveSenderPlaceholders(bodyWithPlaceholders, filled);
  const after = detectPlaceholders(rendered);
  ok("RB-4: render-time substitution replaces [YOUR FULL NAME]", rendered.includes("Jane Q. Consumer") && !rendered.includes("[YOUR FULL NAME]"));
  ok("RB-4: render-time substitution replaces [YOUR ADDRESS]", rendered.includes("1 Main St") && !rendered.includes("[YOUR ADDRESS]"));
  ok("RB-4: render-time substitution replaces [CITY, STATE ZIP]", rendered.includes("Austin, TX 78701") && !rendered.includes("[CITY, STATE ZIP]"));
  ok("RB-4: detectPlaceholders is clean once fully resolved", !after.hasPlaceholder);
  ok("RB-4: resolveSenderPlaceholders does not mutate its input (stored body stays frozen)", bodyWithPlaceholders.includes("[YOUR FULL NAME]"));

  const partial: LetterConsumer = { fullName: "Jane Q. Consumer" }; // name only — address/city still blank
  const partialRendered = resolveSenderPlaceholders(bodyWithPlaceholders, partial);
  const partialStatus = detectPlaceholders(partialRendered);
  ok("RB-4: a partial profile still flags incomplete (not all-or-nothing)", partialStatus.senderIncomplete);
  ok("RB-4: ...but substitutes whatever it does have", partialRendered.includes("Jane Q. Consumer") && partialRendered.includes("[YOUR ADDRESS]"));

  // Furnisher letter with no recipient override → the recipient placeholder has
  // no live source, so it must survive sender resolution untouched.
  const furnisherCtx = buildContext("fcra_623", tl, filled, undefined, 1, undefined);
  const furnisherBody = renderTemplateLetter(tl, furnisherCtx, filled);
  const furnisherStatus = detectPlaceholders(resolveSenderPlaceholders(furnisherBody, filled));
  ok("RB-4: a complete sender profile clears the sender flag even on a furnisher letter", !furnisherStatus.senderIncomplete);
  ok("RB-4: the furnisher placeholder persists after sender resolution — no live source to auto-resolve it", furnisherStatus.recipientIncomplete);

  // A fully clean letter (complete profile + a real recipient address) → no warning.
  const cleanCtx = buildContext("fcra_623", tl, filled, undefined, 1, { name: "Midland Funding LLC", address: "PO Box 1\nSan Diego, CA 92193" });
  const cleanBody = renderTemplateLetter(tl, cleanCtx, filled);
  const cleanStatus = detectPlaceholders(resolveSenderPlaceholders(cleanBody, filled));
  ok("RB-4: a fully-complete letter trips no placeholder warning", !cleanStatus.hasPlaceholder);
}

// ---- Phase 1A-R RB-6: idempotent-regenerate matching (pure, DB-free) ----------
{
  const targets: (Bureau | undefined)[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];
  const candidates = [
    { id: "L1", targetBureau: "EQUIFAX" as Bureau, mailedAt: null },
    { id: "L2", targetBureau: "EXPERIAN" as Bureau, mailedAt: new Date("2026-07-01") },
  ];
  const plan = planLetterRegeneration(targets, candidates);
  ok("RB-6: an unmailed EQUIFAX letter on file → matched for UPDATE, not insert", plan.toUpdate.some((u) => u.target === "EQUIFAX" && u.existingId === "L1"));
  ok("RB-6: EQUIFAX is not ALSO queued to create (no duplicate row)", !plan.toCreate.includes("EQUIFAX"));
  ok("RB-6: a MAILED letter (EXPERIAN) is never update-matched — mailed rows are frozen mail records", !plan.toUpdate.some((u) => u.target === "EXPERIAN"));
  ok("RB-6: ...so it falls through to create instead of being silently dropped (existing behavior pinned; the real 'next round' path is /round2, untouched here)", plan.toCreate.includes("EXPERIAN"));
  ok("RB-6: TRANSUNION has no existing row on file → create", plan.toCreate.includes("TRANSUNION"));
  ok("RB-6: exactly one update total", plan.toUpdate.length === 1);
  ok("RB-6: exactly two creates total (the mailed target's replacement + the brand-new one)", plan.toCreate.length === 2);

  // Furnisher/collector shape: a single, bureau-less target (undefined).
  const soloTargets: (Bureau | undefined)[] = [undefined];
  const soloUnmailed = planLetterRegeneration(soloTargets, [{ id: "L3", targetBureau: null, mailedAt: null }]);
  ok("RB-6: an unmailed furnisher/collector letter → matched for update", soloUnmailed.toUpdate.length === 1 && soloUnmailed.toUpdate[0].existingId === "L3");
  ok("RB-6: ...and nothing queued to create", soloUnmailed.toCreate.length === 0);

  const soloNone = planLetterRegeneration(soloTargets, []);
  ok("RB-6: no existing furnisher/collector letter on file → create, nothing to update", soloNone.toCreate.length === 1 && soloNone.toUpdate.length === 0);

  const soloMailed = planLetterRegeneration(soloTargets, [{ id: "L4", targetBureau: null, mailedAt: new Date("2026-07-01") }]);
  ok("RB-6: a mailed furnisher/collector letter is never matched — falls through to create", soloMailed.toCreate.length === 1 && soloMailed.toUpdate.length === 0);

  // A second, later-created unmailed row for the same bureau (shouldn't happen
  // once this fix ships, but the matcher must still behave deterministically
  // if it ever does): first match wins, stably.
  const dup = planLetterRegeneration(["EQUIFAX"], [
    { id: "older", targetBureau: "EQUIFAX" as Bureau, mailedAt: null },
    { id: "newer", targetBureau: "EQUIFAX" as Bureau, mailedAt: null },
  ]);
  ok("RB-6: with duplicate unmailed candidates, exactly one update is planned (deterministic, no double-update)", dup.toUpdate.length === 1);
}

// ---- Opus follow-up FIX-B (records integrity) — static: a MAILED letter's
// print view renders VERBATIM and never shows the placeholder banner. The
// print page is a Server Component (prisma + next/headers), so this pins the
// exact code shape rather than DB-driving it — same static-source pattern as
// scripts/mail-download.test.ts's own checks on this very file.
{
  const PRINT_PAGE_SRC = read("app/letters/print/[id]/page.tsx");
  ok(
    "FIX-B: renderedBody is verbatim letter.body when mailed, substituted only when not (letter.mailedAt ? letter.body : resolveSenderPlaceholders(...))",
    /renderedBody = letter\.mailedAt \? letter\.body : resolveSenderPlaceholders\(/.test(PRINT_PAGE_SRC)
  );
  ok(
    "FIX-B: the placeholder banner is gated on !letter.mailedAt (never shown for an already-mailed record)",
    /\{!letter\.mailedAt && placeholders\.hasPlaceholder && \(/.test(PRINT_PAGE_SRC)
  );
}

console.log(failures === 0 ? "\nAll letter-intelligence guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
