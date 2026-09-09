// Run: npx --no-install tsx scripts/runtime/pdf-byte-boundary.runtime.test.ts
// Ordinary synthetic PDF only. No network, database, large-page payloads, or real reports.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { check, mockPackage, repoPath, run, section } from "./_harness";

type Options = { max: number; pagerender: (page: unknown) => Promise<string> };
type Parsed = { text: string; numpages: number; numrender: number };
type Parser = (bytes: Uint8Array, options: Options) => Promise<Parsed>;
const realParser = createRequire(__filename)("pdf-parse/lib/pdf-parse.js") as Parser;
let parser: Parser = realParser;
mockPackage("pdf-parse/lib/pdf-parse.js", {
  default: (bytes: Uint8Array, options: Options) => parser(bytes, options),
});
// tsx preserves native dynamic import, which bypasses the harness's require
// mocks. Compile the real source to CommonJS in memory so its dynamic parser
// import uses the same mocked I/O boundary as the other runtime guards.
const filename = repoPath("lib/pdf.ts");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const loaded = new Module(filename) as Module & { _compile(source: string, filename: string): void };
loaded.filename = filename;
loaded.paths = (Module as unknown as { _nodeModulePaths(path: string): string[] })._nodeModulePaths(repoPath("lib"));
loaded._compile(compiled, filename);
const pdf = loaded.exports as typeof import("../../lib/pdf");
const fixture = readFileSync(repoPath("scripts/fixtures/creditvector-p2c1-synthetic-report.pdf"));
const fixtureHash = "10202b1de7ba49f0914f171938bad26c7660c3fbd2cdcd9cbe63e9c2b355d9df";

function fixtureView() {
  const backing = Buffer.allocUnsafeSlow(fixture.length + 128);
  backing.fill(0x5a, 0, 64);
  backing.fill(0xa5, fixture.length + 64);
  fixture.copy(backing, 64);
  return { backing, view: backing.subarray(64, 64 + fixture.length) };
}

