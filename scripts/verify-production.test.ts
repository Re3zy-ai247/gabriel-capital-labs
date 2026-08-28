// Run: npx --no-install tsx scripts/verify-production.test.ts
//
// Executable regression proof for the production probes. The PATH-leading curl
// double never opens a socket: every apparent request is recorded locally and
// answered from the test-only status-code variables below.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const verifier = readFileSync(join(root, "scripts/verify-production.sh"), "utf8");
const bootstrapRoute = readFileSync(join(root, "app/api/admin/bootstrap/route.ts"), "utf8");
const fixtureDir = mkdtempSync(join(tmpdir(), "verify-production-"));
const fakeCurl = join(fixtureDir, "curl");
const curlLog = join(fixtureDir, "curl.log");

writeFileSync(
  fakeCurl,
  [
    "#!/usr/bin/env bash",
    "set -eu",
    'url=""',
    'for arg in "$@"; do',
    '  case "$arg" in https://*) url="$arg" ;; esac',
    "done",
    'printf "%s\\t%s\\n" "$url" "$*" >> "$CV_VERIFY_TEST_CURL_LOG"',
    'case "$url" in',
    '  */api/admin/bootstrap) printf "%s" "$CV_VERIFY_TEST_BOOTSTRAP_CODE" ;;',
    '  */api/admin/migrate) printf "%s" "$CV_VERIFY_TEST_MIGRATE_CODE" ;;',
    "  */api/stripe/webhook) printf '400' ;;",
    "  *) printf '403' ;;",
    "esac",
    "",
  ].join("\n"),
);
chmodSync(fakeCurl, 0o700);

type ProbeResult = {
  calls: string[];
  output: string;
};

function runProbe(bootstrapCode: string, migrateCode = "404"): ProbeResult {
  writeFileSync(curlLog, "");
  const result = spawnSync("bash", [join(root, "scripts/verify-production.sh"), "--probe"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CV_BASE_URL: "https://example.invalid",
      CV_VERIFY_TEST_BOOTSTRAP_CODE: bootstrapCode,
      CV_VERIFY_TEST_MIGRATE_CODE: migrateCode,
      CV_VERIFY_TEST_CURL_LOG: curlLog,
      PATH: fixtureDir + ":" + (process.env.PATH || ""),
    },
  });
  return {
    calls: readFileSync(curlLog, "utf8").trim().split("\n").filter(Boolean),
    output: (result.stdout || "") + (result.stderr || ""),
  };
}

try {
  const developmentGuard = bootstrapRoute.indexOf('process.env.NODE_ENV !== "development"');
  const notFound = bootstrapRoute.indexOf("status: 404", developmentGuard);
  const secretRead = bootstrapRoute.indexOf("process.env.SETUP_SECRET");
  const seedCall = bootstrapRoute.indexOf("seedDemoUser(prisma)");
  check(
    "the route contract is 404 before secret handling or seeding outside development",
    developmentGuard !== -1 &&
      notFound > developmentGuard &&
      notFound < secretRead &&
      notFound < seedCall,
  );
  check(
    "the verifier explicitly refuses to treat the probe as a presence oracle",
    verifier.includes("it cannot determine whether SETUP_SECRET is set"),
  );
  check(
    "the obsolete secret-presence inference is absent",
    !verifier.includes("the secret IS configured") &&
      !verifier.includes("bootstrap answers 503") &&
      !verifier.includes("SETUP_SECRET presence probe"),
  );

  const contained = runProbe("404");
  check(
    "404 passes the public non-development containment check",
    contained.output.includes(
      "PASS                         bootstrap unavailable outside development — HTTP 404",
    ),
  );
  check(
    "the executable probe uses only the fake example.invalid transport",
    contained.calls.length === 7 &&
      contained.calls.every((call) => call.startsWith("https://example.invalid/")),
  );
  check(
    "the bootstrap probe remains an empty-body POST",
    contained.calls.some(
      (call) =>
        call.includes("/api/admin/bootstrap") &&
        call.includes("-X POST") &&
        call.includes("-d {}"),
    ),
  );
  const migrateCall = contained.calls.find((call) => call.includes("/api/admin/migrate"));
  check(
    "the removed migration route is probed with default GET and no request body",
    typeof migrateCall === "string" &&
      !migrateCall.includes("-X POST") &&
      !migrateCall.includes("-d {}"),
  );
  check(
    "404 passes only as proof that the retired migration route is absent",
    contained.output.includes(
      "PASS                         legacy admin migrate route absent — HTTP 404",
    ),
  );

  const stalePostOnlyRoute = runProbe("404", "405");
  check(
    "405 fails as a stale POST-only migration route without invoking POST",
    stalePostOnlyRoute.output.includes(
      "FAIL                         legacy admin migrate route absent — HTTP 405 — stale or exposed route remains deployed",
    ) &&
      stalePostOnlyRoute.calls.some(
        (call) =>
          call.includes("/api/admin/migrate") &&
          !call.includes("-X POST") &&
          !call.includes("-d {}"),
      ),
  );

  for (const code of ["403", "503"]) {
    const exposedBranch = runProbe(code);
    check(
      `${code} fails against the non-development 404 contract without inferring a secret`,
      exposedBranch.output.includes(
        `FAIL                         bootstrap unavailable outside development — HTTP ${code} — expected the non-development 404`,
      ) &&
        !exposedBranch.output.includes("the secret IS configured") &&
        !exposedBranch.output.includes("bootstrap answers 503"),
    );
  }

  const enabled = runProbe("200");
  check(
    "200 fails because the public bootstrap surface is enabled",
    enabled.output.includes(
      "FAIL                         bootstrap unavailable outside development — HTTP 200 — expected 404",
    ),
  );

  const unreachable = runProbe("000");
  check(
    "a network failure stays an environment result rather than a pass",
    unreachable.output.includes(
      "NOT RUN — ENVIRONMENT        bootstrap containment probe — no response",
    ),
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log(`\nverify-production.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
