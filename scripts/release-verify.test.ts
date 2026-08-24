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

function run(headerBlock: string, readyCode = "200", readyBody = READY_OK): number | null {
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
  return result.status;
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
  check(
    "a deployment whose migrations were never applied fails the release gate",
    run(
      headers(["x-cv-release: " + expectedRelease]),
      "503",
      '{"status":"degraded","db":"ok","encryption":"ok","schema":"incomplete","missingTables":["TermsAcceptance"]}',
    ) !== 0,
  );
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
  for (const [label, doc] of [
    ["the deploy runbook", deployRunbook],
    ["DEPLOY.md", deployDoc],
    ["OPERATIONS.md (restore)", operations],
  ] as const) {
    check(`${label} names \`prisma migrate deploy\``, /prisma migrate deploy/.test(doc));
    check(
      `${label} warns that the apply must use the DIRECT url, not Accelerate`,
      /DIRECT/i.test(doc) && /Accelerate/i.test(doc),
    );
  }
  check(
    "the deploy runbook names both required migrations, in order",
    deployRunbook.indexOf("20260728000000_terms_acceptance") > -1 &&
      deployRunbook.indexOf("20260823120000_consumer_assertion") >
        deployRunbook.indexOf("20260728000000_terms_acceptance"),
  );
  for (const table of ["TermsAcceptance", "ConsumerAssertion"]) {
    check(`OPERATIONS.md restore names ${table} among the tables to verify`, operations.includes(table));
  }
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
