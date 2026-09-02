// Run: npx --no-install tsx scripts/disclosure-truth.test.ts
//
// RC1-S8 — what we TELL a consumer vs what the code actually DOES.
// Founder decisions D-5 (gov-ID AI off), D-9 (interim factual text),
// D-11 (remove the false deletion promise). Findings E-15, E-16, D-03, P1-34.
//
// THE FOUR GAPS THIS PINS
//   1. /legal/privacy said only that "text is processed by our AI provider". It
//      named no provider, and it did not disclose that the consumer's
//      GOVERNMENT-ID IMAGES were being decrypted and transmitted with an
//      instruction to read their DATE OF BIRTH off the ID (E-15).
//   2. Neither legal page disclosed that dispute letters are AI-drafted, or that
//      the Score Tracker holds numbers the consumer typed in themselves (D-03).
//   3. /legal/privacy promised "Request deletion of your account by contacting
//      support." No deletion path exists, and one is actively barred by
//      scripts/consumer-deletion-containment.test.ts. Promising a right the
//      product is guarded AGAINST implementing is the worst of both (P1-34).
//   4. The full raw report — SSN included — went to the AI provider unredacted,
//      and no redaction helper existed anywhere in the tree (E-16).
//
// SECTIONS 1-3 are source-level. SECTION 4 EXECUTES the real identity route
// against fakes and reads the message it built, because "the disclosure is now
// true" is a claim about behaviour and only behaviour can settle it. It uses the
// same transpile+vm containment scripts/consumer-deletion-containment.test.ts
// uses for the same reason. Offline throughout: no database, no network, no key,
// no Anthropic client — meteredMessage is replaced by a recorder.
//
// NON-VACUITY (measured 2026-08-23, pre-slice files restored into a working copy
// and reverted immediately afterwards, never committed):
//   · `git show 31d4e35:` restored for app/legal/privacy/page.tsx,
//     app/legal/terms/page.tsx and app/api/identity/discrepancies/route.ts:
//     **22 passed, 30 failed** (exit 1). Every §1 disclosure check fails, the
//     deletion promise is found, and — the part source review cannot give you —
//     §4 fails on BEHAVIOUR: the old route reads the ID rows, decrypts them,
//     and builds image blocks with a "date of birth" instruction, with the flag
//     absent and no flag in the file at all.
//   · The §5 redaction checks cannot be baselined this way: on the pre-slice
//     tree `redactSensitivePatterns` does not exist, so this file does not
//     import. Its absence WAS the finding (E-16: "No redaction helper exists
//     anywhere in the tree").
//   · REMEDIATION ROUND (review H-1). With `git show d998b8d:` restored for
//     app/api/identity/discrepancies/route.ts — the version that shipped the
//     report text to the provider unmasked — **57 passed, 4 failed** (exit 1),
//     and the four are exactly the new cases: the derived coverage check names
//     the route, the ordered-call check fails, and the behavioural case finds
//     `123-45-6789` in the transmitted prompt. The previous version of the
//     §5 pin ("redaction happens in exactly one place") PASSED on that tree,
//     which is why it was replaced by a coverage check.
//   · MICRO-ROUND (mask-then-truncate). The boundary case carries its own
//     non-vacuity inline: it asserts that the OLD order — truncate, then mask —
//     demonstrably leaks a fragment of an SSN straddling the 120k cut, on the
//     same fixture where the shipped order leaks none of 36 fragments. That
//     check fails if the leak ever stops being reproducible, so the boundary
//     assertion above it can never pass for free.
//   · S11 ROUND (review B-3). With `git show 59f2afd:app/legal/privacy/page.tsx`
//     restored — the RC's four-bullet list — **74 passed, 9 failed** (exit 1).
//     The widened derivation does not merely re-find B-3's response path: it
//     also fails on TWO further live transmitters the RC policy never named,
//     the identity correction letter and the action plan. That is the point of
//     deriving the set instead of listing it.
//   · Unmodified slice tree: **83 passed, 0 failed** (exit 0).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { CURRENT_TERMS_VERSION } from "../lib/terms";
import { redactSensitivePatterns } from "../lib/aiParse";

