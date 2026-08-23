// Server-side PDF text extraction. Imports pdf-parse's lib entry directly to
// avoid the package's index.js debug self-test (which reads a bundled test file
// and breaks in serverless bundles). Returns extracted text, or "" on failure.
//
// P1-20 (E-05/E-06): parsing used to be unbounded — `pdf(buffer)` with no page
// cap, no deadline and no signature check. `pdf-parse/lib/pdf-parse.js:81-94`
// loops `doc.numPages` times, calling `getTextContent()` per page, and its own
// per-page `.catch()` swallows failures rather than stopping. A 120 KB file that
// declares 20 000 pages (one shared page object, 20 000 `/Kids` entries) is far
// under the 15 MB upload cap and takes ~30 s of CPU to render — a full paid
// serverless minute per hostile upload, 20 uploads/hour/user.
//
// Three bounds close that, cheapest first:
//   1. signature — a buffer that does not start with "%PDF" never reaches pdf.js;
//   2. page cap  — `max` stops the render loop (pdf-parse.js:81), so a declared
//      page count cannot drive the work;
//   3. deadline  — a wall-clock budget, enforced both inside the page loop (the
//      pagerender hook returns "" once the budget is spent, so remaining pages
//      cost no text extraction) and as an outer race, so a hang inside
//      `getDocument()` still returns control to the caller.
// The outer race bounds the time the CALLER waits; it cannot cancel CPU already
// running inside pdf.js. That is the honest limit of this design without moving
// parsing to a worker thread — but the caller (and its serverless response) is
// no longer held hostage by it.

/** Hard ceiling on the page cap, so a mis-set env var cannot re-open the hole. */
const PAGE_CAP_MAX = 2_000;
/** Hard ceiling on the parse deadline. Every PDF caller runs under maxDuration 60. */
const TIMEOUT_CAP_MS = 45_000;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(n, max);
}

/**
 * Pages actually rendered. Default 250 — an order of magnitude above any real
 * tri-merge consumer report, two orders below a page bomb. `PDF_MAX_PAGES`.
 */
export function pdfPageCap(): number {
  return envInt("PDF_MAX_PAGES", 250, 1, PAGE_CAP_MAX);
}

/** Wall-clock budget for one extraction. Default 20 s. `PDF_PARSE_TIMEOUT_MS`. */
export function pdfTimeoutMs(): number {
  return envInt("PDF_PARSE_TIMEOUT_MS", 20_000, 100, TIMEOUT_CAP_MS);
}

/**
 * True when the leading bytes are the PDF signature. Same shape as the repo's
 * existing, correct magic-byte check (`lib/attachments.ts:66-99` `magicMatches`,
 * "%PDF" branch) — replicated rather than imported so the report path does not
 * pull in the attachment size/count policy, which is a different limit set.
 * The declared `file.type` is client-controlled and is never trusted here.
 */
export function looksLikePdf(head: Uint8Array | Buffer): boolean {
  return head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
}

export type PdfExtraction =
  | {
      ok: true;
      text: string;
      /** Pages the document DECLARES (untrusted — a bomb declares 20 000). */
      declaredPages: number;
      /** Pages actually rendered (<= the cap). */
      renderedPages: number;
      /** True when the page cap or the deadline stopped extraction early. */
      truncated: boolean;
    }
  | { ok: false; reason: "not-pdf" | "timeout" | "unreadable"; text: "" };

/**
 * Bounded extraction. Never throws. Callers that only need the text can keep
 * using extractPdfText().
 */
export async function extractPdfTextBounded(buffer: Buffer): Promise<PdfExtraction> {
  if (!looksLikePdf(buffer)) return { ok: false, reason: "not-pdf", text: "" };

  const deadlineMs = pdfTimeoutMs();
  const maxPages = pdfPageCap();
  const deadline = Date.now() + deadlineMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Set by the pagerender hook when the deadline is hit mid-document, so a
  // partial result is still reported as partial rather than as complete.
  let deadlineHit = false;

  try {
    const mod: any = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = mod.default || mod;

    // pdf-parse calls this once per page and swallows a throw (returning ""), so
    // the cheapest way to stop doing work is to return "" ourselves: no
    // getTextContent(), no glyph decoding, for every page past the deadline.
    const pagerender = (pageData: any): Promise<string> => {
      if (Date.now() > deadline) {
        deadlineHit = true;
        return Promise.resolve("");
      }
      return pageData
        .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        .then((content: any) => {
          let lastY: number | undefined;
          let text = "";
          for (const item of content.items) {
            text += lastY === item.transform[5] || lastY === undefined ? item.str : "\n" + item.str;
            lastY = item.transform[5];
          }
          return text;
        });
    };

    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), deadlineMs);
    });
    const parsed = await Promise.race([pdf(buffer, { max: maxPages, pagerender }), timeout]);
    if (parsed === "timeout") return { ok: false, reason: "timeout", text: "" };

    const data = parsed as any;
    const declaredPages = Number(data?.numpages) || 0;
    const renderedPages = Number(data?.numrender) || 0;
    return {
      ok: true,
      text: (data?.text || "").trim(),
      declaredPages,
      renderedPages,
      truncated: deadlineHit || (declaredPages > 0 && renderedPages < declaredPages),
    };
  } catch (e) {
    console.error("pdf extraction failed:", e);
    return { ok: false, reason: "unreadable", text: "" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Text-only wrapper. Signature unchanged, so every existing caller
 * (`app/api/letters/[id]/response/route.ts`, `lib/briefIngest.ts`) inherits the
 * signature check, page cap and deadline without a change of its own.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await extractPdfTextBounded(buffer);
  return result.ok ? result.text : "";
}
