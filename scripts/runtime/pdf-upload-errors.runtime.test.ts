// Run: npx --no-install tsx scripts/runtime/pdf-upload-errors.runtime.test.ts
// Execute the real upload handler with all storage, authentication and provider I/O mocked.
import type { PdfExtraction } from "../../lib/pdf";
import { check, loadModule, mockModule, mockPackage, run, section } from "./_harness";

type Json = Record<string, unknown>;
const calls: string[] = [];
let extraction: PdfExtraction = { ok: false, reason: "unreadable", text: "" };
let storedText: unknown;
mockPackage("next/server", { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } });
mockModule("lib/session.ts", { currentUserOrDemo: async () => ({ id: "synthetic_guard_subject" }) });
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/pdf.ts", {
  looksLikePdf: (head: Uint8Array) => head.length >= 4 && String.fromCharCode(...head.subarray(0, 4)) === "%PDF",
  extractPdfTextBounded: async () => { calls.push("extract"); return extraction; },
});
mockModule("lib/docCrypto.ts", {
  docCryptoReady: () => true,
  encryptText: (text: string) => { calls.push("encrypt"); return `encrypted:${text.length}`; },
});
mockModule("lib/prisma.ts", { prisma: {
  report: {
    create: async ({ data }: { data: Json }) => { calls.push("create"); storedText = data.rawText; return { id: "synthetic_guard_report" }; },
    delete: async () => { calls.push("delete"); },
  },
  tradeline: { findMany: async () => [] },
} });
mockModule("lib/analyze.ts", { analyzeReportText: async () => { calls.push("analyze"); return { tradelines: 0, usedAI: false }; } });
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => {} });
mockModule("lib/events.ts", { track: async () => {}, PRODUCT_EVENTS: { reportUploaded: "report.uploaded" } });
mockModule("lib/bureauData.ts", { getBureauData: () => ({}), crossBureauConflicts: () => [] });
mockModule("lib/recommend.ts", { recommendStrategy: () => null });
mockModule("lib/aiMeter.ts", {
  assertAiBudgetAvailable: async () => { calls.push("budget"); },
  reportParseEstimateUsd: () => 0.21,
  withAiPrincipal: async (_userId: string, fn: () => Promise<unknown>) => fn(),
  AiSpendRefusal: class extends Error {},
});
const route = loadModule<{ POST: (req: Request) => Promise<Response>; maxDuration: number }>("app/api/reports/upload/route.ts");

function request(opts: { text?: string; signature?: string; fileSize?: number; declaredSize?: number; noBound?: boolean } = {}): Request {
  const bytes = Buffer.from(opts.signature ?? "%PDF-1.3\nordinary mocked input");
  return {
    headers: { get: (name: string) => name === "content-type" ? "multipart/form-data; boundary=guard" : name === "content-length" && !opts.noBound ? String(opts.declaredSize ?? 2048) : null },
    body: null,
    formData: async () => {
      calls.push("form");
      return { get: (name: string) => name === "bureaus" ? "EQUIFAX" : name === "text" ? opts.text ?? "" : name === "file" ? {
        name: "synthetic-guard.pdf", size: opts.fileSize ?? bytes.length,
        slice: (start: number, end: number) => ({ arrayBuffer: async () => Uint8Array.from(bytes.subarray(start, end)).buffer }),
        arrayBuffer: async () => { calls.push("file"); return Uint8Array.from(bytes).buffer; },
      } : null };
    },
  } as unknown as Request;
}
async function upload(result: PdfExtraction, opts: Parameters<typeof request>[0] = {}) {
  calls.length = 0;
  storedText = undefined;
  extraction = result;
  const response = await route.POST(request(opts));
  const lines = (await response.text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Json);
  return { response, lines, error: String(lines.find((line) => line.error)?.error ?? "") };
}
const success: PdfExtraction = { ok: true, text: "SYNTHETIC REPORT ordinary usable extracted text for the mocked pipeline.", declaredPages: 4, renderedPages: 4, truncated: false };

