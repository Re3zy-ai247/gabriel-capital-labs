// Run: npx tsx scripts/release-verify.test.ts
//
// DB-free adversarial fixtures for release-header parsing. The fake curl command
// never opens a network connection.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    'if [ "$1" = "-sI" ]; then',
    '  printf "%s" "$GATE_D_TEST_HEADERS"',
    "  exit 0",
    "fi",
    'if [ "$1" = "-s" ] && [ "$2" = "-o" ]; then',
    '  case "$6" in',
    "    */api/letters) printf '401' ;;",
    "    */api/admin/overview|*/api/admin/diagnostics) printf '403' ;;",
    "    *) printf '200' ;;",
    "  esac",
    "  exit 0",
    "fi",
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

function run(headerBlock: string): number | null {
  const result = spawnSync(
    "bash",
    [join(root, "scripts", "release-verify.sh"), "https://example.invalid", expectedSha],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GATE_D_TEST_HEADERS: headerBlock,
        PATH: fixtureDir + ":" + (process.env.PATH || ""),
      },
    },
  );
  return result.status;
}

try {
  check("exact single release header passes", run(headers(["x-cv-release: " + expectedRelease])) === 0);
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
