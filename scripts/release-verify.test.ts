// Run: npx tsx scripts/release-verify.test.ts
//
// DB-free adversarial fixtures for release-header parsing. The fake curl command
// never opens a network connection.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean): void {
  if (condition) pass++;
  else {
    fail++;
    console.error("FAIL: " + label);
  }
}

const root = join(__dirname, "..");
const expectedSha = "a".repeat(40);
const expectedRelease = expectedSha.slice(0, 12);
const fixtureDir = mkdtempSync(join(tmpdir(), "release-verify-"));
const fakeCurl = join(fixtureDir, "curl");

writeFileSync(
  fakeCurl,
  [
    "#!/usr/bin/env bash",
    "set -eu",
    'if [ -n "${GATE_D_TEST_CURL_MARKER:-}" ]; then',
    '  : > "$GATE_D_TEST_CURL_MARKER"',
    "fi",
    'if [ "$1" = "-sI" ]; then',
    '  printf "%s" "$GATE_D_TEST_HEADERS"',
    "  exit 0",
    "fi",
    'if [ "$1" = "-s" ] && [ "$2" = "-o" ]; then',
    '  case "$6" in',
    "    */api/health/ready) printf '%s' \"${GATE_D_TEST_READY_CODE:-200}\" ;;",
    "    */api/letters) printf '401' ;;",
    "    */api/admin/overview|*/api/admin/diagnostics) printf '403' ;;",
    "    *) printf '200' ;;",
    "  esac",
    "  exit 0",
    "fi",
    "case \"${2:-}\" in",
    "  */api/health/ready) printf '%s' \"${GATE_D_TEST_READY_BODY:-{\\\"status\\\":\\\"ready\\\",\\\"db\\\":\\\"ok\\\",\\\"encryption\\\":\\\"ok\\\",\\\"schema\\\":\\\"ok\\\"}}\"; exit 0 ;;",
    "esac",
    "printf '{}'",
    "",
  ].join("\n"),
);
chmodSync(fakeCurl, 0o700);

function headers(releaseLines: string[], status = "HTTP/2 200"): string {
  return [
    status,
    "x-content-type-options: nosniff",
    "x-frame-options: SAMEORIGIN",
    "referrer-policy: no-referrer",
    "strict-transport-security: max-age=1",
    "permissions-policy: geolocation=()",
    ...releaseLines,
    "",
    "",
  ].join("\r\n");
}

const READY_OK = '{"status":"ready","db":"ok","encryption":"ok","schema":"ok"}';

function runResult(headerBlock: string, readyCode = "200", readyBody = READY_OK) {
  const result = spawnSync(
    "bash",
    [join(root, "scripts", "release-verify.sh"), "https://example.invalid", expectedSha],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GATE_D_TEST_HEADERS: headerBlock,
        GATE_D_TEST_READY_CODE: readyCode,
        GATE_D_TEST_READY_BODY: readyBody,
        PATH: fixtureDir + ":" + (process.env.PATH || ""),
      },
    },
  );
  return { status: result.status, stdout: result.stdout };
}

function run(headerBlock: string, readyCode = "200", readyBody = READY_OK): number | null {
  return runResult(headerBlock, readyCode, readyBody).status;
}

function runWithoutTarget(): { curlInvoked: boolean; status: number | null } {
  const curlMarker = join(fixtureDir, "curl-without-target");
  const result = spawnSync("bash", [join(root, "scripts", "release-verify.sh")], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GATE_D_TEST_CURL_MARKER: curlMarker,
      GATE_D_TEST_HEADERS: headers(["x-cv-release: " + expectedRelease]),
      PATH: fixtureDir + ":" + (process.env.PATH || ""),
    },
  });
  return { curlInvoked: existsSync(curlMarker), status: result.status };
}