export {};

let pass = 0,
  fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
// Prose must never satisfy — or break — an assertion about behaviour. A comment
// quoting the promise we removed is not the page making it.
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// JSX text is soft-wrapped across lines; collapse whitespace so a sentence is
// searchable as a sentence and a reflow does not silently disarm a check.
const flat = (src: string) => codeOf(src).replace(/\s+/g, " ");

const PRIVACY = flat(read("app/legal/privacy/page.tsx"));
const TERMS = flat(read("app/legal/terms/page.tsx"));
const IDENTITY_ROUTE = "app/api/identity/discrepancies/route.ts";
const identitySrc = read(IDENTITY_ROUTE);

console.log("\n1. the legal pages disclose what the product actually does");
check("privacy names the AI provider, not an anonymous 'our AI provider'", /Anthropic/.test(PRIVACY));
check("terms names it too, so the two pages do not disagree", /Anthropic/.test(TERMS));
check(
  "terms discloses that dispute letters are AI-drafted (D-03a)",
  /drafted by software, including an AI model/i.test(TERMS)
);
check(
  "…from facts the consumer confirms, not facts the product invented",
  /from the facts you confirm about your own accounts/i.test(TERMS)
);
check(
  "terms discloses the Score Tracker is self-reported and unverified (D-03b)",
  /Scores in the Score Tracker are the ones you type in yourself/i.test(TERMS) &&
    /does not pull, verify, or bureau-confirm any score/i.test(TERMS)
);
check(
  "privacy repeats it where the data is described",
  /we do not pull them from a bureau and we do not verify them/i.test(PRIVACY)
);
check(
  "privacy discloses that report text goes to the provider",
  /The text of the credit report you uploaded or pasted/i.test(PRIVACY)
);
check(
  "privacy discloses that government-ID IMAGES are NOT sent (E-15)",
  /Images of a government-issued ID/i.test(PRIVACY) && /<strong>not<\/strong> transmitted to our AI provider/i.test(PRIVACY)
);
check(
  "…and that no date of birth is read off one",
  /no date of birth is read from it/i.test(PRIVACY)
);
check(
  "privacy discloses SSN masking as a REDUCTION, never as a guarantee (E-16)",
  /we mask Social Security numbers/i.test(PRIVACY) && /cannot promise it catches every instance/i.test(PRIVACY)
);
check(
  "…and stays honest that DOB / address history / employers still travel in report text",
  /date of birth, address history and employers/i.test(PRIVACY)
);
check(
  "the recorded terms version equals the published revision of /legal/terms " +
    `(lib=${CURRENT_TERMS_VERSION})`,
  (() => {
    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const m = read("app/legal/terms/page.tsx").match(/updated="([A-Z][a-z]+) (\d{1,2}), (\d{4})"/);
    if (!m) return false;
    return `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` === CURRENT_TERMS_VERSION;
  })()
);

