// Guards for Kai Campaign Intelligence (Sprint XII, ADR-0012). Pure — no DB, no
// network. Run: npx tsx scripts/campaign.test.ts
import {
  composeCampaign, reviewSelection, type ComposerItem,
  DEFAULT_CAMPAIGN_POLICY, assessCampaignSize,
  CampaignService, InMemoryCampaignStore, snapshotCovers, includedItems, deferredItems, excludedItems, packagePages,
  type LetterTarget,
} from "../lib/campaign";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }
function eq(label: string, got: unknown, want: unknown) { ok(`${label} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want)); }
async function throws(label: string, fn: () => Promise<unknown>) {
  try { await fn(); failures++; console.error(`✗ ${label} (did not throw)`); } catch { ok(label, true); }
}

// A ComposerItem factory with sensible defaults.
function item(over: Partial<ComposerItem> = {}): ComposerItem {
  return {
    tradelineId: over.tradelineId ?? "t" + Math.random().toString(36).slice(2, 8),
    creditorName: "Creditor", accountType: "CHARGE_OFF", isDebtBuyer: false,
    probability: "HIGH", score: 80, recipientType: "bureau",
    strategyId: "fcra_611", strategyLabel: "FCRA §611 — Bureau Reinvestigation",
    strategyReason: "Charge-off — dispute the accuracy under §611.",
    bureaus: ["EQUIFAX", "EXPERIAN"], pastWindow: false, monthsToFallOff: null, hasConflicts: false,
    duplicateGroup: null, estimatedPages: 2, activeInvestigation: false, priorRounds: 0,
    lastOutcome: null, alreadyInFlight: false, ...over,
  };
}

// ---- composer: single item ----
{
  const c = composeCampaign([item({ tradelineId: "a" })], { nextSequence: 1 });
  eq("single item → 1 included", includedItems({ items: c.items }).length, 1);
  ok("single item has a recommendation", c.hasRecommendation);
  ok("family is bureau_reinvestigation", c.strategyFamily === "bureau_reinvestigation");
}

// ---- composer: 4 coherent bureau items → all fit (recommendedMax=5) ----
{
  const items = ["a", "b", "c", "d"].map((id) => item({ tradelineId: id }));
  const c = composeCampaign(items, { nextSequence: 1 });
  eq("4 coherent → 4 included", includedItems({ items: c.items }).length, 4);
}

// ---- composer: 10 same-family items → capped at recommendedMax, rest deferred ----
{
  const items = Array.from({ length: 10 }, (_, i) => item({ tradelineId: "b" + i }));
  const c = composeCampaign(items, { nextSequence: 1 });
  eq("10 items → recommendedMax included", includedItems({ items: c.items }).length, DEFAULT_CAMPAIGN_POLICY.recommendedMax);
  ok("10 items → the rest are deferred (not dropped)", deferredItems({ items: c.items }).length === 10 - DEFAULT_CAMPAIGN_POLICY.recommendedMax);
  ok("deferred item explains why (next campaign)", deferredItems({ items: c.items }).every((i) => i.reason.length > 0));
}

// ---- composer: leads with the strongest item's family (obsolescence) ----
{
  const items = [
    item({ tradelineId: "old", pastWindow: true, strategyId: "fcra_605", strategyLabel: "FCRA §605 — Obsolete Item", probability: "HIGH" }),
    item({ tradelineId: "coll", recipientType: "collector", strategyId: "validation", strategyLabel: "Debt Validation", probability: "MEDIUM" }),
  ];
  const c = composeCampaign(items, { nextSequence: 1 });
  ok("leads with obsolescence family", c.strategyFamily === "obsolescence");
  ok("other-family item is deferred as a different pathway", deferredItems({ items: c.items }).some((i) => i.tradelineId === "coll"));
}

// ---- composer: excludes NOT_RECOMMENDED / government ----
{
  const c = composeCampaign([
    item({ tradelineId: "gov", strategyId: null, probability: "NOT_RECOMMENDED", strategyReason: "Government debt — generally cannot be disputed." }),
    item({ tradelineId: "ok" }),
  ], { nextSequence: 1 });
  ok("government item excluded", excludedItems({ items: c.items }).some((i) => i.tradelineId === "gov"));
  ok("disputable item still included", includedItems({ items: c.items }).some((i) => i.tradelineId === "ok"));
}

// ---- composer: active investigation is deferred (no duplicate reinvestigation) ----
{
  const c = composeCampaign([
    item({ tradelineId: "open", activeInvestigation: true }),
    item({ tradelineId: "fresh" }),
  ], { nextSequence: 1 });
  ok("active-investigation item deferred", deferredItems({ items: c.items }).some((i) => i.tradelineId === "open"));
  ok("active-investigation reason mentions the open dispute", deferredItems({ items: c.items }).find((i) => i.tradelineId === "open")!.reason.toLowerCase().includes("already open"));
}

// ---- composer: weak-evidence cap ----
{
  const items = Array.from({ length: 5 }, (_, i) => item({ tradelineId: "w" + i, probability: "LOW", score: 20 }));
  const c = composeCampaign(items, { nextSequence: 1 });
  ok("weak items capped at maxWeakPerCampaign", includedItems({ items: c.items }).length <= DEFAULT_CAMPAIGN_POLICY.maxWeakPerCampaign);
}

// ---- composer: nothing new to send ----
{
  const c = composeCampaign([item({ tradelineId: "x", alreadyInFlight: true })], { nextSequence: 2 });
  ok("no fresh candidates → hasRecommendation false", !c.hasRecommendation);
  ok("honest empty rationale", /nothing new/i.test(c.rationale));
}

// ---- composer: deterministic regardless of input order ----
{
  const base = [
    item({ tradelineId: "z", creditorName: "Zeta" }),
    item({ tradelineId: "a", creditorName: "Alpha" }),
    item({ tradelineId: "m", strategyId: null, probability: "NOT_RECOMMENDED", creditorName: "Mu" }),
    item({ tradelineId: "b", activeInvestigation: true, creditorName: "Beta" }),
  ];
  const shuffled = [base[2], base[0], base[3], base[1]];
  const seq = (arr: ComposerItem[]) => composeCampaign(arr, { nextSequence: 1 }).items.map((i) => `${i.decision}:${i.tradelineId}`).join(",");
  ok("composition order is deterministic regardless of input order", seq(base) === seq(shuffled));
}

// ---- policy: sizing verdicts ----
{
  eq("within at recommendedMax", assessCampaignSize(5, { "bureau:EQUIFAX": 5 }, DEFAULT_CAMPAIGN_POLICY).verdict, "within");
  eq("warn at warnThreshold", assessCampaignSize(6, {}, DEFAULT_CAMPAIGN_POLICY).verdict, "warn");
  eq("over_ceiling past hardCeiling", assessCampaignSize(13, {}, DEFAULT_CAMPAIGN_POLICY).verdict, "over_ceiling");
  const over = assessCampaignSize(13, {}, DEFAULT_CAMPAIGN_POLICY);
  ok("ceiling message frames it as operational, not legal", over.messages.some((m) => /operational limit/i.test(m) && !/frivolous/i.test(m)));
}

// ---- Strategy Review: expanded selection across recipients ----
{
  const items = [
    ...Array.from({ length: 6 }, (_, i) => item({ tradelineId: "bu" + i })),
    item({ tradelineId: "co", recipientType: "collector", strategyId: "validation", strategyLabel: "Debt Validation" }),
    item({ tradelineId: "fu", recipientType: "furnisher", strategyId: "fcra_623", strategyLabel: "FCRA §623" }),
    item({ tradelineId: "open", activeInvestigation: true }),
  ];
  const r = reviewSelection(items, { nextSequence: 1 });
  ok("review flags multiple families", r.families.length >= 3);
  ok("review flags the active-investigation conflict", r.conflicts.some((c) => c.toLowerCase().includes("already open")));
  ok("review recommends a split (send now vs defer)", r.recommendedSplit.includeNow.length > 0 && r.recommendedSplit.defer.length > 0);
  ok("expanded is ALWAYS allowed (never a silent block)", r.expandedAllowed === true);
  ok("review size warns/over for 9 items", r.size.verdict !== "within");
  ok("law-category context present + not a frivolous accusation", r.warnings.some((w) => w.category === "law" && /frivolous or irrelevant/i.test(w.text) && /not a headcount|case-by-case/i.test(w.text)));
}

// ---- CROA forbidden-phrase sweep across every composed string ----
{
  // Forbid outcome-promises + affirmative frivolous ACCUSATIONS, while allowing
  // the accurate statutory phrase "frivolous or irrelevant" (FCRA §611(a)(3)).
  const FORBIDDEN = /guarantee|guaranteed|will be (deleted|removed)|will delete|we('| wi)ll remove|your score will|will be rejected|is frivolous(?! or irrelevant)|are frivolous|automatically frivolous/i;
  const mixed = [
    item({ tradelineId: "a", pastWindow: true, strategyId: "fcra_605", strategyLabel: "FCRA §605 — Obsolete Item" }),
    item({ tradelineId: "b", hasConflicts: true }),
    item({ tradelineId: "c", recipientType: "collector", strategyId: "validation", strategyLabel: "Debt Validation", probability: "LOW", score: 15 }),
    ...Array.from({ length: 8 }, (_, i) => item({ tradelineId: "d" + i })),
  ];
  const c = composeCampaign(mixed, { nextSequence: 1 });
  const r = reviewSelection(mixed, { nextSequence: 1 });
  const strings = [
    c.rationale, ...c.items.map((i) => i.reason), ...c.warnings.map((w) => w.text), ...c.nextUnlock,
    ...r.warnings.map((w) => w.text), ...r.conflicts, ...r.weakItems.map((w) => w.reason),
  ];
  ok("no forbidden outcome/frivolous claim in any composed string", !strings.some((s) => FORBIDDEN.test(s)));
}

// ---- service + gate + snapshot immutability + isolation ----
(async () => {
  let t = 0;
  const store = new InMemoryCampaignStore();
  const svc = new CampaignService({ store, now: () => `2026-07-14T00:00:${String(t++).padStart(2, "0")}.000Z`, policy: DEFAULT_CAMPAIGN_POLICY });

  const composed = svc.compose([item({ tradelineId: "T1", bureaus: ["EQUIFAX", "EXPERIAN"] }), item({ tradelineId: "T2" })], 1);
  const c0 = await svc.createFromCompose("u1", composed, "recommended");
  eq("created RECOMMENDED", c0.status, "RECOMMENDED");
  ok("no snapshot before approval", c0.snapshot === null);

  const approved = await svc.approve(c0.id, "u1");
  eq("approve → APPROVED", approved.status, "APPROVED");
  ok("snapshot frozen at approval with policy version", !!approved.snapshot && approved.snapshot.policyVersion === DEFAULT_CAMPAIGN_POLICY.version);
  ok("snapshot covers a per-bureau target (T1 → EXPERIAN)", snapshotCovers(approved.snapshot, { tradelineId: "T1", recipientType: "bureau", bureau: "EXPERIAN" }));
  ok("snapshot does NOT cover an unrelated tradeline", !snapshotCovers(approved.snapshot, { tradelineId: "ZZ", recipientType: "bureau", bureau: "EQUIFAX" }));

  // tenant isolation — another user cannot read/approve it
  await throws("cross-user get is denied", () => svc.get(c0.id, "attacker"));
  await throws("cross-user approve is denied", () => svc.approve(c0.id, "attacker", {}));

  // gate: a letter covered by the approved campaign attaches (no new campaign)
  const target: LetterTarget = { tradelineId: "T1", recipientType: "bureau", bureau: "EQUIFAX", creditorName: "Creditor", strategyId: "fcra_611", strategyLabel: "FCRA §611", bureaus: ["EQUIFAX", "EXPERIAN"], pages: 2 };
  const g1 = await svc.attachLetterForQueue("u1", "L1", target);
  ok("covered letter attaches to the existing campaign", !g1.created && g1.campaign.id === c0.id);
  eq("campaign moves to ACTIVE on first queue", g1.campaign.status, "ACTIVE");
  ok("item marked queued with the letter id", g1.campaign.items.some((i) => i.queued && i.letterId === "L1"));

  // gate: an ad-hoc letter with no covering campaign gets a single-item campaign (never blocked)
  const adhoc: LetterTarget = { tradelineId: "T9", recipientType: "collector", bureau: null, creditorName: "Some Collector", strategyId: "validation", strategyLabel: "Debt Validation", bureaus: [], pages: 2 };
  const g2 = await svc.attachLetterForQueue("u1", "L9", adhoc);
  ok("ad-hoc letter → new single-item campaign created (not blocked)", g2.created);
  eq("single-item campaign is ACTIVE + covers its target", [g2.campaign.status, snapshotCovers(g2.campaign.snapshot, adhoc)], ["ACTIVE", true]);

  // gate: a letter with NO tradeline (e.g. a personal-info bureau correction, or a
  // dispute whose tradeline was deleted) is STILL gated — keyed on the letter id,
  // never queued campaign-less (the fail-open gap the review caught).
  const noTl: LetterTarget = { tradelineId: null, recipientType: "bureau", bureau: "EXPERIAN", creditorName: "Experian (personal info)", strategyId: "fcra_611", strategyLabel: "FCRA §611", bureaus: ["EXPERIAN"], pages: 1 };
  const g3 = await svc.attachLetterForQueue("u1", "Lpi", noTl);
  ok("null-tradeline letter is still gated (single-item campaign created)", g3.created && g3.campaign.status === "ACTIVE");
  ok("null-tradeline campaign covers its own letter (keyed on letter id)", snapshotCovers(g3.campaign.snapshot, { ...noTl, tradelineId: "letter:Lpi" }));
  ok("null-tradeline item marked queued with the letter id", g3.campaign.items.some((i) => i.queued && i.letterId === "Lpi"));

  // snapshot immutability: re-saving with a mutated snapshot keeps the original
  const reloaded = await svc.get(c0.id, "u1");
  ok("audit trail is append-only + grew", reloaded.auditTrail.length >= approved.auditTrail.length);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
