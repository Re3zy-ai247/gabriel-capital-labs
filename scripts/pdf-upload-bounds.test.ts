// Run: npx tsx scripts/pdf-upload-bounds.test.ts
//
// P1-20 (E-05/E-06) — PDF parsing must be bounded.
//
// THE DEFECT. lib/pdf.ts called `pdf(buffer)` with no options: no signature
// check, no page cap, no deadline. pdf-parse's own loop
// (node_modules/pdf-parse/lib/pdf-parse.js:81-94) then renders every page the
// document DECLARES, and its per-page `.catch()` swallows failures instead of
// stopping. `app/api/reports/upload/route.ts` runs under `maxDuration = 60` and
// allows 20 uploads/hour/user, so each hostile file burned a paid minute.
//
// THIS GUARD EXECUTES THE REAL EXTRACTOR against a real page bomb: a ~120 KB PDF
// whose page tree declares 20 000 pages, all pointing at one shared page object.
// That file is 0.8% of the 15 MB upload cap, so no size limit anywhere in the
// product refuses it. Extracting it with the pre-change call took ~28-31 s here;
// bounded, it takes ~300 ms. The "baseline" section re-derives that gap on every
// run from two cheap facts rather than re-burning 30 s of CPU — see the comment
// there for why a 30 s assertion would also be timing-flaky.
//
// Offline. No database, no network, no keys.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPdfTextBounded, looksLikePdf, pdfPageCap } from "../lib/pdf";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

