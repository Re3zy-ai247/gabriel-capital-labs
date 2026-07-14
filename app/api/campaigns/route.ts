import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { buildComposerItems, campaignService } from "@/lib/campaignInput";
import { resolveCampaignPolicy, includedItems, packagePages, type ComposerItem } from "@/lib/campaign";

export const dynamic = "force-dynamic";

// Kai Campaign Intelligence API (Sprint XII, ADR-0012).
// GET  → Kai's recommended campaign for the case (transient), the case items the
//        user can customize from, and the user's existing campaigns.
// POST → review a selection (no write) OR create a campaign (recommended / custom
//        focused-split / expanded override). Creation persists the plan; approval
//        (which freezes the snapshot) is a separate PATCH.

function caseProjection(items: ComposerItem[]) {
  return items.map((i) => ({
    tradelineId: i.tradelineId, creditorName: i.creditorName, recipientType: i.recipientType,
    strategyLabel: i.strategyLabel, probability: i.probability, bureaus: i.bureaus,
    disputable: i.strategyId !== null, activeInvestigation: i.activeInvestigation, alreadyInFlight: i.alreadyInFlight,
  }));
}

export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = campaignService();
  const [items, nextSequence, campaigns] = await Promise.all([
    buildComposerItems(user.id),
    svc.nextSequence(user.id),
    svc.list(user.id, 50),
  ]);
  const recommended = svc.compose(items, nextSequence);
  const policy = resolveCampaignPolicy();

  return NextResponse.json({
    recommended: { ...recommended, pages: packagePages({ items: recommended.items }), includedCount: includedItems({ items: recommended.items }).length },
    caseItems: caseProjection(items),
    nextSequence,
    policy: { recommendedMax: policy.recommendedMax, hardCeiling: policy.hardCeiling, warnThreshold: policy.warnThreshold },
    campaigns: campaigns.map((c) => ({
      id: c.id, sequence: c.sequence, status: c.status, strategyFamily: c.strategyFamily,
      rationale: c.rationale, includedCount: includedItems(c).length, createdAt: c.createdAt,
      approvedAt: c.approvedAt, userDecision: c.userDecision,
    })),
  });
}

export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action === "review" ? "review" : "create";
  const svc = campaignService();
  const items = await buildComposerItems(user.id);
  const nextSequence = await svc.nextSequence(user.id);

  const select = (ids: unknown): ComposerItem[] => {
    if (!Array.isArray(ids)) return items;
    const set = new Set(ids.map(String));
    return items.filter((i) => set.has(i.tradelineId));
  };

  if (action === "review") {
    const selected = select(body.tradelineIds);
    return NextResponse.json({ review: svc.review(selected, nextSequence) });
  }

  const mode: "recommended" | "custom" | "expanded" =
    body.mode === "custom" ? "custom" : body.mode === "expanded" ? "expanded" : "recommended";

  let composed;
  if (mode === "recommended") {
    composed = svc.compose(items, nextSequence);
  } else if (mode === "custom") {
    composed = svc.compose(select(body.tradelineIds), nextSequence);
  } else {
    // expanded override — include everything selected up to the ceiling.
    const { composeCampaign } = await import("@/lib/campaign");
    composed = composeCampaign(select(body.tradelineIds), { policy: resolveCampaignPolicy(), nextSequence, expanded: true });
  }

  if (!composed.hasRecommendation) {
    return NextResponse.json({ error: "There's nothing new to include in a campaign right now.", composed }, { status: 422 });
  }

  const userDecision = mode === "recommended" ? "recommended" : mode === "custom" ? "customized" : "expanded";
  const status = mode === "expanded" ? "NEEDS_REVIEW" : "RECOMMENDED";
  const campaign = await svc.createFromCompose(user.id, composed, userDecision, status);
  return NextResponse.json({ campaign });
}