run("pdf-upload-errors.runtime.test.ts", async () => {
  section("unreadable structure is distinct from insufficient extracted text");
  const unreadable = await upload({ ok: false, reason: "unreadable", text: "" });
  check("an unreadable PDF produces exactly one streamed error", unreadable.lines.filter((line) => line.error).length === 1);
  check("the message identifies reader compatibility", unreadable.error.includes("document structure isn't compatible"));
  check("the message acknowledges other apps may open the file", unreadable.error.includes("may still open normally in other apps"));
  check("the message offers another copy or pasted text", unreadable.error.includes("another copy") && unreadable.error.includes("paste the report text"));
  check("the message does not claim scanning, corruption or expose parser internals", !/scanned|corrupt|XRef|PDF\.js|pdf-parse|stack|1\.10/.test(unreadable.error));
  check("unreadable input reaches no storage or provider work", !calls.some((call) => ["encrypt", "create", "budget", "analyze"].includes(call)));
  const withText = await upload({ ok: false, reason: "unreadable", text: "" }, { text: success.text });
  check("supplemental pasted text does not hide the unreadable PDF", withText.error === unreadable.error && !calls.includes("create"));

  const short = await upload({ ok: true, text: "", declaredPages: 1, renderedPages: 1, truncated: false });
  check("a readable PDF with too little text keeps scanned-image guidance", short.error === "We couldn't read enough text. If you uploaded a scanned/image PDF, paste the report text instead.");
  check("insufficient text and unreadable structure have different messages", short.error !== unreadable.error);
  check("insufficient text also cannot create a report", !calls.includes("create") && !calls.includes("analyze"));
  const timeout = await upload({ ok: false, reason: "timeout", text: "" });
  check("timeout keeps its existing specific guidance", timeout.error.includes("took too long to read"));
  const notPdf = await upload({ ok: false, reason: "not-pdf", text: "" });
  check("not-pdf keeps its existing specific guidance", notPdf.error.includes("That file isn't a PDF"));

  section("usable extraction still precedes encryption, storage and analysis");
  const good = await upload(success);
  check("the success control actually completes", good.lines.at(-1)?.ok === true);
  check("storage receives only the encryption result", storedText === `encrypted:${success.text.length}`);
  check("extraction precedes encryption and persistence", calls.indexOf("extract") < calls.indexOf("encrypt") && calls.indexOf("encrypt") < calls.indexOf("create"));
  check("analysis runs after successful persistence", calls.indexOf("create") < calls.indexOf("analyze"));
  const partial = await upload({ ...success, renderedPages: 2, truncated: true });
  check("partial extraction keeps its truthful page-count notice", partial.lines.some((line) => typeof line.note === "string" && line.note.includes("4 pages") && line.note.includes("first 2")));

  section("unchanged size, signature and request bounds using small doubles");
  const bodyLimit = await upload(success, { declaredSize: 16 * 1024 * 1024 + 1 });
  check("the body cap refuses before form buffering", bodyLimit.response.status === 413 && !calls.includes("form"));
  const fileLimit = await upload(success, { fileSize: 15 * 1024 * 1024 + 1 });
  check("the 15 MB file cap refuses before the full file read", fileLimit.response.status === 413 && !calls.includes("file"));
  const atLimit = await upload(success, { fileSize: 15 * 1024 * 1024 });
  check("the exact advertised file limit remains allowed", atLimit.lines.at(-1)?.ok === true);
  const signature = await upload(success, { signature: "ordinary non-PDF text" });
  check("magic-byte refusal occurs before full read or extraction", signature.response.status === 415 && !calls.includes("file") && !calls.includes("extract"));
  const noBound = await upload(success, { noBound: true });
  check("a request with no measurable body fails closed", noBound.response.status === 413 && !calls.includes("form"));
  check("production maxDuration remains 60", route.maxDuration === 60);
});
