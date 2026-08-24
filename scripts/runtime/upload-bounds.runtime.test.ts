// Run: npx --no-install tsx scripts/runtime/upload-bounds.runtime.test.ts
//
// P1-20 (E-05) — the report upload route must refuse an oversized or
// non-PDF upload BEFORE it buffers the bytes and BEFORE pdf.js sees them.
//
// THE DEFECT (app/api/reports/upload/route.ts on a72a47c):
//   · `:39` `await req.formData()` buffered the whole body first; the 15 MB cap
//     at `:49` was checked afterwards, on an object already in memory;
//   · `:46-53` accepted ANY File and handed its raw bytes to pdf-parse. No MIME
//     allowlist, no extension check, no magic-byte sniff — while the repo already
//     contained the correct implementation at `lib/attachments.ts:66-99`.
//
// This guard executes the REAL POST handler with its I/O boundaries faked, and
// asserts on what the handler DID: which status it returned, and — the part a
// source-level guard cannot see — whether it touched the body at all.
//
// The Request and FormData here are deliberately duck-typed rather than real
// platform objects. `content-length` is a forbidden header on a constructed
// Request, a 20 MB File cannot be allocated cheaply, and neither real object can
// tell us whether `formData()` or `arrayBuffer()` was ever CALLED. The handler
// only ever uses `req.headers.get`, `req.formData`, `req.json` and
// `form.get`, so the doubles implement exactly that.
//
// Offline. No database, no network, no keys.
import { check, loadModule, mockModule, requireActual, run, section } from "./_harness";

// Keep every PDF parse in this guard trivial; lib/pdf.ts's own bounds are proven
// in scripts/pdf-upload-bounds.test.ts.
process.env.PDF_MAX_PAGES = "3";

type Json = Record<string, unknown>;

// ── a PDF that pdf.js will really parse ──────────────────────────────────────
function buildPdf(pageCount: number): Buffer {
  const objects: string[] = [];
  const kids = Array.from({ length: pageCount }, () => "3 0 R").join(" ");
  const streamText = "BT /F1 12 Tf 72 720 Td (CAPITAL ONE 1234 CHARGE OFF BALANCE 500 REPORTED) Tj ET";
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Count ${pageCount} /Kids [ ${kids} ] >>`);
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
  );
  objects.push(`<< /Length ${streamText.length} >>\nstream\n${streamText}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const REAL_PDF = buildPdf(9_000);
const NOT_A_PDF = Buffer.from(
  "<!DOCTYPE html><script>fetch('/api/documents')</script>" + "x".repeat(600),
  "latin1"
);


// ── real streamed Requests (M-5) ─────────────────────────────────────────────
// A `Request` built from a ReadableStream carries NO content-length — exactly the
// chunked / HTTP-2 shape that used to skip the pre-buffer gate entirely. These
// are genuine platform objects, not doubles, so they exercise the real
// pipeThrough/duplex path the route now depends on.
const BOUNDARY = "----guard-boundary";
function multipartParts(fileBytes: Buffer, padBytes: number): Uint8Array[] {
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="bureaus"\r\n\r\nEQUIFAX\r\n` +
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="report.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${BOUNDARY}--\r\n`);
  const chunks: Uint8Array[] = [head, new Uint8Array(fileBytes)];
  if (padBytes > 0) {
    const block = new Uint8Array(256 * 1024).fill(0x20);
    for (let sent = 0; sent < padBytes; sent += block.byteLength) chunks.push(block);
  }
  chunks.push(tail);
  return chunks;
}

/** Streamed multipart Request plus a counter of bytes the SOURCE actually produced. */
function streamedRequest(fileBytes: Buffer, padBytes: number) {
  const chunks = multipartParts(fileBytes, padBytes);
  const produced = { bytes: 0 };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    // Pull-based on purpose: if the route abandons the stream, generation stops,
    // and `produced.bytes` records how far it got.
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      const chunk = chunks[i++];
      produced.bytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  const req = new Request("http://localhost/api/reports/upload", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    body,
    duplex: "half",
  } as RequestInit);
  return { req, produced };
}

// ── doubles ──────────────────────────────────────────────────────────────────
const calls: string[] = [];

