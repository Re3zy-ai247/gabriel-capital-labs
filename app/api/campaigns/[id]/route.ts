import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { campaignService } from "@/lib/campaignInput";
import { CampaignError } from "@/lib/campaign";

export const dynamic = "force-dynamic";

// One campaign — read it, or act on it. Approval freezes the immutable snapshot;
// an expanded (NEEDS_REVIEW) campaign requires an explicit acknowledgment.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = campaignService();
  try {
    const campaign = await svc.get(params.id, user.id);
    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const svc = campaignService();

  try {
    if (body.action === "approve") {
      const campaign = await svc.approve(params.id, user.id, {
        expandedAck: Boolean(body.expandedAck),
        rationale: typeof body.rationale === "string" ? body.rationale.slice(0, 500) : undefined,
      });
      return NextResponse.json({ campaign });
    }
    if (body.action === "cancel") {
      const campaign = await svc.cancel(params.id, user.id, typeof body.reason === "string" ? body.reason.slice(0, 300) : "Canceled by the user.");
      return NextResponse.json({ campaign });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof CampaignError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: "Could not update the campaign." }, { status: 500 });
  }
}
