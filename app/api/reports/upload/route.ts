import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { analyzeReportText } from "@/lib/analyze";
import { extractPdfText } from "@/lib/pdf";
import { encryptText } from "@/lib/docCrypto";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { getBureauData, crossBureauConflicts } from "@/lib/bureauData";
import { recommendStrategy } from "@/lib/recommend";

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
  let pdfBuf: Buffer | null = null; // extracted inside the stream so it can be narrated

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
        pdfBuf = Buffer.from(await f.arrayBuffer());
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
  const TOO_SHORT =
    "We couldn't read enough text. If you uploaded a scanned/image PDF, paste the report text instead.";
  // Pasted-only uploads can be validated up front; PDF text length is only
  // known after extraction, which happens (and is narrated) inside the stream.
  if (!pdfBuf && rawText.length < 40) {
    return NextResponse.json({ error: TOO_SHORT }, { status: 400 });
  }

  // Streamed NDJSON: one line per REAL pipeline stage as it begins, then the
  // final result (with the reveal payload) as the last line. No stage is ever
  // emitted for work that isn't actually happening — honest narration only.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        if (pdfBuf) {
          emit({ stage: "extracting" });
          const pdfText = await extractPdfText(pdfBuf);
          if (pdfText.length > rawText.length) rawText = pdfText;
          if (rawText.length < 40) {
            emit({ error: TOO_SHORT });
            controller.close();
            return;
          }
        }

        // Cap once, then store the ciphertext. Keep the plaintext locally for the
        // immediate analysis — report.rawText is encrypted and unusable directly.
        const plainText = rawText.slice(0, 500_000);
        emit({ stage: "received" });
        const report = await prisma.report.create({
          data: {
            userId: user.id,
            fileName,
            bureaus,
            rawText: encryptText(plainText),
          },
        });

        const result = await analyzeReportText(
          prisma,
          { userId: user.id, reportId: report.id, rawText: plainText, coveredBureaus: bureaus },
          (stage) => emit({ stage })
        );

        await recordKaiEvent(user.id, "report.uploaded", {
          refType: "report",
          refId: report.id,
          payload: { fileName, bureaus },
        });
        await recordKaiEvent(user.id, "report.analyzed", {
          refType: "report",
          refId: report.id,
          payload: { tradelines: result.tradelines, usedAI: result.usedAI },
        });

        if (result.tradelines === 0) {
          emit({
            ok: true,
            reportId: report.id,
            tradelines: 0,
            usedAI: result.usedAI,
            warning:
              "We saved the report but couldn't identify any accounts. Make sure you pasted the tradeline/account section of the report.",
          });
          controller.close();
          return;
        }

        // The reveal — computed from the rows just persisted, same engines as
        // every other surface (nothing invented, everything traceable).
        const rows = await prisma.tradeline.findMany({
          where: { reportId: report.id },
          orderBy: { score: "desc" },
        });
        const conflicts = rows.filter((t) => crossBureauConflicts(getBureauData(t.bureauData)).length > 0).length;
        const obsolete = rows.filter((t) => t.reasons.some((r) => r.includes("§605"))).length;
        const high = rows.filter((t) => t.probability === "HIGH").length;
        const medium = rows.filter((t) => t.probability === "MEDIUM").length;
        const top = rows.find((t) => t.probability !== "NOT_RECOMMENDED") ?? null;
        const topRec = top
          ? recommendStrategy({
              accountType: top.accountType,
              isDebtBuyer: top.isDebtBuyer,
              probability: top.probability,
              dateOfFirstDelinquency: top.dateOfFirstDelinquency,
              bureauData: top.bureauData,
              creditorName: top.creditorName,
            })
          : null;

        emit({
          ok: true,
          reportId: report.id,
          tradelines: result.tradelines,
          usedAI: result.usedAI,
          reveal: {
            accounts: result.tradelines,
            bureaus,
            conflicts,
            obsolete,
            high,
            medium,
            top: top && {
              id: top.id,
              creditor: top.creditorName,
              probability: top.probability,
              reason: top.reasons[0] ?? "",
              strategy: topRec?.strategyId ?? null,
              why: topRec?.reason ?? "",
            },
          },
        });
        controller.close();
      } catch (e) {
        console.error("upload analyze error", e);
        emit({ error: "Upload failed during analysis. Please try again." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