function fakeFile(bytes: Buffer, size = bytes.length, name = "report.pdf") {
  return {
    name,
    size,
    // Blob.slice is SYNCHRONOUS and returns a Blob — matching that exactly is
    // what makes this double's "only the head was read" evidence meaningful.
    slice(from: number, to: number) {
      calls.push("file.slice");
      const part = bytes.subarray(from, to);
      return {
        arrayBuffer: async () =>
          part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength),
      };
    },
    async arrayBuffer() {
      calls.push("file.arrayBuffer");
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

// `contentLength` defaults to a normal declared size, because that is what a real
// browser sends for a FormData body. Pass an explicit value to exercise the gate;
// the no-header shape is covered by the streamed Requests above, which are real.
function fakeRequest(opts: { contentLength?: string; file?: unknown; text?: string; bureaus?: string }) {
  const headers = new Map<string, string>([
    ["content-type", "multipart/form-data; boundary=----guard"],
    ["content-length", "2048"],
  ]);
  if (opts.contentLength !== undefined) headers.set("content-length", opts.contentLength);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    async formData() {
      calls.push("req.formData");
      return {
        get(key: string) {
          if (key === "text") return opts.text ?? "";
          if (key === "bureaus") return opts.bureaus ?? "EQUIFAX";
          if (key === "file") return opts.file ?? null;
          return null;
        },
      };
    },
    async json() {
      calls.push("req.json");
      return {};
    },
  } as unknown as Request;
}

/** Read the NDJSON body the handler streams back. */
async function ndjson(res: Response): Promise<Json[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Json);
}

const realPdf = requireActual<typeof import("../../lib/pdf")>("lib/pdf.ts");

mockModule("lib/pdf.ts", {
  looksLikePdf: (head: Uint8Array) => {
    calls.push("looksLikePdf");
    return realPdf.looksLikePdf(head);
  },
  extractPdfTextBounded: async (buf: Buffer) => {
    calls.push("extractPdfTextBounded");
    return realPdf.extractPdfTextBounded(buf);
  },
});
mockModule("lib/session.ts", {
  currentUserOrDemo: async () => ({ id: "user_1", email: "consumer@example.test" }),
});
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/prisma.ts", {
  prisma: {
    report: {
      create: async ({ data }: { data: Json }) => {
        calls.push("report.create");
        return { id: "report_1", ...data };
      },
      delete: async () => {
        calls.push("report.delete");
        return {};
      },
    },
    tradeline: { findMany: async () => [] },
  },
});
// The upload route now refuses before reading the body when encryption is
// unusable (S11 · MEDIUM_BLOCKING-1). These bounds cases are about SIZE, so the
// double reports encryption as ready; the encryption gate itself is proven in
// scripts/runtime/encryption-readiness.runtime.test.ts against the real predicate.
mockModule("lib/docCrypto.ts", {
  docCryptoReady: () => true,
  encryptText: (t: string) => `cv1:${t.length}`,
});
mockModule("lib/analyze.ts", {
  analyzeReportText: async (
    _prisma: unknown,
    _opts: unknown,
    onStage?: (s: string) => void
  ) => {
    calls.push("analyzeReportText");
    onStage?.("reading");
    return { tradelines: 0, usedAI: false };
  },
});
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => {} });
mockModule("lib/events.ts", { track: async () => {}, PRODUCT_EVENTS: { reportUploaded: "report.uploaded" } });
mockModule("lib/bureauData.ts", { getBureauData: () => ({}), crossBureauConflicts: () => [] });
mockModule("lib/recommend.ts", { recommendStrategy: () => null });
mockModule("lib/aiMeter.ts", {
  withAiPrincipal: async (userId: string, fn: () => Promise<unknown>) => {
    calls.push(`withAiPrincipal:${userId}`);
    return fn();
  },
  // S11 · NEW-1: the upload now pre-flights the spend ceilings so a refused AI
  // read can be disclosed. These guards are about bounds and readiness, so the
  // double reports budget available; the refusal path itself is proven in
  // scripts/runtime/ai-spend-control.runtime.test.ts against the real meter.
  assertAiBudgetAvailable: async () => {},
  AiSpendRefusal: class AiSpendRefusal extends Error {},
});

const route = loadModule<{ POST: (req: Request) => Promise<Response>; maxDuration: number }>(
  "app/api/reports/upload/route.ts"
);

