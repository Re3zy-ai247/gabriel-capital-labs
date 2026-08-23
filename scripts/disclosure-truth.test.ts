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
//   · Unmodified slice tree: **64 passed, 0 failed** (exit 0).
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
  // ── COVERAGE, not call-site count (review H-1) ──────────────────────────────
  // The first version of this check asserted "redaction happens in exactly one
  // place". That pinned the wrong invariant: it was satisfied while a SECOND
  // surface — the identity check — shipped the same report text to the same
  // provider unmasked, and it would have FAILED the correct fix. The invariant
  // the privacy policy actually makes is EVERY credit-report transmission is
  // masked, so the transmitter set is DERIVED from the tree rather than listed
  // here, and each member must redact. A third transmitter added later is
  // checked automatically instead of shipping unnoticed.
  //
  // "Transmits credit-report text" = calls meteredMessage AND handles rawText,
  // which is Report.rawText, the credit report itself. That deliberately does
  // NOT include app/api/letters/[id]/round2/route.ts: it sends `responseText`,
  // the bureau reply the consumer pasted in — a different data class, disclosed
  // separately on the privacy page and explicitly excluded from the masking
  // sentence there. It is also outside this slice's owned paths.
  function walkSources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walkSources(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  }
  const transmitters = [...walkSources("app"), ...walkSources("lib")]
    .filter((rel) => {
      const code = codeOf(read(rel));
      return /meteredMessage\(/.test(code) && /rawText/.test(code);
    })
    .sort();
  check(
    `the transmitter sweep found sources (coverage below is not vacuous) — ${transmitters.join(", ") || "NONE"}`,
    transmitters.length >= 2
  );
  check(
    "the sweep still finds both known transmitters (a rename must not silently shrink it)",
    transmitters.includes("lib/aiParse.ts") &&
      transmitters.includes("app/api/identity/discrepancies/route.ts")
  );
  for (const rel of transmitters) {
    check(
      `${rel}: redacts the report text before it is transmitted`,
      /redactSensitivePatterns\(/.test(codeOf(read(rel)))
    );
  }
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
