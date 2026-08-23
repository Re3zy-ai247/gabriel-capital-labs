import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { analyzeReportText } from "@/lib/analyze";
import { extractPdfTextBounded, looksLikePdf } from "@/lib/pdf";
import { encryptText } from "@/lib/docCrypto";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import { getBureauData, crossBureauConflicts } from "@/lib/bureauData";
import { recommendStrategy } from "@/lib/recommend";
import { withAiPrincipal } from "@/lib/aiMeter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Give the analysis pipeline (PDF extraction + AI) headroom beyond the 10s default.
export const maxDuration = 60;

const VALID_BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

// P1-20 (E-05). The 15 MB cap is the number the consumer is told, and it is the
// per-FILE cap. The body carries multipart framing and the pasted-text field on
// top of it, so the pre-buffer gate allows 1 MB of slack — a real 15 MB PDF must
// not be refused by the gate that exists to refuse a 500 MB one.
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES + 1024 * 1024;
const TOO_LARGE = "PDF too large (max 15 MB).";
// Sniffed against the leading bytes, never against the client-supplied
// `file.type` (see lib/pdf.ts looksLikePdf / lib/attachments.ts:66-99).
const NOT_A_PDF =
  "That file isn't a PDF. Upload the PDF your bureau gave you, or paste the report text instead.";

// A body-size bound that holds whether or not the client declares one (M-5).
//
// The first version of this gate only read `content-length` and, because
// `Number.isFinite(NaN)` is false, let anything WITHOUT that header straight
// through to `req.formData()` — which buffers the whole body before the per-file
// `f.size` check can run. A chunked or HTTP/2 request that omits the header
// therefore reproduced the original E-05 defect verbatim ("the size cap is
// enforced after the bytes are already in memory"). A declared length is also
// only a claim; nothing forces the body to match it.
//
// So: trust the header only to REFUSE early, never to admit. When no trustworthy
// length is present, the body is piped through a counter that errors the stream
// past the cap, so parsing aborts mid-transfer instead of after it.
type BoundedBody =
  | { ok: true; req: Request; exceeded: { value: boolean } }
  | { ok: false };

function boundBodySize(req: Request): BoundedBody {
  const declared = Number.parseInt(req.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared)) {
    // Cheapest possible refusal: no allocation, no read of the body at all.
    if (declared > MAX_BODY_BYTES) return { ok: false };
    return { ok: true, req, exceeded: { value: false } };
  }

  const source = req.body;
  // A multipart POST with neither a declared length nor a readable body is not a
  // shape we can bound. Fail closed rather than hand it to the parser.
  if (!source) return { ok: false };

  const exceeded = { value: false };
  let seen = 0;
  const metered = source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > MAX_BODY_BYTES) {
          exceeded.value = true;
          controller.error(new Error("upload body exceeded the size cap"));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );
  const bounded = new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: metered,
    // Required by undici for a streaming request body.
    duplex: "half",
  } as RequestInit);
  return { ok: true, req: bounded, exceeded };
}

