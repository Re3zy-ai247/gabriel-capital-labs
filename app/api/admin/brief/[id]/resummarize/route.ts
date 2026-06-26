import { NextResponse } from "next/server";
import { requireAdmin, logAudit } from "@/lib/admin";
import { resummarizeArticle } from "@/lib/briefIngest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Re-summarize one existing article from its source (full body + video) — the
// in-place fix for drafts that were created from a thin RSS snippet. Admin-gated +
// audited. Reuses the same compliance-scrubbed summarizer; status is unchanged.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const result = await resummarizeArticle(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "brief.resummarize",
    summary: `Re-summarized Brief article ${params.id} from its source`,
    targetType: "brief_article",
    targetId: params.id,
  });
  return NextResponse.json({ ok: true });
}
