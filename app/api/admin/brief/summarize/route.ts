import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { summarizeArticle } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Opus call

// Admin-assist: summarize pasted article text into a compliant draft suggestion the
// admin then reviews/edits before saving. Does NOT create or publish anything.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const limited = await enforceRateLimit(`brief-ai:${admin.id}`, 40, 3600);
  if (limited) return limited;

  const raw = await req.json().catch(() => ({}));
  const title = typeof raw.title === "string" ? raw.title : "";
  const sourceText = typeof raw.sourceText === "string" ? raw.sourceText : "";
  if (!sourceText.trim()) return NextResponse.json({ error: "Paste the article text to summarize." }, { status: 400 });

  const suggestion = await summarizeArticle({ title, sourceText });
  if (!suggestion.usedAI) {
    return NextResponse.json({ error: "The AI summarizer is unavailable right now." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, suggestion });
}