try {
  {
    const result = runWithoutTarget();
    check("release verifier requires an explicit target before curl", result.status === 64 && !result.curlInvoked);
  }
  check("exact single release header passes", run(headers(["x-cv-release: " + expectedRelease])) === 0);
  check(
    "database readiness failure fails the release gate",
    run(headers(["x-cv-release: " + expectedRelease]), "503") !== 0,
  );

  // S11 · X-1/X-6. A deployment promoted before `prisma migrate deploy` has run
  // leaves POST /api/register throwing with no try/catch — nobody can create an
  // account — and until this release nothing outside the database could tell.
  // The gate must refuse the promotion and must NAME the dependency.
  {
    const result = runResult(
      headers(["x-cv-release: " + expectedRelease]),
      "503",
      '{"status":"degraded","db":"ok","encryption":"ok","schema":"incomplete","missingTables":["TermsAcceptance"]}',
    );
    check(
      "a deployment whose migrations were never applied fails the release gate",
      result.status !== 0,
    );
    check(
      "schema failure output grants no authority and directs the operator to Gate-D",
      /FAIL schema/.test(result.stdout) &&
        /NON-AUTHORIZING/.test(result.stdout) &&
        /grants no database or migration authority/i.test(result.stdout) &&
        /do not run a migration from this verifier/i.test(result.stdout) &&
        /\.ai\/RUNBOOKS\/gate-d-production-migration\.md/.test(result.stdout) &&
        !/\bprisma\s+migrate\s+deploy\b/.test(result.stdout),
    );
  }
  check(
    "an unusable DOCUMENT_ENCRYPTION_KEY fails the release gate",
    run(
      headers(["x-cv-release: " + expectedRelease]),
      "503",
      '{"status":"degraded","db":"ok","encryption":"unavailable","schema":"ok"}',
    ) !== 0,
  );
  // Non-vacuity for the two above: a 200 status code alone must NOT be enough —
  // the body has to agree, or the checks would pass on a probe that lies.
  check(
    "a 200 readiness whose body reports incomplete schema still fails",
    run(
      headers(["x-cv-release: " + expectedRelease]),
      "200",
      '{"status":"ready","db":"ok","encryption":"ok","schema":"incomplete"}',
    ) !== 0,
  );
  check(
    "a fully green readiness body passes (control)",
    run(headers(["x-cv-release: " + expectedRelease]), "200", READY_OK) === 0,
  );

  // ── The written release procedure (S11 · X-1 step 2, X-2) ──────────────────
  // The ordering these guards enforce at runtime has to exist in the documents an
  // operator actually follows, or the detection only tells them something is
  // wrong without telling them what to do. Pinned so a doc edit cannot silently
  // drop it.
  const deployRunbook = readFileSync(join(root, ".ai", "RUNBOOKS", "deploy.md"), "utf8");
  const deployDoc = readFileSync(join(root, "DEPLOY.md"), "utf8");
  const operations = readFileSync(join(root, "OPERATIONS.md"), "utf8");
  const gateDRunbook = readFileSync(
    join(root, ".ai", "RUNBOOKS", "gate-d-production-migration.md"),
    "utf8",
  );
  const releaseScript = readFileSync(join(root, "scripts", "release-verify.sh"), "utf8");

  check(
    "release verifier contains no Production migration shortcut",
    !/\bprisma\s+migrate\s+deploy\b/.test(releaseScript),
  );
  check(
    "release verifier is non-authorizing and sends schema failures to authoritative Gate-D",
    /NON-AUTHORIZING/.test(releaseScript) &&
      /grants no database or migration authority/i.test(releaseScript) &&
      /do not run a migration from this verifier/i.test(releaseScript) &&
      /\.ai\/RUNBOOKS\/gate-d-production-migration\.md/.test(releaseScript) &&
      /separate Founder authority/i.test(releaseScript),
  );

  const fencedCodeBlocks = (doc: string): string[] =>
    Array.from(doc.matchAll(/```[^\n]*\n([\s\S]*?)```/g), (match) => match[1]);
  const fencedMigrationCommandLines = (doc: string): string[] =>
    fencedCodeBlocks(doc)
      .flatMap((block) => block.split("\n"))
      .map((line) => line.trim())
      .filter((line) => /\bprisma\s+migrate\s+deploy\b/.test(line));

  const rootProductionStart = deployDoc.indexOf(
    "## Canonical RC1 migration history — held post-DB5 state",
  );
  const rootProductionEnd = deployDoc.indexOf("## Spend and probe knobs", rootProductionStart);
  const rootLocalStart = deployDoc.indexOf("## Option B — Self-host with Docker/Compose");
  const rootLocalEnd = deployDoc.indexOf("## Install as a DESKTOP app", rootLocalStart);
  const rootSectionsLocated =
    rootProductionStart >= 0 &&
    rootProductionEnd > rootProductionStart &&
    rootLocalStart > rootProductionEnd &&
    rootLocalEnd > rootLocalStart;
  check("DEPLOY.md production/local command scopes are located non-vacuously", rootSectionsLocated);
  const rootProduction = rootSectionsLocated
    ? deployDoc.slice(rootProductionStart, rootProductionEnd)
    : "";
  const rootLocal = rootSectionsLocated ? deployDoc.slice(rootLocalStart, rootLocalEnd) : "";
  const rootOutsideLocal = rootSectionsLocated
    ? deployDoc.slice(0, rootLocalStart) + deployDoc.slice(rootLocalEnd)
    : deployDoc;

  for (const [label, doc] of [
    ["the shortcut deploy runbook", deployRunbook],
    ["DEPLOY.md Production section", rootProduction],
    ["OPERATIONS.md", operations],
  ] as const) {
    check(
      `${label} delegates Production execution to authoritative Gate-D`,
      /gate-d-production-migration\.md/.test(doc),
    );
    check(
      `${label} explicitly grants no migration authority`,
      /does not authorize|grants no[\s\S]{0,120}(?:database|migration)[\s\S]{0,120}authority|non-authorizing/i.test(
        doc,
      ),
    );
    check(
      `${label} reproduces no executable Production migrate-deploy command`,
      fencedMigrationCommandLines(doc).length === 0,
    );
    check(
      `${label} blocks replay of historical DB5`,
      /do not replay|does not authorize replay|not replay authority|never authorizes replay/i.test(
        doc,
      ),
    );
  }
  // POST-DB5 LANDING RECONCILIATION.
  //
  // The held canonicalization slice rewrote DEPLOY.md's Production section and in
  // doing so dropped the governed prerequisites the completed DB-5 act ran behind.
  // These assertions pin the reconciliation. Read the split precisely:
  //
  //   * SEVEN POSITIVE assertions catch DELETION. Verified: all seven fire against
  //     the unreconciled document.
  //   * ONE TRIPWIRE catches a NAMED, ENUMERATED set of negating phrases. It is NOT
  //     a semantic guarantee and must never be described as one. Prose cannot be
  //     verified by regex; this raises the cost of a silent inversion, nothing more.
  //   * ONE LOCATOR proves the section exists before the rest are evaluated.
  //
  // Two design rules, both learned by getting them wrong:
  //   1. NO SCRUBBING. An earlier version stripped quoted evidence identifiers to
  //      end-of-line before scanning. That scrub WAS the bypass: negations placed on
  //      the same line as the quoted token vanished before the guard ran, while
  //      rendering normally. Tripwires are specific enough not to need a scrub.
  //   2. Scan the WHOLE document, not just the canonical section. A section-scoped
  //      guard is escaped by writing one line past the section heading.
  const canonStart = deployDoc.indexOf(
    "## Canonical RC1 migration history — held post-DB5 state",
  );
  const canonEnd = deployDoc.indexOf("## Spend and probe knobs", canonStart);
  const canonSection = canonStart >= 0 && canonEnd > canonStart
    ? deployDoc.slice(canonStart, canonEnd)
    : "";
  check(
    "DEPLOY.md canonical section is located non-vacuously for the reconciliation checks",
    canonSection.length > 0,
  );
  check(
    "DEPLOY.md records the governed credential/TLS/fingerprint/backup gate behind DB-5",
    /credential[\s\S]{0,40}TLS[\s\S]{0,40}fingerprint[\s\S]{0,40}backup/i.test(canonSection) &&
      /fresh hardened backup was completed and accepted/i.test(canonSection),
  );
  check(
    "DEPLOY.md scopes the TLS claim the way the DB-5 manifest scopes it",
    /sslmode=require&sslaccept=strict/.test(canonSection) &&
      /chain\*{0,2} half was measured directly/i.test(canonSection) &&
      /client-to-endpoint hop/i.test(canonSection) &&
      /not claimed/i.test(canonSection),
  );
  check(
    "DEPLOY.md does not present the fingerprint gate as peer authentication",
    /CONSISTENCY_EVIDENCE_ONLY/.test(canonSection) &&
      /is not peer\s+authentication/i.test(canonSection),
  );
  check(
    "DEPLOY.md cites the raw DB-5 verifier failure rather than only paraphrasing it",
    /DB5_APPLIED_BUT_VERIFICATION_FAILED/.test(canonSection) &&
      /D5V_VERDICT=FAIL/.test(canonSection) &&
      /repo-archive\/2026-08-29-db5-migration/.test(canonSection),
  );
  check(
    "DEPLOY.md defers future production DB acts to the authoritative runbook, not to its own past tense",
    /remains controlling/i.test(canonSection) &&
      /never\s+inferred from the past-tense prose/i.test(canonSection),
  );
  check(
    "DEPLOY.md does not turn this release's rotation into a standing rule for every deploy",
    /not a standing rule that\s+every future deploy requires a credential rotation/i.test(
      canonSection,
    ),
  );
  check(
    "DEPLOY.md claims no independent provider-side proof of credential rotation",
    /Control Tower attested/i.test(canonSection) &&
      /no independent\s+provider-side artifact proving it/i.test(canonSection),
  );
  // The tripwire. Each entry is a phrase with NO legitimate use in this document,
  // chosen so that adverbs, passive/active voice and re-ordering do not evade it
  // ("waived" catches "was formally waived" and "Control Tower waived the gate"
  // alike). It deliberately does NOT use broad grammar patterns: an earlier version
  // fired on "Never proceed without a fresh hardened backup" -- a control-
  // STRENGTHENING sentence -- and a guard that fires on honest text gets edited
  // until it guards nothing.
  const negationTripwires: ReadonlyArray<readonly [string, RegExp]> = [
    ["control waived", /\bwaive[dr]\b/i],
    ["control declared no longer required", /no longer (required|mandatory|necessary)/i],
    [
      "credential reuse",
      /(reuse|re-use|keep using|continue using)[^.]{0,40}(old|previous|prior|exposed|same) credential/i,
    ],
    ["replay instruction", /(must|should|may|can|shall) be replayed|\breplay (both|the two) migrations\b/i],
    ["backup skipped", /no fresh hardened backup|backup[^.]{0,24}\bskipped\b/i],
    ["partial migration", /partially applied|partial migration|\bdid not land\b/i],
    ["peer-authentication overstatement returning", /peer-authenticated/i],
    ["verification overstatement", /fully verified clean|verified clean end to end/i],
  ];
  const trippedPhrases = negationTripwires
    .filter(([, pattern]) => pattern.test(deployDoc))
    .map(([label]) => label);
  check(
    `DEPLOY.md trips no enumerated negation/overstatement phrase${trippedPhrases.length ? ` (tripped: ${trippedPhrases.join(", ")})` : ""}`,
    trippedPhrases.length === 0,
  );

  check(
    "DEPLOY.md permits migrate-deploy only as the disposable-local Compose command",
    fencedMigrationCommandLines(rootOutsideLocal).length === 0 &&
      fencedMigrationCommandLines(rootLocal).every(
        (line) =>
          line === "docker compose run --rm web npx --no-install prisma migrate deploy",
      ) &&
      /disposable[\s\S]{0,100}local|non-production local/i.test(rootLocal),
  );

  const gateDDeployStart = gateDRunbook.indexOf("## 9. DB5 deploy — Founder approval point 4");
  const gateDDeployEnd = gateDRunbook.indexOf("## 10. Interrupted migration recovery", gateDDeployStart);
  const gateDDeploySection =
    gateDDeployStart >= 0 && gateDDeployEnd > gateDDeployStart
      ? gateDRunbook.slice(gateDDeployStart, gateDDeployEnd)
      : "";
  check("Gate-D DB5 execution section is located non-vacuously", gateDDeploySection.length > 0);
  const gateDDeployBlocks = fencedCodeBlocks(gateDDeploySection).filter((block) =>
    /\bprisma\s+migrate\s+deploy\b/.test(block),
  );
  check(
    "Gate-D retains exactly one historical DB5 command on its validated direct target",
    gateDDeployBlocks.length === 1 &&
      (gateDDeployBlocks[0].match(/\bprisma\s+migrate\s+deploy\b/g) || []).length === 1 &&
      /DATABASE_URL="\$\{GATE_D_DATABASE_URL\}"/.test(gateDDeployBlocks[0]) &&
      /Use a direct PostgreSQL connection, never an Accelerate URL/.test(gateDRunbook),
  );
  check(
    "Gate-D marks the retained DB5 command historical and forbids replay",
    /Historical procedure only/.test(gateDDeploySection) &&
      /must not be replayed/i.test(gateDDeploySection) &&
      /Missing evidence blocks\s+canonicalization/i.test(gateDDeploySection),
  );
  check(
    "Gate-D pins one lexical DB5 deploy and forbids staged --to",
    /one command applies both pending DB5 migrations in their existing lexical\s+order/i.test(
      gateDDeploySection,
    ) && /Do not attempt staged `--to` deployment/.test(gateDDeploySection),
  );
  check(
    "Gate-D requires credential rotation before the next DB contact",
    /Rotate it \*\*before the next production DB contact, including DB4\*\*/.test(gateDRunbook) &&
      /previously exposed production credential/i.test(gateDRunbook),
  );
  check(
    "Gate-D requires accepted DB4 plus a fresh hardened pre-DB5 backup",
    /Control Tower accepted DB4's read-only output/.test(gateDDeploySection) &&
      /new hardened production backup[\s\S]{0,300}immediately before\s+DB5/i.test(
        gateDDeploySection,
      ),
  );
  check(
    "Gate-D makes the post-DB5 patch held and preconditioned on retained evidence",
    /HELD POST-DB5 CANONICALIZATION/.test(gateDRunbook) &&
      /may land only after[\s\S]{0,180}retains successful DB5 output/i.test(gateDRunbook) &&
      /source patch[\s\S]{0,120}not evidence/i.test(gateDRunbook),
  );
  check(
    "Gate-D pins the healthy canonical eight postcondition without replay authority",
    /all eight canonical migrations `ALL_PRESENT_AND_MATCHING`/.test(gateDRunbook) &&
      /preDb5AbsenceGate=NOT_REQUIRED/.test(gateDRunbook) &&
      /empty `deployCandidateList`/.test(gateDRunbook) &&
      /`NO_PENDING_MIGRATIONS`/.test(gateDRunbook) &&
      /Do not use the[\s\S]{0,80}historical §9 command to make it green/i.test(gateDRunbook),
  );
  check(
    "Gate-D pins both DB5 names/checksums in lexical order",
    gateDRunbook.indexOf(
      "20260728000000_terms_acceptance` — `d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922",
    ) > -1 &&
      gateDRunbook.indexOf(
        "20260823120000_consumer_assertion` — `d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0",
      ) > gateDRunbook.indexOf("20260728000000_terms_acceptance"),
  );
  check(
    "the deploy runbook names both required migrations, in order",
    deployRunbook.indexOf("20260728000000_terms_acceptance") > -1 &&
      deployRunbook.indexOf("20260823120000_consumer_assertion") >
        deployRunbook.indexOf("20260728000000_terms_acceptance"),
  );
  for (const table of ["TermsAcceptance", "ConsumerAssertion"]) {
    check(`OPERATIONS.md restore names ${table} among the tables to verify`, operations.includes(table));
  }
  // ── The spend knobs must be documented where an operator looks (S11 · CE2-3) ──
  // A $50/day platform-wide AI ceiling with a working default is invisible until
  // it binds: ~50 consumers at the $1.00 per-consumer default reach it, and from
  // then until 00:00 UTC every consumer is told AI analysis is paused. Nothing
  // fails, so nothing surfaces it — which is why it has to be written down.
  for (const [label, doc] of [
    ["the deploy runbook", deployRunbook],
    ["DEPLOY.md", deployDoc],
    ["OPERATIONS.md", operations],
  ] as const) {
    check(`${label} names AI_DAILY_BUDGET_USD_GLOBAL`, doc.includes("AI_DAILY_BUDGET_USD_GLOBAL"));
    check(`${label} names AI_DAILY_BUDGET_USD_PER_USER`, doc.includes("AI_DAILY_BUDGET_USD_PER_USER"));
    check(`${label} names HEALTH_READY_DB_TTL_MS`, doc.includes("HEALTH_READY_DB_TTL_MS"));
    check(`${label} states the platform default (50)`, /\b50(?:\.00)?\b/.test(doc));
    check(`${label} says the global ceiling is a Founder decision`, /Founder decision/i.test(doc));
    check(
      `${label} states the symptom — a product-wide AI pause until midnight UTC`,
      /paused/i.test(doc) && /UTC/.test(doc)
    );
  }
  check(
    "release-verify.sh prints the configured ceilings so a promotion records them",
    /AI_DAILY_BUDGET_USD_GLOBAL/.test(releaseScript) &&
      /AI_DAILY_BUDGET_USD_PER_USER/.test(releaseScript) &&
      /HEALTH_READY_DB_TTL_MS/.test(releaseScript)
  );

  check(
    "OPERATIONS.md no longer claims a restored DB needs no migration step",
    !/a restore does not need a\s*\n?separate migration step[\s\S]{0,200}$/m.test(operations) &&
      /no longer sufficient on its own/i.test(operations),
  );
  check(
    "trailing release-header token fails",
    run(headers(["x-cv-release: " + expectedRelease + " trailing-token"])) !== 0,
  );
  check(
    "duplicate release headers fail",
    run(headers(["x-cv-release: " + expectedRelease, "x-cv-release: " + expectedRelease])) !== 0,
  );
  check(
    "combined release-header values fail",
    run(headers(["x-cv-release: " + expectedRelease + ",other"])) !== 0,
  );
  check(
    "prefixed release-header value fails",
    run(headers(["x-cv-release: prefix-" + expectedRelease])) !== 0,
  );
  check(
    "internal release-header whitespace fails",
    run(headers(["x-cv-release: " + expectedRelease + " extra"])) !== 0,
  );
  check(
    "folded release-header value fails",
    run(headers(["x-cv-release: " + expectedRelease, "\ttrailing-token"])) !== 0,
  );
  check("missing release header fails", run(headers([])) !== 0);
  check(
    "interim release header cannot satisfy a final response missing it",
    run(
      headers(["x-cv-release: " + expectedRelease], "HTTP/1.1 100 Continue") +
        headers([]),
    ) !== 0,
  );
  check(
    "final release header supersedes malformed interim header",
    run(
      headers(["x-cv-release: malformed"], "HTTP/1.1 100 Continue") +
        headers(["x-cv-release: " + expectedRelease]),
    ) === 0,
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log("\nrelease-verify.test.ts: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