run("upload-bounds.runtime.test.ts", async () => {
  section("declared body size is refused BEFORE the body is read");
  calls.length = 0;
  const tooBig = await route.POST(fakeRequest({ contentLength: String(64 * 1024 * 1024) }));
  check("an oversized declared body is refused 413", tooBig.status === 413);
  check(
    "the refusal happens without buffering: req.formData() was never called",
    !calls.includes("req.formData")
  );
  const tooBigBody = (await tooBig.json()) as Json;
  check(
    "the message states the real limit rather than blaming the consumer",
    typeof tooBigBody.error === "string" && (tooBigBody.error as string).includes("15 MB")
  );

  section("a body inside the cap is still read normally");
  calls.length = 0;
  const okSize = await route.POST(
    fakeRequest({ contentLength: "2048", file: fakeFile(REAL_PDF), bureaus: "EQUIFAX" })
  );
  check("a normal declared size does NOT trip the pre-buffer gate", calls.includes("req.formData"));
  check("and the request is served (streamed NDJSON)", okSize.status === 200);
  await okSize.text();

  section("a file over the per-file cap is refused before its bytes are read");
  calls.length = 0;
  const bigFile = await route.POST(
    fakeRequest({ file: fakeFile(REAL_PDF, 20 * 1024 * 1024), bureaus: "EQUIFAX" })
  );
  check("a 20 MB file is refused 413", bigFile.status === 413);
  check(
    "its bytes are never pulled into memory: file.arrayBuffer() was never called",
    !calls.includes("file.arrayBuffer")
  );

  section("magic bytes, not the client-declared type");
  calls.length = 0;
  const html = await route.POST(fakeRequest({ file: fakeFile(NOT_A_PDF), bureaus: "EQUIFAX" }));
  check("an HTML payload named report.pdf is refused 415", html.status === 415);
  check("the signature check really ran", calls.includes("looksLikePdf"));
  check(
    "only the first bytes were read — the full file was never buffered",
    calls.includes("file.slice") && !calls.includes("file.arrayBuffer")
  );
  check("pdf.js never saw it", !calls.includes("extractPdfTextBounded"));
  check("nothing was persisted for a rejected upload", !calls.includes("report.create"));

  section("control: a real PDF still goes all the way through");
  calls.length = 0;
  const good = await route.POST(fakeRequest({ file: fakeFile(REAL_PDF), bureaus: "EQUIFAX,EXPERIAN" }));
  check("a genuine PDF is accepted", good.status === 200);
  const lines = await ndjson(good);
  check("the signature check passed it through to extraction", calls.includes("extractPdfTextBounded"));
  check("the report was persisted", calls.includes("report.create"));
  check("the analysis ran", calls.includes("analyzeReportText"));
  check(
    "the pipeline ran inside this consumer's AI-spend principal (P0-10)",
    calls.includes("withAiPrincipal:user_1")
  );
  check(
    "the stream ends with a result, not an error",
    lines.length > 0 && lines[lines.length - 1].ok === true
  );

  section("a long PDF is reported as partially read, never as complete");
  const truncationNote = lines.find(
    (l) => typeof l.note === "string" && (l.note as string).includes("I read the first")
  );
  check(
    "the consumer is told when the page cap stopped the read early",
    truncationNote !== undefined && (truncationNote.note as string).includes("9000 pages")
  );

  section("M-5: a body with NO content-length is still bounded");
  const normal = streamedRequest(REAL_PDF, 0);
  check("a streamed Request really carries no content-length", normal.req.headers.get("content-length") === null);
  calls.length = 0;
  const chunkedOk = await route.POST(normal.req);
  check("a normal chunked upload is still accepted", chunkedOk.status === 200);
  const chunkedLines = await ndjson(chunkedOk);
  check(
    "and it completes end to end (the metered re-wrap does not break parsing)",
    chunkedLines.length > 0 && chunkedLines[chunkedLines.length - 1].ok === true
  );

  // 40 MB of padding behind a 16 MB cap, produced lazily.
  const huge = streamedRequest(REAL_PDF, 40 * 1024 * 1024);
  calls.length = 0;
  const chunkedTooBig = await route.POST(huge.req);
  check("an oversized chunked upload is refused 413, not parsed", chunkedTooBig.status === 413);
  const chunkedBody = (await chunkedTooBig.json()) as Json;
  check(
    "it is reported as a size refusal, not as an unreadable upload",
    typeof chunkedBody.error === "string" && (chunkedBody.error as string).includes("15 MB")
  );
  check(
    `the transfer was abandoned mid-stream (${Math.round(huge.produced.bytes / 1024 / 1024)} MB produced of 40 MB offered)`,
    huge.produced.bytes < 20 * 1024 * 1024
  );
  check("nothing was persisted for the refused chunked upload", !calls.includes("report.create"));
  check("pdf.js never saw the refused chunked upload", !calls.includes("extractPdfTextBounded"));

  section("M-5: a shape we cannot bound at all fails closed");
  const unboundable = {
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "multipart/form-data; boundary=x" : null) },
    body: null,
    formData: async () => {
      calls.push("req.formData");
      return { get: () => null };
    },
  } as unknown as Request;
  calls.length = 0;
  const refusedShape = await route.POST(unboundable);
  check("no declared length and no readable body is refused 413", refusedShape.status === 413);
  check("and the body was never handed to the parser", !calls.includes("req.formData"));

  section("route configuration");
  check("the route still declares maxDuration = 60", route.maxDuration === 60);
});