console.log("\n2. the pages promise nothing the product cannot do");
check(
  "the account-deletion promise is GONE (P1-34)",
  !/Request deletion of your account/i.test(PRIVACY) &&
    !/(request|contact)[^.]{0,60}deletion of your account/i.test(PRIVACY)
);
check(
  "…replaced by what is actually true today",
  /no self-service way to delete your whole account/i.test(PRIVACY) &&
    /Tooling for both is planned and is not built/i.test(PRIVACY)
);
check(
  "…and the honest version still tells them what to do next",
  /contact support with what you want removed/i.test(PRIVACY)
);
check(
  "no export promise sneaked in to replace it",
  !/you can export (all|everything)/i.test(PRIVACY) && !/download (all|everything) we hold/i.test(PRIVACY)
);
check(
  "the report-deletion bullet no longer over-claims: letters are named as surviving",
  /Letters you already generated are kept/i.test(PRIVACY)
);
// A guarantee is a guarantee only when it is ASSERTED. "cannot and does not
// promise that any item will be removed" contains the same words as the thing it
// forbids, so the check is per sentence and a sentence carrying a negation is
// not a claim. Anything else matching is reported with the sentence, so a real
// hit is actionable rather than a bare FAIL.
const GUARANTEE = /(we guarantee|guaranteed (removal|deletion|results|score|improvement)|will be (removed|deleted)|promise[sd]? (to )?(remove|delete|improve))/i;
const NEGATED = /\b(cannot|can't|does not|do not|don't|never|no|not|without)\b/i;
function assertedGuarantees(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => GUARANTEE.test(sentence) && !NEGATED.test(sentence))
    .map((sentence) => sentence.trim().slice(0, 90));
}
check(
  `privacy asserts no outcome guarantee (found: ${assertedGuarantees(PRIVACY).join(" | ") || "none"})`,
  assertedGuarantees(PRIVACY).length === 0
);
check(
  `terms asserts no outcome guarantee (found: ${assertedGuarantees(TERMS).join(" | ") || "none"})`,
  assertedGuarantees(TERMS).length === 0
);
check(
  "the negation-aware check is not vacuous: a planted assertion IS caught",
  assertedGuarantees("We guarantee your collection will be removed.").length === 1
);
check(
  "terms still carries the explicit non-guarantee it had before",
  /cannot and does not promise that any item will be removed/i.test(TERMS)
);
const COUNSEL_CLAIM = /(reviewed|approved|vetted|cleared) by (our |a |an )?(counsel|attorney|lawyer|legal (team|counsel))|attorney[- ]approved|lawyer[- ]approved|legally (approved|vetted|cleared)/i;
check("privacy claims no counsel approval", !COUNSEL_CLAIM.test(PRIVACY));
check("terms claims no counsel approval", !COUNSEL_CLAIM.test(TERMS));
check(
  "terms still states the product is not a CRO or a law firm",
  /not a credit-repair organization, a law firm/i.test(TERMS)
);