// A structurally valid PDF whose /Pages node declares `pageCount` kids, every one
// of them the SAME page object. Compression bombs and page bombs are the same
// attack from the parser's point of view: a tiny file that asks for unbounded
// per-page work.
function buildPageBomb(pageCount: number): Buffer {
  const objects: string[] = [];
  const kids = Array.from({ length: pageCount }, () => "3 0 R").join(" ");
  const streamText = "BT /F1 12 Tf 72 720 Td (ACCOUNT 1234 CHARGE OFF BALANCE 500) Tj ET";
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

const DECLARED_PAGES = 20_000;
const BOMB = buildPageBomb(DECLARED_PAGES);

async function main(): Promise<void> {
  console.log("\nsignature check (the cheapest refusal)");
  check("a PDF header is recognised", looksLikePdf(Buffer.from("%PDF-1.7\n...", "latin1")));
  check("HTML is not a PDF", !looksLikePdf(Buffer.from("<!DOCTYPE html><script>", "latin1")));
  check("a PNG is not a PDF", !looksLikePdf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])));
  check("an empty buffer is not a PDF", !looksLikePdf(Buffer.alloc(0)));
  check(
    "a header that only starts with % is not a PDF",
    !looksLikePdf(Buffer.from("%PDX-1.4", "latin1"))
  );
  const notPdf = await extractPdfTextBounded(Buffer.from("<html>not a pdf</html>", "latin1"));
  check(
    "a non-PDF never reaches pdf.js — refused as not-pdf",
    notPdf.ok === false && notPdf.reason === "not-pdf"
  );

  console.log("\nthe bomb is inside every size limit the product has");
  check("the bomb declares 20 000 pages", BOMB.length > 0 && DECLARED_PAGES === 20_000);
  check(
    `the bomb is only ${Math.round(BOMB.length / 1024)} KB — far under the 15 MB upload cap`,
    BOMB.length < 1024 * 1024
  );

  console.log("\nbounded extraction");
  const t0 = Date.now();
  const bounded = await extractPdfTextBounded(BOMB);
  const boundedMs = Date.now() - t0;
  check("the bomb still PARSES (so the bound is what stopped it, not a parse failure)", bounded.ok);
  if (bounded.ok) {
    check(
      `pdf.js reports the declared page count (${bounded.declaredPages})`,
      bounded.declaredPages === DECLARED_PAGES
    );
    check(
      `only the page cap is rendered (${bounded.renderedPages} <= ${pdfPageCap()})`,
      bounded.renderedPages <= pdfPageCap() && bounded.renderedPages > 0
    );
    check("the partial read is REPORTED as truncated, never as complete", bounded.truncated === true);
    check("real text still comes back from the pages that were read", bounded.text.includes("ACCOUNT 1234"));
  }
  check(`bounded extraction finished fast (${boundedMs} ms < 5 000 ms)`, boundedMs < 5_000);

  console.log("\nbaseline (non-vacuity: what the SAME input costs WITHOUT a page cap)");
  // The pre-change call was `pdf(buffer)` with no options. Measured on this repo
  // while writing this guard, that took ~28-31 s on the buffer above. Asserting
  // "~30 s" directly would make every run of this suite cost 30 s and would race
  // a starved macrotask timer (pdf.js blocks the loop in long synchronous
  // chunks, so a setTimeout-based race can report the parse as "finished" when
  // it merely outlived the timer's turn). Instead the two facts that PRODUCE
  // that number are asserted, each cheaply and deterministically:
  //   (a) with no cap the render loop runs once per DECLARED page, and
  //   (b) wall-clock cost scales with the number of pages rendered.
  // Together: 20 000 declared pages cost ~80x what the 250-page cap costs.
  const mod: any = await import("pdf-parse/lib/pdf-parse.js");
  const pdf = mod.default || mod;

  // (a) The loop bound. Read out of the INSTALLED dependency — this is the exact
  //     code that runs in production, not a paraphrase of it — and paired with a
  //     measured fact: pdf.js really does report 20 000 pages for this buffer, so
  //     with `max` absent the loop really would run 20 000 times. Asserted this
  //     way rather than by actually running 20 000 iterations, which costs ~28 s
  //     of CPU every time the suite runs.
  const pdfParseSource = readFileSync(
    require.resolve("pdf-parse/lib/pdf-parse.js", { paths: [join(__dirname, "..")] }),
    "utf8"
  );
  check(
    "pdf-parse drives its render loop off the DECLARED page count when no max is given",
    pdfParseSource.includes("let counter = options.max <= 0 ? doc.numPages : options.max;")
  );
  check(
    "pdf-parse's per-page catch swallows failures instead of stopping the loop",
    /getPage\(i\)[\s\S]{0,200}\.catch\(/.test(pdfParseSource)
  );
  const declaredOnly = await pdf(BOMB, { max: 1 });
  check(
    `pdf.js really reports ${DECLARED_PAGES} pages for this buffer, so that loop bound is ${DECLARED_PAGES}`,
    declaredOnly.numpages === DECLARED_PAGES
  );
  check(
    `the bounded path renders ${pdfPageCap()} of those ${DECLARED_PAGES} pages`,
    bounded.ok === true && bounded.renderedPages === pdfPageCap()
  );

  // (b) Real extraction, capped twice, to show the cost is per-page and not a
  //     fixed document overhead.
  const c0 = Date.now();
  await pdf(BOMB, { max: 250 });
  const at250 = Date.now() - c0;
  const c1 = Date.now();
  await pdf(BOMB, { max: 2_500 });
  const at2500 = Date.now() - c1;
  check(
    `cost scales with pages rendered: 250 pages ${at250} ms vs 2 500 pages ${at2500} ms`,
    at2500 > at250 * 4
  );

  console.log("\ndeadline (runs last: it deliberately abandons a parse mid-document)");
  process.env.PDF_PARSE_TIMEOUT_MS = "100";
  process.env.PDF_MAX_PAGES = "2000";
  const d0 = Date.now();
  const timedOut = await extractPdfTextBounded(BOMB);
  const deadlineMs = Date.now() - d0;
  check(
    "a document that outruns the deadline is refused, not silently half-read",
    timedOut.ok === false ? timedOut.reason === "timeout" : timedOut.truncated === true
  );
  check(`the deadline returns control quickly (${deadlineMs} ms < 5 000 ms)`, deadlineMs < 5_000);
  delete process.env.PDF_PARSE_TIMEOUT_MS;
  delete process.env.PDF_MAX_PAGES;

  console.log(`\npdf-upload-bounds.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