// Accepts a pasted report (text) and/or an uploaded PDF, plus the set of bureaus
// the report covers. Extracts text, runs the shared analysis pipeline (AI
// extraction with regex fallback), and persists the report + tradelines.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`report-upload:${user.id}`, 20, 3600); // paid AI extraction — abuse/cost guard
  if (limited) return limited;

  const bounded = boundBodySize(req);
  if (!bounded.ok) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  let rawText = "";
  let fileName = "pasted-report.txt";
  let bureaus: Bureau[] = [];
  let pdfBuf: Buffer | null = null; // extracted inside the stream so it can be narrated

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await bounded.req.formData();
      rawText = String(form.get("text") || "").trim();
      const bureauRaw = String(form.get("bureaus") || "");
      bureaus = bureauRaw.split(",").map((b) => b.trim().toUpperCase()).filter((b): b is Bureau =>
        VALID_BUREAUS.includes(b as Bureau)
      );

      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        if (f.size > MAX_FILE_BYTES) {
          return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
        }
        // Signature check on the first bytes only — refuses a mislabelled or
        // hostile payload before the whole file is read into memory and before
        // pdf.js ever sees it.
        const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
        if (!looksLikePdf(head)) {
          return NextResponse.json({ error: NOT_A_PDF }, { status: 415 });
        }
        fileName = f.name || "uploaded-report.pdf";
        pdfBuf = Buffer.from(await f.arrayBuffer());
      }
    } else {
      const body = await bounded.req.json().catch(() => ({}));
      rawText = String(body.text || "").trim();
      bureaus = (Array.isArray(body.bureaus) ? body.bureaus : [])
        .map((b: string) => String(b).toUpperCase())
        .filter((b: string): b is Bureau => VALID_BUREAUS.includes(b as Bureau));
    }
  } catch (e) {
    // The metered stream aborts the parse mid-transfer when the body outruns the
    // cap. Report that as the size refusal it is, not as an unreadable upload.
    if (bounded.exceeded.value) {
      return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
    }
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
      // Track persistence so failure messages tell the truth: a pre-analysis
      // failure deletes the orphaned report (cascade unwinds partial tradelines)
      // so "try again" can't create duplicates; a post-analysis failure keeps
      // the completed work and says where to find it.
      let report: { id: string } | null = null;
      let analyzed = false;
      try {
        if (pdfBuf) {
          emit({ stage: "extracting" });
          // Bounded: signature, page cap and wall-clock deadline (lib/pdf.ts).
          // A page bomb now costs milliseconds instead of a paid minute.
          const extraction = await extractPdfTextBounded(pdfBuf);
          if (!extraction.ok && extraction.reason === "timeout") {
            emit({
              error:
                "That PDF took too long to read, so I stopped rather than leave you waiting. Paste the report text instead and I'll read it right away.",
            });
            controller.close();
            return;
          }
          if (!extraction.ok && extraction.reason === "not-pdf") {
            emit({ error: NOT_A_PDF });
            controller.close();
            return;
          }
          const pdfText = extraction.ok ? extraction.text : "";
          if (pdfText.length > rawText.length) rawText = pdfText;
          if (rawText.length < 40) {
            emit({ error: TOO_SHORT });
            controller.close();
            return;
          }
          // Say so when the cap stopped us early — never present a partial read
          // as a complete one.
          if (extraction.ok && extraction.truncated) {
            emit({
              stage: "extracting",
              note: `This PDF is unusually long (${extraction.declaredPages} pages). I read the first ${extraction.renderedPages}; anything after that isn't included.`,
            });
          }
        }

        // Cap once, then store the ciphertext. Keep the plaintext locally for the
        // immediate analysis — report.rawText is encrypted and unusable directly.
        const plainText = rawText.slice(0, 500_000);
        emit({ stage: "received" });
        report = await prisma.report.create({
          data: {
            userId: user.id,
            fileName,
            bureaus,
            rawText: encryptText(plainText),
          },
        });

        // Attribute every nested model call to this consumer so the daily AI
        // budget sees report parsing (lib/aiParse.ts calls the meter with
        // userId: null). A refusal is caught inside analyzeReportText, which
        // falls back to the deterministic parser — no spend, still a result.
        const reportId = report.id;
        const result = await withAiPrincipal(user.id, () =>
          analyzeReportText(
            prisma,
            { userId: user.id, reportId, rawText: plainText, coveredBureaus: bureaus },
            (stage) => emit({ stage })
          )
        );
        analyzed = true;

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
        await track(PRODUCT_EVENTS.reportUploaded, { userId: user.id, meta: { bureaus: bureaus.length, tradelines: result.tradelines } });

        if (result.tradelines === 0) {
          emit({
            ok: true,
            reportId: report.id,
            tradelines: 0,
            usedAI: result.usedAI,
            warning:
              "Your report is saved — I just couldn't identify individual accounts in the text that came through. Try again with the part of the report that lists your accounts; if the PDF is scanned, paste that section as text and I'll read it.",
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
        // Only recommend what the engine actually endorses — a LOW row must
        // never wear a "worth pursuing" pill it didn't earn.
        const top = rows.find((t) => t.probability === "HIGH" || t.probability === "MEDIUM") ?? null;
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
            accounts: rows.length,
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
        if (report && !analyzed) {
          // Unwind the orphan so a retry is genuinely a clean retry.
          await prisma.report.delete({ where: { id: report.id } }).catch(() => {});
          emit({ error: "The analysis hit a snag on our side — nothing about your report or your credit caused this. Give it another try in a moment." });
        } else if (report) {
          emit({ error: "Your report was saved and analyzed, but I couldn't load the summary. It's waiting under 'Your uploaded reports' on this page." });
        } else {
          emit({ error: "The analysis hit a snag on our side — nothing about your report or your credit caused this. Give it another try in a moment." });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