console.log("\n3. the gov-ID image path is structurally off (source) — D-5 / P0-8");
const idCode = codeOf(identitySrc);
check(
  "there is a flag and it is fail-closed: only the exact string 'true' opens it",
  /process\.env\.IDENTITY_IMAGE_AI_ENABLED === "true"/.test(idCode)
);
check(
  "the flag is not defaulted open anywhere",
  !/IDENTITY_IMAGE_AI_ENABLED\s*(\|\||\?\?)/.test(idCode) && !/IDENTITY_IMAGE_AI_ENABLED !== /.test(idCode)
);
check(
  "decryption of an ID happens in exactly one function, and that function checks the flag first",
  (idCode.match(/decryptDocument\(/g) || []).length === 1 &&
    idCode.indexOf("if (!identityImageAiEnabled()) return []") < idCode.indexOf("decryptDocument(")
);
check(
  "the only call site is itself gated (a second, ungated call would trip this)",
  (idCode.match(/collectGovIdImages\(/g) || []).length === 2 &&
    /identityImageAiEnabled\(\) \? await collectGovIdImages\(/.test(idCode)
);
check(
  "the 'read the date of birth' instruction is deleted from the source outright",
  !/date of birth/i.test(idCode)
);
check(
  "the presence count reads metadata only — it never touches ciphertext",
  /prisma\.document\.count\(/.test(idCode) &&
    !/prisma\.document\.count\([^)]*ciphertext/.test(idCode)
);
check(
  "the response can say an ID is on file and was not used",
  /idImagesPresent: idDocumentCount > 0/.test(idCode)
);
check(
  "the typed-identity comparison is untouched (the feature degrades, it does not vanish)",
  /VERIFIED IDENTITY \(typed by the consumer\)/.test(idCode) && /user\.fullName/.test(idCode)
);

console.log("\n4. …and off in FACT: the route is executed and its request is read");
// ── contained execution, same mechanism as consumer-deletion-containment ─────
interface Sent {
  system: string;
  /** The user message's content blocks — messages[0].content, where the route puts them. */
  content: Array<Record<string, unknown>>;
}
const imageBlocks = (s: Sent | null) => (s?.content ?? []).filter((c) => c.type === "image");

async function main() {
  // Loads the REAL route source into a fresh vm context with every import
  // replaced, awaits POST(), and hands back the request it tried to send.
  // A fresh context per scenario is deliberate: process.env is read at call
  // time, and a warm module would let one scenario's flag leak into the next.
  function invoke(opts: { flag: string | undefined; idDocs: number; reportText?: string }) {
    return new Promise<{ sent: Sent | null; body: Record<string, unknown>; calls: string[] }>((resolve) => {
      const calls: string[] = [];
      let sent: Sent | null = null;
      const docs = Array.from({ length: opts.idDocs }, (_, i) => ({
        id: `doc_${i}`,
        mimeType: "image/jpeg",
        ciphertext: Buffer.from("cipher"),
        iv: Buffer.from("iv"),
        authTag: Buffer.from("tag"),
      }));
      const prisma = {
        document: {
          findMany: async () => {
            calls.push("prisma.document.findMany");
            return docs;
          },
          count: async () => {
            calls.push("prisma.document.count");
            return docs.length;
          },
        },
        report: {
          findFirst: async () => {
            calls.push("prisma.report.findFirst");
            return { id: "r1", rawText: "enc" };
          },
        },
      };
      const compiled = ts.transpileModule(identitySrc, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
        fileName: IDENTITY_ROUTE,
      });
      const routeModule = { exports: {} as Record<string, unknown> };
      const requireMock = (specifier: string) => {
        switch (specifier) {
          case "next/server":
            return {
              NextResponse: {
                json: (body: unknown) =>
                  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
              },
            };
          case "@/lib/prisma":
            return { prisma };
          case "@/lib/session":
            return {
              currentUserOrDemo: async () => ({
                id: "u1",
                fullName: "Marcus Chen",
                addressLine1: "1 Main St",
                city: "Austin",
                state: "TX",
                zip: "78701",
              }),
            };
          case "@/lib/rateLimit":
            return { enforceRateLimit: async () => null };
          case "@/lib/aiMeter":
            return {
              meteredMessage: async (
                _surface: string,
                _id: string,
                req: { system: string; messages: Array<{ content: Array<Record<string, unknown>> }> }
              ) => {
                calls.push("ai.meteredMessage");
                // Read from messages[0].content — where an Anthropic request
                // actually carries its blocks. Reading the wrong field would
                // make "zero image blocks" true for free.
                sent = { system: req.system, content: req.messages?.[0]?.content ?? [] };
                return {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        reportedNames: [],
                        reportedAddresses: [],
                        reportedEmployers: [],
                        discrepancies: [],
                      }),
                    },
                  ],
                };
              },
            };
          case "@/lib/docCrypto":
            return {
              docCryptoReady: () => true,
              decryptText: () => opts.reportText ?? "CREDIT REPORT TEXT",
              decryptDocument: () => {
                calls.push("docCrypto.decryptDocument");
                return Buffer.from("JPEGBYTES");
              },
            };
          case "@/lib/aiParse":
            // The REAL helper, not a stub. A stub would let this section prove
            // that something was called, never that the SSN actually left.
            return { redactSensitivePatterns };
          default:
            throw new Error(`Unexpected route import: ${specifier}`);
        }
      };
      const env: Record<string, string> = { ANTHROPIC_API_KEY: "test-key" };
      if (opts.flag !== undefined) env.IDENTITY_IMAGE_AI_ENABLED = opts.flag;
      vm.runInNewContext(
        compiled.outputText,
        { module: routeModule, exports: routeModule.exports, require: requireMock, Response, Buffer, process: { env } },
        { filename: IDENTITY_ROUTE }
      );
      const POST = routeModule.exports.POST as () => Promise<Response>;
      POST().then(
        async (res) => resolve({ sent, body: JSON.parse(await res.text()), calls }),
        (e) => resolve({ sent, body: { threw: String(e) }, calls })
      );
    });
  }

  // — the shipped configuration: flag ABSENT, two ID images on file —
  const off = await invoke({ flag: undefined, idDocs: 2 });
  check("the request was actually built (the checks below are not vacuous)", off.calls.includes("ai.meteredMessage"));
  check("with the flag absent, NO ID ciphertext is ever read", !off.calls.includes("prisma.document.findMany"));
  check("…and nothing is decrypted", !off.calls.includes("docCrypto.decryptDocument"));
  check("…and the message carries ZERO image blocks", imageBlocks(off.sent).length === 0);
  check(
    "…and the system prompt mentions no ID and no date of birth",
    !/GOVERNMENT ID/i.test(off.sent?.system ?? "") && !/date of birth/i.test(off.sent?.system ?? "")
  );
  check("…and the report text is still sent, so the feature still works", (off.sent?.content ?? []).length === 1);
  check("the response does not claim the ID was used", off.body.usedId === false);
  check("…but is honest that one is on file", off.body.idImagesPresent === true);

  // — non-vacuity of the gate itself: the route CAN send images, and only the
  //   flag is stopping it. Without this, "zero image blocks" could just mean the
  //   code lost the ability to build one. Nothing leaves the process here.
  const on = await invoke({ flag: "true", idDocs: 2 });
  check("with the flag ON the route does send image blocks (so the gate is what stops it)", imageBlocks(on.sent).length === 2);
  check("…proving the OFF result above is caused by the flag, not by dead code", on.body.usedId === true);
  // …and even then the DOB instruction is gone for good.
  check("even with the flag ON, no date-of-birth instruction exists", !/date of birth/i.test(on.sent?.system ?? ""));

  // — a value that merely LOOKS enabled must not open it —
  const fuzzy = await invoke({ flag: "1", idDocs: 2 });
  check('IDENTITY_IMAGE_AI_ENABLED="1" does NOT open the gate (fail closed)', imageBlocks(fuzzy.sent).length === 0);

  // — review H-1, behaviourally: the report text this route transmits is masked.
  //   Regex over source proves the call is written; only this proves the number
  //   is not in the bytes the provider would have received.
  const SSN = "123-45-6789";
  const withSsn = await invoke({
    flag: undefined,
    idDocs: 0,
    reportText: `PERSONAL INFORMATION\nName: MARCUS CHEN\nSSN: ${SSN}\nAddress: 1 MAIN ST AUSTIN TX 78701`,
  });
  const transmitted = JSON.stringify(withSsn.sent?.content ?? []) + (withSsn.sent?.system ?? "");
  check("the identity request was built (the SSN checks below are not vacuous)", withSsn.sent !== null);
  check("a dashed SSN in the report text NEVER reaches the identity prompt", !transmitted.includes(SSN));
  check("…it was masked, not dropped along with the section around it", transmitted.includes("[REDACTED]"));
  check(
    "…and the personal information the check actually compares still arrives intact",
    transmitted.includes("MARCUS CHEN") && transmitted.includes("1 MAIN ST AUSTIN TX 78701")
  );

  // — review micro-round: an SSN STRADDLING the 120k truncation boundary.
  //   Order matters here and nothing else catches it: truncate-then-mask hands
  //   the masker a partial run ("123-4") that matches neither pattern, so up to
  //   8 of 9 digits ship. Mask-then-truncate cuts already-masked text.
  // Padded so the SSN begins 5 characters before the cut: truncating first
  // leaves "123-4" at the end of what is transmitted.
  // Padded so the SSN begins exactly 5 characters before the cut — truncating
  // first leaves "123-4" at the end of what is transmitted. The newline before
  // it matters: SSN_DASHED needs a word boundary, so an SSN abutting filler
  // text would not be a test of the ORDER at all.
  const boundaryHead = "PERSONAL INFORMATION\n";
  const boundaryText =
    boundaryHead + "x".repeat(120_000 - 5 - boundaryHead.length - 1) + "\n" + SSN + "\nTRAILING";
  const straddle = await invoke({ flag: undefined, idDocs: 0, reportText: boundaryText });
  const straddleSent = JSON.stringify(straddle.sent?.content ?? []);
  const fragments = [] as string[];
  for (let start = 0; start < SSN.length; start++) {
    for (let end = start + 4; end <= SSN.length; end++) fragments.push(SSN.slice(start, end));
  }
  check("the boundary request was built (the checks below are not vacuous)", straddle.sent !== null);
  check(
    `no 4+ character fragment of the SSN survives the cut (${fragments.length} fragments checked)`,
    fragments.every((f) => !straddleSent.includes(f))
  );
  check(
    "…and the check is not free: the OLD order (truncate, then mask) demonstrably leaked one",
    fragments.some((f) => redactSensitivePatterns(boundaryText.slice(0, 120_000)).includes(f))
  );

  console.log("\n5. SSN redaction — what leaves the box on every upload (E-16 / P1-22)");
  check(
    "a dashed SSN is masked",
    !redactSensitivePatterns("Social Security Number: 123-45-6789").includes("123-45-6789")
  );
  check(
    "a labelled 9-digit run is masked",
    !/\b123456789\b/.test(redactSensitivePatterns("SSN: 123456789"))
  );
  check("the label survives, so the report still reads sensibly", /SSN/.test(redactSensitivePatterns("SSN: 123456789")));
  // The correctness half: masking must not damage what the extractor reads.
  const TRADELINE = [
    "CAPITAL ONE BANK USA NA",
    "Account #: 517805XXXXXX1234",
    "Balance: $1,477.00   Credit Limit: $2,000",
    "Date Opened: 03/2019   Date of Last Payment: 11/2024",
    "Account Number 4147202512345678",
    "High Balance 987654321",
  ].join("\n");
  check(
    "a realistic tradeline block passes through BYTE-IDENTICAL (no collateral masking)",
    redactSensitivePatterns(TRADELINE) === TRADELINE
  );
  check(
    "a bare 9-digit run with no SSN label is deliberately left alone",
    redactSensitivePatterns("Balance 123456789").includes("123456789")
  );
  const aiParse = codeOf(read("lib/aiParse.ts"));
  // ── COVERAGE OVER EVERY AI TRANSMITTER (review H-1, widened by S11 B-3) ─────
  //
  // Version 1 of this check asserted "redaction happens in exactly one place".
  // It pinned the wrong invariant and passed while a second surface shipped the
  // report unmasked. Version 2 derived the set from `meteredMessage(` AND
  // `rawText` — better, but STRUCTURALLY BLIND to the defect S11 found: logging
  // a bureau response sends `decryptText(letter.body)` (which opens with the
  // consumer's full legal name and street address) through `analyzeResponse`,
  // so it carries neither `rawText` nor a `meteredMessage` call of its own.
  //
  // Version 3 derives the transmitter set the way the data actually travels:
  //   L0 — every source that calls meteredMessage (minus lib/aiMeter.ts, which
  //        defines it).
  //   L1 — every source that imports and calls a lib/ export whose OWN body
  //        calls meteredMessage. That one hop is what catches the response
  //        route through lib/round2.ts's analyzeResponse.
  // The derived set is then compared against a reviewed MANIFEST, exactly. A
  // new transmitter — a third surface, a new caller of an existing helper — is
  // not in the manifest, so it FAILS here and gets read by a person, instead of
  // shipping under a policy that does not mention it. Each manifest entry
  // carries the reason it is allowed, and each reason is itself asserted.
  function walkSources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walkSources(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  }
  const allSources = [...walkSources("app"), ...walkSources("lib")];
  const level0 = allSources
    .filter((rel) => /meteredMessage\(/.test(codeOf(read(rel))) && rel !== "lib/aiMeter.ts")
    .sort();
  /** Exported functions in `rel` whose own body reaches meteredMessage. */
  function aiExportsOf(rel: string): string[] {
    const code = codeOf(read(rel));
    const marks = [...code.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map(
      (m) => [m[1], m.index ?? 0] as const
    );
    return marks
      .filter(([, at], i) => /meteredMessage\(/.test(code.slice(at, i + 1 < marks.length ? marks[i + 1][1] : code.length)))
      .map(([name]) => name);
  }
  const level1 = new Map<string, string[]>();
  for (const mod of level0.filter((rel) => rel.startsWith("lib/"))) {
    for (const name of aiExportsOf(mod)) {
      for (const rel of allSources) {
        if (level0.includes(rel)) continue;
        const code = codeOf(read(rel));
        if (new RegExp(`\\b${name}\\s*\\(`).test(code) && new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(code)) {
          level1.set(rel, (level1.get(rel) ?? []).concat(`${mod}:${name}`));
        }
      }
    }
  }
  const transmitters = [...new Set([...level0, ...level1.keys()])].sort();

  // Every entry is a reviewed decision about ONE data class. "DISCLOSED_*" means
  // the privacy page names that class; the phrase it must contain is asserted
  // below, so deleting the disclosure fails here rather than drifting silently.
  type Disposition =
    | "REPORT_TEXT_REDACTED"
    | "REPORT_TEXT_VIA_REDACTING_HELPER"
    | "DISCLOSED_IDENTITY"
    | "DISCLOSED_ACCOUNT_DETAILS"
    | "DISCLOSED_LETTER_AND_REPLY"
    | "DISCLOSED_FORUM_TEXT"
    | "DORMANT_AI_REFINEMENT"
    | "NOT_CONSUMER_CONTENT";
  const MANIFEST: Record<string, Disposition> = {
    "lib/aiParse.ts": "REPORT_TEXT_REDACTED",
    "app/api/identity/discrepancies/route.ts": "REPORT_TEXT_REDACTED",
    "lib/analyze.ts": "REPORT_TEXT_VIA_REDACTING_HELPER",
    "app/api/identity/letter/route.ts": "DISCLOSED_IDENTITY",
    "app/api/strategist/plan/route.ts": "DISCLOSED_ACCOUNT_DETAILS",
    // ── the S11 B-3 defect: letter body (name + street address) + pasted reply
    "lib/round2.ts": "DISCLOSED_LETTER_AND_REPLY",
    "app/api/letters/[id]/response/route.ts": "DISCLOSED_LETTER_AND_REPLY",
    "lib/os/modules/credit/index.ts": "DISCLOSED_LETTER_AND_REPLY",
    "lib/kai.ts": "DISCLOSED_FORUM_TEXT",
    "app/api/community/threads/route.ts": "DISCLOSED_FORUM_TEXT",
    "app/api/community/threads/[id]/ask-kai/route.ts": "DISCLOSED_FORUM_TEXT",
    // Structurally unreachable: entitlements.ts pins aiRefinement ALWAYS false (D-2).
    "app/api/letters/generate/route.ts": "DORMANT_AI_REFINEMENT",
    "app/api/letters/[id]/round2/route.ts": "DORMANT_AI_REFINEMENT",
    // Editorial ingest / admin summarisation. No consumer record is involved.
    "lib/brief.ts": "NOT_CONSUMER_CONTENT",
    "lib/briefIngest.ts": "NOT_CONSUMER_CONTENT",
    "app/api/admin/brief/summarize/route.ts": "NOT_CONSUMER_CONTENT",
  };

  check(
    `the derivation found transmitters (everything below is not vacuous) — L0=${level0.length}, +L1=${level1.size}`,
    level0.length >= 5 && level1.size >= 3
  );
  check(
    "the one-hop closure reaches the response route THROUGH lib/round2.ts — the path the old sweep could not see",
    level1.get("app/api/letters/[id]/response/route.ts")?.includes("lib/round2.ts:analyzeResponse") === true
  );
  check(
    `the derived set is EXACTLY the reviewed manifest — unlisted: [${transmitters
      .filter((rel) => !(rel in MANIFEST))
      .join(", ")}] · missing: [${Object.keys(MANIFEST)
      .filter((rel) => !transmitters.includes(rel))
      .join(", ")}]`,
    transmitters.length === Object.keys(MANIFEST).length &&
      transmitters.every((rel) => rel in MANIFEST)
  );

  for (const rel of transmitters) {
    const disposition = MANIFEST[rel];
    const code = rel in MANIFEST ? codeOf(read(rel)) : "";
    switch (disposition) {
      case "REPORT_TEXT_REDACTED":
        check(`${rel} [${disposition}]: masks the report text itself`, /redactSensitivePatterns\(/.test(code));
        break;
      case "REPORT_TEXT_VIA_REDACTING_HELPER":
        check(
          `${rel} [${disposition}]: hands the text to aiExtractTradelines, which masks it`,
          /aiExtractTradelines\(/.test(code) && /redactSensitivePatterns\(/.test(aiParse)
        );
        break;
      case "DISCLOSED_IDENTITY":
        check(
          `${rel} [${disposition}]: the policy names the correction letter, not just the identity check`,
          /if you ask for a personal-information correction letter/i.test(PRIVACY)
        );
        break;
      case "DISCLOSED_ACCOUNT_DETAILS":
        check(
          `${rel} [${disposition}]: the policy names the account details sent for an action plan`,
          /creditor, status, balance and dates — when you ask for an action plan/i.test(PRIVACY)
        );
        break;
      case "DISCLOSED_LETTER_AND_REPLY":
        check(
          `${rel} [${disposition}]: the policy names the LETTER, not only the pasted reply (B-3)`,
          /<strong>together with the dispute letter it replies to<\/strong>/i.test(PRIVACY)
        );
        check(
          `${rel} [${disposition}]: …and names the identity data that letter carries`,
          /full name and mailing address printed on it/i.test(PRIVACY)
        );
        break;
      case "DISCLOSED_FORUM_TEXT":
        check(
          `${rel} [${disposition}]: the policy names the community question`,
          /The text of a community question you ask Kai/i.test(PRIVACY)
        );
        break;
      case "DORMANT_AI_REFINEMENT":
        check(
          `${rel} [${disposition}]: gated on entitlement.aiRefinement, which entitlements pins ALWAYS false`,
          /entitlement\.aiRefinement/.test(code) && /aiRefinement:\s*false/.test(codeOf(read("lib/entitlements.ts")))
        );
        break;
      case "NOT_CONSUMER_CONTENT":
        check(
          `${rel} [${disposition}]: touches no consumer record — no report text, no identity, no letter`,
          !/rawText/.test(code) && !/user\.fullName/.test(code) && !/letter\.body/.test(code)
        );
        break;
    }
  }

  // The masking promise must not outrun the manifest: it is scoped to
  // credit-report text, and the policy has to say so in as many words.
  check(
    "the policy scopes the masking claim to credit-report text and says the letter is NOT stripped",
    /That masking covers credit-report text and nothing else/i.test(PRIVACY) &&
      /we do not strip the sender block from your own letter/i.test(PRIVACY)
  );

  check(
    "the upload/parse prompt masks the whole plaintext BEFORE truncating it",
    /redactSensitivePatterns\(rawText\)\.slice\(0, 120_000\)/.test(aiParse)
  );
  check(
    "the identity prompt does the same, in the same order",
    /redactSensitivePatterns\(decryptText\(report\.rawText\)\)\.slice\(0, 120_000\)/.test(
      codeOf(read(IDENTITY_ROUTE))
    )
  );
  check(
    "the deterministic parser is untouched — it reads the ORIGINAL text",
    !/redactSensitivePatterns/.test(codeOf(read("lib/parse.ts")))
  );
  check(
    "…and so is the pure AI→tradeline mapping the credit-truth fixtures exercise",
    !/redactSensitivePatterns/.test(
      (aiParse.match(/export function toExtractedTradelines[\s\S]*$/) || [""])[0]
    )
  );

  console.log(`\ndisclosure-truth.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