run("pdf-byte-boundary.runtime.test.ts", async () => {
  const oldPages = process.env.PDF_MAX_PAGES;
  const oldTimeout = process.env.PDF_PARSE_TIMEOUT_MS;
  delete process.env.PDF_MAX_PAGES;
  delete process.env.PDF_PARSE_TIMEOUT_MS;
  try {
    section("frozen fixture through the real legacy parser");
    const digest = createHash("sha256").update(fixture).digest("hex");
    check("the regression uses the exact frozen synthetic fixture", digest === fixtureHash);
    if (digest !== fixtureHash) throw new Error("Frozen fixture checksum mismatch");
    const { view } = fixtureView();
    check("input has a non-zero byteOffset", view.byteOffset === 64);
    check("input is a view into a larger backing allocation", view.buffer.byteLength > view.length);
    const extracted = await pdf.extractPdfTextBounded(view);
    check("the legacy parser succeeds without a bad-XRef failure", extracted.ok);
    if (!extracted.ok) throw new Error(`Fixture extraction failed: ${extracted.reason}`);
    check("all four pages are declared and rendered", extracted.declaredPages === 4 && extracted.renderedPages === 4);
    check("the complete read is not labelled truncated", !extracted.truncated);
    check("extracted text retains the established 2,009 characters", extracted.text.length === 2009);
    for (const expected of ["SYNTHETIC CREDIT REPORT", "CREDITVECTOR P2 ACCEPTANCE FIXTURE", "Example Bank", "Sample Collection Services", "Demo Auto Finance"]) {
      check(`extracted text contains ${expected}`, extracted.text.includes(expected));
    }
    check("text-only callers inherit the correction", (await pdf.extractPdfText(view)) === extracted.text);

    section("the actual parser boundary owns only the visible bytes");
    const ownedCase = fixtureView();
    let boundaryCalls = 0;
    parser = async (bytes) => {
      boundaryCalls++;
      check("parser input is a plain Uint8Array, not a Buffer", bytes.constructor === Uint8Array && !Buffer.isBuffer(bytes));
      check("input length exactly matches visible Buffer length", bytes.length === ownedCase.view.length);
      check("only visible PDF bytes reach the parser", Buffer.from(bytes).equals(fixture));
      check("prefix and suffix backing bytes are excluded", bytes.buffer.byteLength === fixture.length);
      check("parser storage starts at zero", bytes.byteOffset === 0);
      check("parser storage is independently owned", bytes.buffer !== ownedCase.backing.buffer);
      ownedCase.backing.fill(0);
      check("mutating the original allocation cannot change parser input", Buffer.from(bytes).equals(fixture));
      return { text: "ordinary text", numpages: 1, numrender: 1 };
    };
    await pdf.extractPdfTextBounded(ownedCase.view);
    check("the boundary assertions actually executed once", boundaryCalls === 1);

    section("signature and bounded ordinary-page extraction");
    boundaryCalls = 0;
    const refused = await pdf.extractPdfTextBounded(Buffer.from("ordinary plain text"));
    check("a non-PDF signature is refused", !refused.ok && refused.reason === "not-pdf");
    check("a non-PDF never reaches the parser", boundaryCalls === 0);
    parser = realParser;
    process.env.PDF_MAX_PAGES = "2";
    const partial = await pdf.extractPdfTextBounded(fixtureView().view);
    check("an ordinary four-page PDF obeys the two-page cap", partial.ok && partial.declaredPages === 4 && partial.renderedPages === 2);
    check("a capped result is explicitly partial", partial.ok && partial.truncated);
    process.env.PDF_MAX_PAGES = "99999";
    check("the hard page ceiling remains 2,000", pdf.pdfPageCap() === 2000);
    process.env.PDF_PARSE_TIMEOUT_MS = "999999";
    check("the hard deadline ceiling remains 45,000 ms", pdf.pdfTimeoutMs() === 45000);
    delete process.env.PDF_MAX_PAGES;
    delete process.env.PDF_PARSE_TIMEOUT_MS;
    check("default bounds remain 250 pages and 20 seconds", pdf.pdfPageCap() === 250 && pdf.pdfTimeoutMs() === 20000);

    section("deterministic deadline outcomes without expensive PDFs or sleeps");
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const originalNow = Date.now;
    let timerCallback: (() => void) | undefined;
    let cleared = 0;
    try {
      globalThis.setTimeout = ((callback: () => void) => {
        timerCallback = callback;
        return 1;
      }) as unknown as typeof setTimeout;
      globalThis.clearTimeout = (() => { cleared++; }) as typeof clearTimeout;
      parser = () => new Promise<Parsed>(() => {});
      const pending = pdf.extractPdfTextBounded(fixtureView().view);
      await new Promise<void>((resolve) => setImmediate(resolve));
      check("the deadline timer was armed", typeof timerCallback === "function");
      if (!timerCallback) throw new Error("Deadline timer was not armed");
      timerCallback();
      const timedOut = await pending;
      check("deadline expiration returns timeout", !timedOut.ok && timedOut.reason === "timeout");
      check("the timer is cleared after timeout", cleared === 1);

      let now = 1000;
      let textCalls = 0;
      Date.now = () => now;
      parser = async (_bytes, options) => {
        now += 20001;
        const text = await options.pagerender({ getTextContent: async () => { textCalls++; return { items: [] }; } });
        return { text, numpages: 1, numrender: 1 };
      };
      const deadlinePartial = await pdf.extractPdfTextBounded(fixtureView().view);
      check("an elapsed per-page budget skips text work", textCalls === 0);
      check("a deadline-limited read is marked partial", deadlinePartial.ok && deadlinePartial.truncated);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      Date.now = originalNow;
    }
  } finally {
    if (oldPages === undefined) delete process.env.PDF_MAX_PAGES; else process.env.PDF_MAX_PAGES = oldPages;
    if (oldTimeout === undefined) delete process.env.PDF_PARSE_TIMEOUT_MS; else process.env.PDF_PARSE_TIMEOUT_MS = oldTimeout;
  }
});
