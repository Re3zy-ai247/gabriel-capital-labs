import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { extractPdfText } from "@/lib/pdf";
import { analyzeResponse } from "@/lib/round2";
import { enforceRateLimit } from "@/lib/rateLimit";
import { encryptText, decryptText } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Logs the bureau/furnisher response to a letter (pasted text or PDF), runs AI
// analysis to assess the outcome + escalation angles, and marks the letter
// RESPONSE_RECEIVED.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This route runs an AI analysis (analyzeResponse) — cap it per user so it can't
  // be spammed for cost/abuse, mirroring the other AI endpoints (letters/generate,
  // strategist, kai). Fails open.
  const limited = await enforceRateLimit(`letters-response:${user.id}`, 20, 3600);
  if (limited) return limited;

  const letter = await prisma.letter.findFirst({ where: { id: params.id, userId: user.id } });
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let responseText = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      responseText = String(form.get("text") || "").trim();
      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        if (f.size > 15 * 1024 * 1024) {
          return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 413 });
        }
        const pdfText = await extractPdfText(Buffer.from(await f.arrayBuffer()));
        if (pdfText.length > responseText.length) responseText = pdfText;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      responseText = String(body.text || "").trim();
    }
  } catch (e) {
    console.error("response parse error", e);
    return NextResponse.json({ error: "Could not read the response." }, { status: 400 });
  }

  if (responseText.length < 15) {
    return NextResponse.json(
      { error: "Paste the bureau's response text (or upload a text-based PDF)." },
      { status: 400 }
    );
  }

  let analysis = null;
  try {
    analysis = await analyzeResponse(decryptText(letter.body), responseText);
  } catch (e) {
    console.error("response analysis failed", e);
  }

  const updated = await prisma.letter.update({
    where: { id: letter.id },
    data: {
      responseText: encryptText(responseText.slice(0, 200_000)),
      responseOutcome: analysis?.outcome ?? "unknown",
      responseAnalysis: analysis ? encryptText(JSON.stringify(analysis)) : null,
      responseAt: new Date(),
      status: "RESPONSE_RECEIVED",
    },
  });

  return NextResponse.json({
    ok: true,
    outcome: updated.responseOutcome,
    analysis,
    needsAI: analysis === null,
  });
}
