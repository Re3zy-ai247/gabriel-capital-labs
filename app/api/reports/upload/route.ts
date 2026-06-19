import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { analyzeReportText } from "@/lib/analyze";
import { extractPdfText } from "@/lib/pdf";
import { encryptText } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Give the analysis pipeline (PDF extraction + AI) headroom beyond the 10s default.
export const maxDuration = 60;

const VALID_BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

// Accepts a pasted report (text) and/or an uploaded PDF, plus the set of bureaus
// the report covers. Extracts text, runs the shared analysis pipeline (AI
// extraction with regex fallback), and persists the report + tradelines.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rawText = "";
  let fileName = "pasted-report.txt";
  let bureaus: Bureau[] = [];

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      rawText = String(form.get("text") || "").trim();
      const bureauRaw = String(form.get("bureaus") || "");
      bureaus = bureauRaw.split(",").map((b) => b.trim().toUpperCase()).filter((b): b is Bureau =>
        VALID_BUREAUS.includes(b as Bureau)
      );

      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        if (f.size > 15 * 1024 * 1024) {
          return NextResponse.json({ error: "PDF too large (max 15 MB)." }, { status: 413 });
        }
        fileName = f.name || "uploaded-report.pdf";
        const buf = Buffer.from(await f.arrayBuffer());
        const pdfText = await extractPdfText(buf);
        if (pdfText.length > rawText.length) rawText = pdfText;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      rawText = String(body.text || "").trim();
      bureaus = (Array.isArray(body.bureaus) ? body.bureaus : [])
        .map((b: string) => String(b).toUpperCase())
        .filter((b: string): b is Bureau => VALID_BUREAUS.includes(b as Bureau));
    }
  } catch (e) {
    console.error("upload parse error", e);
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  if (!bureaus.length) {
    return NextResponse.json(
      { error: "Select at least one bureau this report covers." },
      { status: 400 }
    );
  }
  if (rawText.length < 40) {
    return NextResponse.json(
      {
        error:
          "We couldn't read enough text. If you uploaded a scanned/image PDF, paste the report text instead.",
      },
      { status: 400 }
    );
  }

  try {
    // Cap once, then store the ciphertext. Keep the plaintext locally for the
    // immediate analysis — report.rawText is now encrypted and unusable directly.
    const plainText = rawText.slice(0, 500_000);
    const report = await prisma.report.create({
      data: {
        userId: user.id,
        fileName,
        bureaus,
        rawText: encryptText(plainText),
      },
    });

    const result = await analyzeReportText(prisma, {
      userId: user.id,
      reportId: report.id,
      rawText: plainText,
      coveredBureaus: bureaus,
    });

    if (result.tradelines === 0) {
      return NextResponse.json({
        ok: true,
        reportId: report.id,
        tradelines: 0,
        usedAI: result.usedAI,
        warning:
          "We saved the report but couldn't identify any accounts. Make sure you pasted the tradeline/account section of the report.",
      });
    }

    return NextResponse.json({
      ok: true,
      reportId: report.id,
      tradelines: result.tradelines,
      usedAI: result.usedAI,
    });
  } catch (e) {
    console.error("upload analyze error", e);
    return NextResponse.json(
      {
        error: "Upload failed during analysis. Please try again.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
