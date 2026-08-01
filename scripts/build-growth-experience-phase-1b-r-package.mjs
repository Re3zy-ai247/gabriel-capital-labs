#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
export const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");

export const EXPECTED_BASELINE_SHA =
  "a40a41c5a76028ad5cae2ff655c5bf168fb86a4a";
export const EXPECTED_BRANCH =
  "review/growth-experience-phase-1b-remediation-rc1";
export const ZIP_NAME =
  "GROWTH_EXPERIENCE_PHASE_1B_R_FOUNDER_PACKAGE.zip";
export const EVIDENCE_ROOT_NAME =
  "GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE";
export const EVIDENCE_ROOT = join(REPOSITORY_ROOT, EVIDENCE_ROOT_NAME);
export const EVIDENCE_SCHEMA_VERSION = 3;
const MAX_OBSERVED_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const AUTHORIZED_CANDIDATE_CHANGES = Object.freeze({
  ".ai/CURRENT-STATE.md": "M",
  ".ai/DECISIONS.md": "M",
  ".ai/INDEX.md": "M",
  ".ai/TESTING.md": "M",
  ".ai/ADR/ADR-0039-growth-network-foundation.md": "A",
  ".ai/ADR/ADR-0040-cxos-core-runtime.md": "A",
  ".ai/ADR/ADR-0041-growth-center-foundation-preview.md": "A",
  ".ai/ADR/ADR-0042-growth-experience-phase-1b-capability-contract.md": "A",
  "GROWTH_EXPERIENCE_PHASE_1B_ARCHITECTURE.md": "A",
  "GROWTH_EXPERIENCE_PHASE_1B_CAPABILITY_CONTRACT.md": "A",
  "GROWTH_EXPERIENCE_PHASE_1B_PRODUCT_SPEC.md": "A",
  "app/layout.tsx": "M",
  "app/review/layout.tsx": "M",
  "app/review/growth-center/capability-contract/capability-contract.module.css": "A",
  "app/review/growth-center/capability-contract/page.tsx": "A",
  "app/review/growth-center/capability-contract/stage.tsx": "A",
  "app/review/growth-center/growth-center.module.css": "A",
  "app/review/growth-center/page.tsx": "A",
  "app/review/growth-center/stage.tsx": "A",
  "components/cxos/runtime/useCxosRoomRuntime.ts": "A",
  "lib/cxos/reviewMode.ts": "M",
  "lib/cxos/runtime.ts": "A",
  "lib/growthNetwork/capabilityContract.ts": "A",
  "lib/growthNetwork/capabilityPreviewFlags.ts": "A",
  "lib/growthNetwork/experience.ts": "A",
  "lib/growthNetwork/flags.ts": "A",
  "lib/growthNetwork/foundation.ts": "A",
  "lib/growthNetwork/index.ts": "A",
  "lib/growthNetwork/previewFlags.ts": "A",
  "scripts/build-growth-experience-phase-1b-r-package.mjs": "A",
  "scripts/cxos-core-runtime.test.ts": "A",
  "scripts/cxos-review.test.ts": "M",
  "scripts/growth-capability-contract.test.ts": "A",
  "scripts/growth-capability-preview-env-matrix.test.ts": "A",
  "scripts/growth-center-foundation.test.ts": "A",
  "scripts/growth-network-foundation.test.ts": "A",
  "scripts/validate-growth-experience-phase-1b-r-package.mjs": "A",
});

export const AUTHORIZED_CANDIDATE_PATHS = Object.freeze(
  Object.keys(AUTHORIZED_CANDIDATE_CHANGES),
);

export const PACKAGE_MEMBERS = Object.freeze([
  "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.md",
  "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.txt",
  "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_VALIDATION_LEDGER.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_BROWSER_MATRIX.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE_MANIFEST.txt",
  "GROWTH_EXPERIENCE_PHASE_1B_R_DEPLOYMENT_BOM.txt",
  "GROWTH_EXPERIENCE_PHASE_1B_R_FOUNDER_DECISION_RECEIPT.html",
]);

export const HASHED_MEMBERS = Object.freeze(
  PACKAGE_MEMBERS.filter(
    (name) =>
      name !== "GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE_MANIFEST.txt",
  ),
);

export const EVIDENCE_RESULTS = Object.freeze([
  "PASS",
  "FAIL",
  "NOT RUN",
  "NOT APPLICABLE",
  "BLOCKED",
]);

export const RAW_EVIDENCE_KINDS = Object.freeze([
  "COMMAND_LOG",
  "GIT_PROVENANCE",
  "BUILD_LOG",
  "BROWSER_TRACE",
  "ACCESSIBILITY_REPORT",
  "DEPLOYMENT_ASSERTION",
  "SECURITY_SCAN",
  "PACKAGE_ASSERTION",
  "HUMAN_REVIEW",
]);

export const EXECUTABLE_RAW_EVIDENCE_KINDS = Object.freeze([
  "COMMAND_LOG",
  "GIT_PROVENANCE",
  "BUILD_LOG",
  "BROWSER_TRACE",
  "ACCESSIBILITY_REPORT",
  "SECURITY_SCAN",
  "PACKAGE_ASSERTION",
]);

export const RAW_EVIDENCE_ENVELOPE_FIELDS = Object.freeze([
  "candidateSha",
  "evidenceKind",
  "claimIds",
  "executed",
  "exitCode",
  "result",
  "capturedAt",
  "path",
  "bytes",
  "sha256",
]);

export const CANONICAL_EXCLUSIONS = Object.freeze([
  "No merge is authorized or included.",
  "No production deployment, promotion, or alias mutation is authorized or included.",
  "No persistent project-setting or environment-value change is authorized or included.",
  "No schema change or migration is authorized or included.",
  "No participant data, participant access, or enrollment is authorized or included.",
  "No runtime AI, model, prompt, memory, or action capability is authorized or included.",
  "No Community or Marketplace mutation is authorized or included.",
  "No billing, commerce, tax, ledger, payout, or economic activation is authorized or included.",
  "Spatial Runtime 2.0 is not authorized or included.",
  "No unrelated stream change or visual redesign is authorized or included.",
]);

export const REQUIRED_VALIDATION_IDS = Object.freeze([
  "clean-worktree-reproducibility",
  "lineage-and-sha",
  "exact-file-allowlist",
  "git-diff-check",
  "typecheck",
  "touched-file-lint",
  "phase-1b-guard",
  "growth-foundation-guard",
  "growth-center-guard",
  "core-runtime-guard",
  "production-hard-off-matrix",
  "schema-safety",
  "compliance",
  "mission-control-regression",
  "agency-command-regression",
  "arena-regression",
  "community-regression",
  "identity-regression",
  "organizations-regression",
  "membership-regression",
  "billing-regression",
  "protected-surface-regression",
  "optimized-review-build",
  "production-identity-build",
  "secrets-and-private-metadata-scan",
  "exact-nine-package-integrity",
  "deployment-bom-verification",
  "preview-commit-binding",
]);

export const REQUIRED_BROWSER_IDS = Object.freeze([
  "desktop-settled",
  "tablet-settled",
  "mobile-portrait-settled",
  "compact-landscape-settled",
  "dark-mode",
  "light-mode",
  "reduced-motion",
  "text-reflow-200",
  "horizontal-overflow",
  "keyboard-and-focus",
  "back-and-forward",
  "first-frame-disclosure",
  "completion-not-approval",
  "correction-not-appeal",
  "synthetic-not-live",
  "axe",
  "manual-contrast",
]);

export const REQUIRED_SOURCE_CATEGORIES = Object.freeze([
  "PHASE_1A",
  "GROWTH_FOUNDATION",
  "REVIEW_SHELL",
  "CXOS_RUNTIME",
  "PHASE_1B_R",
  "BUILD_CONFIG",
]);

export const REQUIRED_SOURCE_PATHS = Object.freeze({
  "app/review/growth-center/page.tsx": "PHASE_1A",
  "app/review/growth-center/stage.tsx": "PHASE_1A",
  "app/review/growth-center/growth-center.module.css": "PHASE_1A",
  "lib/growthNetwork/experience.ts": "PHASE_1A",
  "lib/growthNetwork/previewFlags.ts": "PHASE_1A",
  "lib/growthNetwork/foundation.ts": "GROWTH_FOUNDATION",
  "lib/growthNetwork/flags.ts": "GROWTH_FOUNDATION",
  "lib/growthNetwork/index.ts": "GROWTH_FOUNDATION",
  "app/layout.tsx": "REVIEW_SHELL",
  "app/globals.css": "REVIEW_SHELL",
  "app/review/layout.tsx": "REVIEW_SHELL",
  "components/Providers.tsx": "REVIEW_SHELL",
  "lib/cxos/reviewMode.ts": "REVIEW_SHELL",
  "public/manifest.json": "REVIEW_SHELL",
  "public/og-image.png": "REVIEW_SHELL",
  "public/icons/favicon-16.png": "REVIEW_SHELL",
  "public/icons/favicon-32.png": "REVIEW_SHELL",
  "public/icons/favicon-48.png": "REVIEW_SHELL",
  "public/icons/apple-touch-icon.png": "REVIEW_SHELL",
  "public/icons/icon-192.png": "REVIEW_SHELL",
  "public/icons/icon-512.png": "REVIEW_SHELL",
  "public/icons/maskable-512.png": "REVIEW_SHELL",
  "components/cxos/transitions/TransitionShell.tsx": "CXOS_RUNTIME",
  "lib/cxos/transitions/registry.ts": "CXOS_RUNTIME",
  "components/cxos/runtime/useCxosRoomRuntime.ts": "CXOS_RUNTIME",
  "lib/cxos/runtime.ts": "CXOS_RUNTIME",
  "lib/cxos/capability.ts": "CXOS_RUNTIME",
  "app/review/growth-center/capability-contract/page.tsx": "PHASE_1B_R",
  "app/review/growth-center/capability-contract/stage.tsx": "PHASE_1B_R",
  "app/review/growth-center/capability-contract/capability-contract.module.css": "PHASE_1B_R",
  "lib/growthNetwork/capabilityContract.ts": "PHASE_1B_R",
  "lib/growthNetwork/capabilityPreviewFlags.ts": "PHASE_1B_R",
  "package.json": "BUILD_CONFIG",
  "package-lock.json": "BUILD_CONFIG",
  "prisma/schema.prisma": "BUILD_CONFIG",
  "next-env.d.ts": "BUILD_CONFIG",
  "tsconfig.json": "BUILD_CONFIG",
  "next.config.js": "BUILD_CONFIG",
  "postcss.config.js": "BUILD_CONFIG",
  "tailwind.config.ts": "BUILD_CONFIG",
  "middleware.ts": "BUILD_CONFIG",
  "vercel.json": "BUILD_CONFIG",
});

const STATUS_LINES = Object.freeze([
  "CGN ECONOMIC PHASE 1A — BLOCKED",
  "GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW ONLY",
  "GROWTH EXPERIENCE PHASE 1B WORK — AUTHORIZED NON-MONETARY CONTRACT WORK",
  "GROWTH EXPERIENCE PHASE 1B CONTRACT — NOT FOUNDER-RATIFIED",
  "GROWTH EXPERIENCE PHASE 1B-R — AUTHORIZED REMEDIATION IN PROGRESS",
  "LIVE ECONOMICS — NO-GO",
  "PUBLIC, PARTICIPANT, PAID, OR PRODUCTION ACTIVATION — NOT AUTHORIZED",
]);

const REQUIRED_COMPREHENSION_CHECKLIST = Object.freeze([
  "Completion is not approval.",
  "Correction is not appeal.",
  "Submission is not acceptance.",
  "Supported is not authorized.",
  "Synthetic is not live.",
  "Proposed ownership is not canonical ownership.",
  "No public, participant, paid, production, or economic activation is included.",
]);

const REQUIRED_DEPLOYMENT_ASSERTION_KEYS = Object.freeze([
  "protection",
  "anonymousRedirect",
  "authenticatedHttp200",
  "productionUnchanged",
  "exactGitBinding",
  "htmlMutation",
]);

const REQUIRED_BUILD_ASSERTION_KEYS = Object.freeze([
  "optimizedReview",
  "identity",
  "candidateBinding",
]);

const VALIDATION_EVIDENCE_KINDS = Object.freeze({
  "clean-worktree-reproducibility": "GIT_PROVENANCE",
  "lineage-and-sha": "GIT_PROVENANCE",
  "exact-file-allowlist": "GIT_PROVENANCE",
  "git-diff-check": "GIT_PROVENANCE",
  typecheck: "COMMAND_LOG",
  "touched-file-lint": "COMMAND_LOG",
  "phase-1b-guard": "COMMAND_LOG",
  "growth-foundation-guard": "COMMAND_LOG",
  "growth-center-guard": "COMMAND_LOG",
  "core-runtime-guard": "COMMAND_LOG",
  "production-hard-off-matrix": "COMMAND_LOG",
  "schema-safety": "COMMAND_LOG",
  compliance: "COMMAND_LOG",
  "mission-control-regression": "COMMAND_LOG",
  "agency-command-regression": "COMMAND_LOG",
  "arena-regression": "COMMAND_LOG",
  "community-regression": "COMMAND_LOG",
  "identity-regression": "COMMAND_LOG",
  "organizations-regression": "COMMAND_LOG",
  "membership-regression": "COMMAND_LOG",
  "billing-regression": "COMMAND_LOG",
  "protected-surface-regression": "COMMAND_LOG",
  "optimized-review-build": "BUILD_LOG",
  "production-identity-build": "BUILD_LOG",
  "secrets-and-private-metadata-scan": "SECURITY_SCAN",
  "exact-nine-package-integrity": "PACKAGE_ASSERTION",
  "deployment-bom-verification": "PACKAGE_ASSERTION",
  "preview-commit-binding": "DEPLOYMENT_ASSERTION",
});

const BROWSER_EVIDENCE_KINDS = Object.freeze(
  Object.fromEntries(
    REQUIRED_BROWSER_IDS.map((id) => [
      id,
      id === "axe" || id === "manual-contrast"
        ? "ACCESSIBILITY_REPORT"
        : "BROWSER_TRACE",
    ]),
  ),
);

export const RAW_EVIDENCE_CLAIM_IDS = Object.freeze([
  ...REQUIRED_VALIDATION_IDS.map((id) => `validation:${id}`),
  ...REQUIRED_BROWSER_IDS.map((id) => `browser:${id}`),
  "humanComprehension:status",
  ...REQUIRED_DEPLOYMENT_ASSERTION_KEYS.map((key) => `deployment:${key}`),
  ...REQUIRED_BUILD_ASSERTION_KEYS.map((key) => `build:${key}`),
]);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return value.replace(/\r\n?/gu, "\n").replace(/[ \t]+$/gmu, "").replace(/\s*$/u, "") + "\n";
}

function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: options.cwd ?? REPOSITORY_ROOT,
    encoding: options.encoding === undefined ? "utf8" : options.encoding,
    env: options.env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  check(
    result.status === 0,
    `${name} ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`,
  );
  return result.stdout;
}

function git(args, options = {}) {
  return command("git", args, options).trim();
}

function gitBytes(args) {
  return command("git", args, { encoding: null });
}

function assertSafeRelativePath(value, label, options = {}) {
  check(typeof value === "string" && value.length > 0, `${label} must be a non-empty path`);
  check(!value.startsWith("/"), `${label} must not be absolute`);
  check(!value.includes("\\"), `${label} must use repository-relative POSIX separators`);
  const segments = value.split("/");
  check(segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".."), `${label} must not contain empty or traversal segments`);
  if (!options.allowHidden) {
    check(segments.every((segment) => !segment.startsWith(".")), `${label} must not contain hidden segments`);
  }
}

function pathIsWithin(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot.length > 0 &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`)
  );
}

function resolveRawEvidenceFile(relativePath, label) {
  assertSafeRelativePath(relativePath, label);
  check(existsSync(EVIDENCE_ROOT), `${EVIDENCE_ROOT_NAME} is missing`);
  const rootInfo = lstatSync(EVIDENCE_ROOT);
  check(rootInfo.isDirectory() && !rootInfo.isSymbolicLink(), `${EVIDENCE_ROOT_NAME} must be a regular directory`);

  let cursor = EVIDENCE_ROOT;
  const segments = relativePath.split("/");
  for (const [index, segment] of segments.entries()) {
    check(segment.length > 0 && segment !== ".", `${label} contains an unsafe segment`);
    cursor = join(cursor, segment);
    check(existsSync(cursor), `${label} does not resolve to a preserved file`);
    const info = lstatSync(cursor);
    check(!info.isSymbolicLink(), `${label} traverses a symbolic link`);
    if (index < segments.length - 1) {
      check(info.isDirectory(), `${label} has a non-directory parent component`);
    } else {
      check(info.isFile(), `${label} must resolve to a regular file`);
    }
  }

  const realRoot = realpathSync(EVIDENCE_ROOT);
  const realFile = realpathSync(cursor);
  check(pathIsWithin(realRoot, realFile), `${label} resolves outside ${EVIDENCE_ROOT_NAME}`);
  return realFile;
}

export function resolveEvidenceIndexPath(argument) {
  check(typeof argument === "string" && argument.length > 0, "evidence argument is required");
  const resolvedPath = resolve(REPOSITORY_ROOT, argument);
  check(pathIsWithin(EVIDENCE_ROOT, resolvedPath), `evidence index must be inside ${EVIDENCE_ROOT_NAME}`);
  const evidenceRelativePath = relative(EVIDENCE_ROOT, resolvedPath).split(sep).join("/");
  check(evidenceRelativePath.endsWith(".json"), "evidence index must be a JSON file");
  return resolveRawEvidenceFile(evidenceRelativePath, "evidence index path");
}

function branchRemoteRef(branch) {
  return `refs/remotes/origin/${branch}`;
}

function remoteBranchSha(branch) {
  const exactRef = `refs/heads/${branch}`;
  const result = spawnSync(
    "git",
    ["ls-remote", "--exit-code", "--heads", "origin", exactRef],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      maxBuffer: 1024 * 1024,
    },
  );
  check(result.status === 0, "could not verify the exact remote review branch");
  const records = result.stdout.trim().split("\n").filter(Boolean);
  check(records.length === 1, "remote review branch lookup did not return exactly one ref");
  const [sha, ref, ...extra] = records[0].split(/\s+/u);
  check(extra.length === 0 && ref === exactRef, "remote review branch lookup returned an unexpected ref");
  check(/^[0-9a-f]{40}$/u.test(sha), "remote review branch returned an invalid SHA");
  return sha;
}

function parseChangedFiles(baseline, candidate) {
  const output = git(["diff", "--name-status", "--find-renames", `${baseline}..${candidate}`]);
  if (!output) return [];
  return output.split("\n").map((line) => {
    const fields = line.split("\t");
    const status = fields[0];
    const path = fields.at(-1);
    assertSafeRelativePath(path, "candidate delta path", { allowHidden: true });
    const present = !status.startsWith("D");
    const bytes = present ? gitBytes(["show", `${candidate}:${path}`]) : Buffer.alloc(0);
    return Object.freeze({
      status,
      path,
      bytes: bytes.byteLength,
      sha256: present ? sha256(bytes) : "DELETED",
    });
  });
}

function assertAuthorizedCandidateDelta(changedFiles) {
  const observed = new Map(changedFiles.map((item) => [item.path, item.status]));
  const unexpected = [...observed.keys()].filter(
    (path) => !Object.hasOwn(AUTHORIZED_CANDIDATE_CHANGES, path),
  );
  const missing = AUTHORIZED_CANDIDATE_PATHS.filter(
    (path) => !observed.has(path),
  );
  const statusMismatches = AUTHORIZED_CANDIDATE_PATHS.flatMap((path) => {
    const observedStatus = observed.get(path);
    const expectedStatus = AUTHORIZED_CANDIDATE_CHANGES[path];
    return observedStatus && observedStatus !== expectedStatus
      ? [`${path} expected ${expectedStatus}, observed ${observedStatus}`]
      : [];
  });
  check(unexpected.length === 0, `candidate delta contains unexpected paths: ${unexpected.join(", ")}`);
  check(missing.length === 0, `candidate delta is missing authorized paths: ${missing.join(", ")}`);
  check(statusMismatches.length === 0, `candidate delta has unexpected change types: ${statusMismatches.join(", ")}`);
  check(
    changedFiles.length === AUTHORIZED_CANDIDATE_PATHS.length,
    `candidate delta count mismatch; expected ${AUTHORIZED_CANDIDATE_PATHS.length}, observed ${changedFiles.length}`,
  );
}

function assertAllowedUntracked(candidateSha) {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (!status) return;
  const allowedOutputs = new Set([...PACKAGE_MEMBERS, ZIP_NAME]);
  const failures = [];
  for (const line of status.split("\n")) {
    const code = line.slice(0, 2);
    const path = line.slice(3).replace(/^"|"$/gu, "");
    if (code !== "??") {
      failures.push(`${code} ${path}`);
      continue;
    }
    if (
      !allowedOutputs.has(path) &&
      !path.startsWith("GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE/")
    ) {
      failures.push(`${code} ${path}`);
    }
  }
  check(
    failures.length === 0,
    `candidate ${candidateSha} has unapproved worktree changes: ${failures.join(", ")}`,
  );
}

export function collectProvenance() {
  const branch = git(["branch", "--show-current"]);
  check(branch === EXPECTED_BRANCH, `expected branch ${EXPECTED_BRANCH}; observed ${branch || "detached"}`);
  const candidateSha = git(["rev-parse", "HEAD"]);
  check(/^[0-9a-f]{40}$/u.test(candidateSha), "candidate SHA is not a full Git object ID");
  check(git(["cat-file", "-t", EXPECTED_BASELINE_SHA]) === "commit", "expected baseline commit is unavailable");
  const mergeBase = git(["merge-base", EXPECTED_BASELINE_SHA, candidateSha]);
  check(mergeBase === EXPECTED_BASELINE_SHA, "candidate does not descend from the verified baseline");

  check(spawnSync("git", ["diff", "--quiet", "HEAD", "--"], { cwd: REPOSITORY_ROOT }).status === 0, "tracked worktree is not clean");
  check(spawnSync("git", ["diff", "--cached", "--quiet", "HEAD", "--"], { cwd: REPOSITORY_ROOT }).status === 0, "index is not clean");
  assertAllowedUntracked(candidateSha);

  const remoteRef = branchRemoteRef(branch);
  check(git(["show-ref", "--verify", "--hash", remoteRef]) === candidateSha, "origin review branch does not match candidate SHA; push/fetch before packaging");
  const verifiedRemoteSha = remoteBranchSha(branch);
  check(verifiedRemoteSha === candidateSha, "exact remote review branch does not match candidate SHA");

  for (const name of [...PACKAGE_MEMBERS, ZIP_NAME]) {
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", name], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });
    check(tracked.status !== 0, `${name} is tracked; derived package files must remain outside the candidate commit`);
  }

  const parents = git(["show", "-s", "--format=%P", candidateSha]).split(/\s+/u).filter(Boolean);
  const commitEpoch = Number(git(["show", "-s", "--format=%ct", candidateSha]));
  check(Number.isSafeInteger(commitEpoch) && commitEpoch > 0, "candidate commit timestamp is invalid");
  const commits = git(["rev-list", "--reverse", `${EXPECTED_BASELINE_SHA}..${candidateSha}`])
    .split("\n")
    .filter(Boolean);
  check(commits.length > 0, "candidate commit range is empty");
  check(
    commits.length === 1 && parents.length === 1 && parents[0] === EXPECTED_BASELINE_SHA,
    "candidate must be one commit whose direct parent is the verified baseline",
  );

  const changedFiles = parseChangedFiles(EXPECTED_BASELINE_SHA, candidateSha);
  assertAuthorizedCandidateDelta(changedFiles);

  return Object.freeze({
    baselineSha: EXPECTED_BASELINE_SHA,
    candidateSha,
    remoteSha: verifiedRemoteSha,
    branch,
    parents,
    mergeBase,
    commitRange: `${EXPECTED_BASELINE_SHA}..${candidateSha}`,
    commits,
    commitEpoch,
    changedFiles,
  });
}

function isResult(value) {
  return EVIDENCE_RESULTS.includes(value);
}

function assertExactObjectKeys(value, requiredKeys, label) {
  check(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const observedKeys = Object.keys(value).sort();
  const expectedKeys = [...requiredKeys].sort();
  check(
    JSON.stringify(observedKeys) === JSON.stringify(expectedKeys),
    `${label} must contain exactly: ${expectedKeys.join(", ")}`,
  );
}

function isCanonicalUtcTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function aggregateEvidenceResults(results) {
  check(
    Array.isArray(results) && results.length > 0 && results.every(isResult),
    "cannot aggregate invalid evidence results",
  );
  if (results.includes("FAIL")) return "FAIL";
  if (results.includes("BLOCKED")) return "BLOCKED";
  if (results.includes("NOT RUN")) return "NOT RUN";
  if (results.includes("NOT APPLICABLE")) return "NOT APPLICABLE";
  return "PASS";
}

function validateRawEvidenceIndex(entries, provenance, observedAtMs) {
  check(Array.isArray(entries), "rawEvidence must be an array");
  const paths = new Set();
  const byDigest = new Map();
  const claimOwners = new Map();
  for (const [index, entry] of entries.entries()) {
    const label = `rawEvidence entry ${index + 1}`;
    assertExactObjectKeys(
      entry,
      RAW_EVIDENCE_ENVELOPE_FIELDS,
      label,
    );
    check(entry.candidateSha === provenance.candidateSha, `${label} candidate SHA mismatch`);
    check(
      RAW_EVIDENCE_KINDS.includes(entry.evidenceKind),
      `${label} has invalid evidence kind`,
    );
    check(
      Array.isArray(entry.claimIds) && entry.claimIds.length > 0,
      `${label} claimIds must be a non-empty array`,
    );
    check(
      JSON.stringify(entry.claimIds) ===
        JSON.stringify([...new Set(entry.claimIds)].sort()),
      `${label} claimIds must be unique and in canonical lexical order`,
    );
    for (const claimId of entry.claimIds) {
      check(
        RAW_EVIDENCE_CLAIM_IDS.includes(claimId),
        `${label} contains an invalid namespaced claimId`,
      );
      check(!claimOwners.has(claimId), `${label} duplicates claimId ownership`);
      claimOwners.set(claimId, index + 1);
    }
    check(
      typeof entry.executed === "string" &&
        entry.executed.length > 0 &&
        !/[\r\n]/u.test(entry.executed),
      `${label} executed command/assertion must be a non-empty single-line summary`,
    );
    scanText(entry.executed, `${label} executed command/assertion`);
    check(isResult(entry.result) && entry.result !== "NOT RUN", `${label} has invalid captured result`);
    check(
      entry.exitCode === null ||
        (Number.isSafeInteger(entry.exitCode) && entry.exitCode >= 0 && entry.exitCode <= 255),
      `${label} exitCode must be null or an integer from 0 through 255`,
    );
    if (
      entry.result === "PASS" &&
      EXECUTABLE_RAW_EVIDENCE_KINDS.includes(entry.evidenceKind)
    ) {
      check(
        entry.exitCode === 0,
        `${label} executable PASS requires exitCode 0`,
      );
    } else if (entry.result === "PASS" && entry.exitCode !== null) {
      check(entry.exitCode === 0, `${label} PASS cannot carry a nonzero exitCode`);
    }
    if (entry.result === "FAIL" && entry.exitCode !== null) {
      check(entry.exitCode !== 0, `${label} FAIL cannot carry exitCode 0`);
    }
    check(isCanonicalUtcTimestamp(entry.capturedAt), `${label} capturedAt must be a canonical UTC ISO timestamp`);
    const capturedAtMs = Date.parse(entry.capturedAt);
    check(
      capturedAtMs >= provenance.commitEpoch * 1000,
      `${label} capturedAt cannot predate the candidate commit`,
    );
    check(capturedAtMs <= observedAtMs, `${label} capturedAt cannot follow evidence observedAt`);
    check(
      capturedAtMs <= Date.now() + MAX_OBSERVED_CLOCK_SKEW_MS,
      `${label} capturedAt is beyond the allowed five-minute clock skew`,
    );
    assertSafeRelativePath(entry.path, `${label} path`);
    scanText(entry.path, `${label} path`);
    check(!paths.has(entry.path), `${label} duplicates another path`);
    paths.add(entry.path);
    check(Number.isSafeInteger(entry.bytes) && entry.bytes > 0, `${label} must be non-empty`);
    check(/^[0-9a-f]{64}$/u.test(entry.sha256), `${label} has invalid SHA-256`);
    check(!byDigest.has(entry.sha256), `${label} duplicates another digest`);
    const filePath = resolveRawEvidenceFile(entry.path, label);
    const bytes = readFileSync(filePath);
    check(bytes.byteLength === entry.bytes, `${label} byte count mismatch`);
    check(sha256(bytes) === entry.sha256, `${label} SHA-256 mismatch`);
    byDigest.set(entry.sha256, { entry, index: index + 1 });
  }
  return {
    byDigest,
    referencedDigests: new Set(),
    referencedClaimIds: new Set(),
  };
}

function assertRawEvidenceReference(
  claim,
  label,
  rawEvidence,
  evidenceKind,
  claimId,
) {
  check(RAW_EVIDENCE_KINDS.includes(evidenceKind), `${label} has no exact allowed evidence kind`);
  check(
    RAW_EVIDENCE_CLAIM_IDS.includes(claimId),
    `${label} has no exact namespaced claimId`,
  );
  if (claim.result === "PASS") {
    check(/^[0-9a-f]{64}$/u.test(claim.rawEvidenceSha256), `${label} PASS requires a raw-evidence SHA-256`);
  } else if (claim.rawEvidenceSha256 !== undefined && claim.rawEvidenceSha256 !== null) {
    check(/^[0-9a-f]{64}$/u.test(claim.rawEvidenceSha256), `${label} has malformed raw-evidence SHA-256`);
  }
  if (claim.rawEvidenceSha256 !== undefined && claim.rawEvidenceSha256 !== null) {
    check(rawEvidence.byDigest.has(claim.rawEvidenceSha256), `${label} raw-evidence digest does not resolve`);
    const envelope = rawEvidence.byDigest.get(claim.rawEvidenceSha256).entry;
    check(envelope.result === claim.result, `${label} result disagrees with its raw-evidence envelope`);
    check(
      envelope.evidenceKind === evidenceKind,
      `${label} raw-evidence kind must be exactly ${evidenceKind}`,
    );
    check(
      envelope.claimIds.includes(claimId),
      `${label} raw-evidence envelope does not bind claimId ${claimId}`,
    );
    rawEvidence.referencedDigests.add(claim.rawEvidenceSha256);
    rawEvidence.referencedClaimIds.add(claimId);
  }
}

function assertStructuredAssertion(
  assertion,
  label,
  rawEvidence,
  evidenceKind,
  claimId,
) {
  assertExactObjectKeys(
    assertion,
    ["result", "detail", "rawEvidenceSha256"],
    label,
  );
  check(isResult(assertion.result), `${label} has invalid result ${assertion.result}`);
  check(typeof assertion.detail === "string" && assertion.detail.length > 0, `${label} requires detail`);
  assertRawEvidenceReference(
    assertion,
    label,
    rawEvidence,
    evidenceKind,
    claimId,
  );
}

function assertExactAssertionKeys(assertions, requiredKeys, label) {
  assertExactObjectKeys(assertions, requiredKeys, label);
}

function assertEvidenceRows(rows, requiredIds, label, rawEvidence, evidenceKinds) {
  check(Array.isArray(rows), `${label} must be an array`);
  const ids = new Set();
  for (const row of rows) {
    assertExactObjectKeys(
      row,
      ["id", "label", "result", "detail", "rawEvidenceSha256"],
      `${label} row`,
    );
    check(typeof row.id === "string" && row.id.length > 0, `${label} row requires id`);
    check(!ids.has(row.id), `${label} contains duplicate id ${row.id}`);
    ids.add(row.id);
    check(typeof row.label === "string" && row.label.length > 0, `${label} ${row.id} requires label`);
    check(isResult(row.result), `${label} ${row.id} has invalid result ${row.result}`);
    check(typeof row.detail === "string" && row.detail.length > 0, `${label} ${row.id} requires detail`);
    assertRawEvidenceReference(
      row,
      `${label} ${row.id}`,
      rawEvidence,
      evidenceKinds[row.id],
      `${label}:${row.id}`,
    );
  }
  for (const id of requiredIds) check(ids.has(id), `${label} is missing required id ${id}`);
  check(
    ids.size === requiredIds.length,
    `${label} must contain exactly the ${requiredIds.length} authorized evidence rows`,
  );

  if (label === "validation") {
    const exactNine = rows.find((row) => row.id === "exact-nine-package-integrity");
    check(
      exactNine?.result === "NOT RUN" || exactNine?.result === "NOT APPLICABLE",
      "exact-nine-package-integrity must remain NOT RUN or NOT APPLICABLE inside the package",
    );
    check(
      exactNine?.rawEvidenceSha256 === null || exactNine?.rawEvidenceSha256 === undefined,
      "exact-nine-package-integrity cannot embed a self-referential raw-evidence digest",
    );
  }
}

function commitBytes(candidateSha, path) {
  return gitBytes(["show", `${candidateSha}:${path}`]);
}

export function validateEvidence(evidence, provenance) {
  assertExactObjectKeys(
    evidence,
    [
      "schemaVersion",
      "observedAt",
      "baselineSha",
      "candidateSha",
      "remoteSha",
      "branch",
      "rawEvidence",
      "validation",
      "browser",
      "humanComprehension",
      "deployment",
      "build",
      "sourceClosure",
      "exclusions",
      "knownCaveats",
      "rollback",
    ],
    "evidence",
  );
  check(evidence.schemaVersion === EVIDENCE_SCHEMA_VERSION, `evidence schemaVersion must be ${EVIDENCE_SCHEMA_VERSION}`);
  check(evidence.baselineSha === provenance.baselineSha, "evidence baseline SHA mismatch");
  check(evidence.candidateSha === provenance.candidateSha, "evidence candidate SHA mismatch");
  check(evidence.remoteSha === provenance.remoteSha, "evidence remote SHA mismatch");
  check(evidence.branch === provenance.branch, "evidence branch mismatch");
  check(isCanonicalUtcTimestamp(evidence.observedAt), "evidence observedAt must be a canonical UTC ISO timestamp");
  const observedAtMs = Date.parse(evidence.observedAt);
  check(
    observedAtMs >= provenance.commitEpoch * 1000,
    "evidence observedAt cannot predate the candidate commit",
  );
  check(
    observedAtMs <= Date.now() + MAX_OBSERVED_CLOCK_SKEW_MS,
    "evidence observedAt is beyond the allowed five-minute clock skew",
  );

  const rawEvidence = validateRawEvidenceIndex(evidence.rawEvidence, provenance, observedAtMs);
  assertEvidenceRows(
    evidence.validation,
    REQUIRED_VALIDATION_IDS,
    "validation",
    rawEvidence,
    VALIDATION_EVIDENCE_KINDS,
  );
  assertEvidenceRows(
    evidence.browser,
    REQUIRED_BROWSER_IDS,
    "browser",
    rawEvidence,
    BROWSER_EVIDENCE_KINDS,
  );
  const validationById = new Map(evidence.validation.map((row) => [row.id, row]));

  assertExactObjectKeys(
    evidence.humanComprehension,
    ["status", "checklist", "rawEvidenceSha256"],
    "humanComprehension",
  );
  check(
    evidence.humanComprehension.status === "NOT HUMAN-VALIDATED" ||
      evidence.humanComprehension.status === "HUMAN-VALIDATED",
    "humanComprehension status is invalid",
  );
  check(
    JSON.stringify(evidence.humanComprehension.checklist) ===
      JSON.stringify(REQUIRED_COMPREHENSION_CHECKLIST),
    "humanComprehension checklist must preserve the exact semantic laws and activation boundary",
  );
  if (evidence.humanComprehension.status === "HUMAN-VALIDATED") {
    assertRawEvidenceReference(
      {
        result: "PASS",
        rawEvidenceSha256: evidence.humanComprehension.rawEvidenceSha256,
      },
      "human comprehension",
      rawEvidence,
      "HUMAN_REVIEW",
      "humanComprehension:status",
    );
  } else {
    check(
      evidence.humanComprehension.rawEvidenceSha256 === null ||
        evidence.humanComprehension.rawEvidenceSha256 === undefined,
      "NOT HUMAN-VALIDATED cannot carry a human-validation digest",
    );
  }

  assertExactObjectKeys(
    evidence.deployment,
    ["result", "target", "state", "gitBindingSha", "privateReferenceOmitted", "assertions"],
    "deployment",
  );
  check(isResult(evidence.deployment.result), "deployment result is invalid");
  check(evidence.deployment.target === "Preview", "deployment target must be Preview");
  check(typeof evidence.deployment.state === "string" && evidence.deployment.state.length > 0, "deployment state is required");
  check(evidence.deployment.privateReferenceOmitted === true, "private deployment reference must be omitted from distributable evidence");
  assertExactAssertionKeys(
    evidence.deployment.assertions,
    REQUIRED_DEPLOYMENT_ASSERTION_KEYS,
    "deployment assertions",
  );
  for (const key of REQUIRED_DEPLOYMENT_ASSERTION_KEYS) {
    assertStructuredAssertion(
      evidence.deployment.assertions[key],
      `deployment assertion ${key}`,
      rawEvidence,
      "DEPLOYMENT_ASSERTION",
      `deployment:${key}`,
    );
  }
  const deploymentAggregate = aggregateEvidenceResults(
    REQUIRED_DEPLOYMENT_ASSERTION_KEYS.map((key) => {
      const result = evidence.deployment.assertions[key].result;
      return key === "htmlMutation" && result === "NOT APPLICABLE" ? "PASS" : result;
    }),
  );
  check(
    evidence.deployment.result === deploymentAggregate,
    `deployment result must equal the structured assertion aggregate ${deploymentAggregate}`,
  );
  const exactGitBindingPassed =
    evidence.deployment.assertions.exactGitBinding.result === "PASS";
  check(
    evidence.deployment.gitBindingSha ===
      (exactGitBindingPassed ? provenance.candidateSha : null),
    exactGitBindingPassed
      ? "exactGitBinding PASS requires the candidate Git binding even when deployment is not PASS"
      : "deployment Git binding must be null unless exactGitBinding is PASS",
  );
  check(
    validationById.get("preview-commit-binding").result ===
      evidence.deployment.assertions.exactGitBinding.result,
    "preview-commit-binding must agree with deployment exactGitBinding",
  );

  assertExactObjectKeys(
    evidence.build,
    ["result", "commandSummary", "gitBindingSha", "assertions"],
    "build",
  );
  check(isResult(evidence.build.result), "build result is invalid");
  check(typeof evidence.build.commandSummary === "string" && evidence.build.commandSummary.length > 0, "build command summary is required");
  assertExactAssertionKeys(
    evidence.build.assertions,
    REQUIRED_BUILD_ASSERTION_KEYS,
    "build assertions",
  );
  for (const key of REQUIRED_BUILD_ASSERTION_KEYS) {
    assertStructuredAssertion(
      evidence.build.assertions[key],
      `build assertion ${key}`,
      rawEvidence,
      "BUILD_LOG",
      `build:${key}`,
    );
  }
  check(
    validationById.get("optimized-review-build").result ===
      evidence.build.assertions.optimizedReview.result,
    "optimized-review-build must agree with build optimizedReview",
  );
  check(
    validationById.get("production-identity-build").result ===
      evidence.build.assertions.identity.result,
    "production-identity-build must agree with build identity",
  );
  check(
    validationById.get("preview-commit-binding").result ===
      evidence.build.assertions.candidateBinding.result,
    "preview-commit-binding must agree with build candidateBinding",
  );
  const buildAggregate = aggregateEvidenceResults(
    REQUIRED_BUILD_ASSERTION_KEYS.map(
      (key) => evidence.build.assertions[key].result,
    ),
  );
  check(
    evidence.build.result === buildAggregate,
    `build result must equal the structured assertion aggregate ${buildAggregate}`,
  );
  const buildBindingPassed =
    evidence.build.assertions.candidateBinding.result === "PASS";
  check(
    evidence.build.gitBindingSha ===
      (buildBindingPassed ? provenance.candidateSha : null),
    buildBindingPassed
      ? "candidateBinding PASS requires the candidate Git binding even when build is not PASS"
      : "build Git binding must be null unless candidateBinding is PASS",
  );

  check(Array.isArray(evidence.sourceClosure) && evidence.sourceClosure.length > 0, "sourceClosure must be non-empty");
  const sourcePaths = new Set();
  const sourceCategories = new Set();
  for (const item of evidence.sourceClosure) {
    assertExactObjectKeys(item, ["category", "path", "bytes", "sha256"], "sourceClosure entry");
    assertSafeRelativePath(item.path, "sourceClosure path");
    check(!sourcePaths.has(item.path), `duplicate sourceClosure path ${item.path}`);
    sourcePaths.add(item.path);
    check(REQUIRED_SOURCE_CATEGORIES.includes(item.category), `invalid source category ${item.category}`);
    sourceCategories.add(item.category);
    const bytes = commitBytes(provenance.candidateSha, item.path);
    check(item.sha256 === sha256(bytes), `sourceClosure hash mismatch for ${item.path}`);
    check(item.bytes === bytes.byteLength, `sourceClosure byte count mismatch for ${item.path}`);
  }
  for (const category of REQUIRED_SOURCE_CATEGORIES) {
    check(sourceCategories.has(category), `sourceClosure is missing category ${category}`);
  }
  for (const [path, category] of Object.entries(REQUIRED_SOURCE_PATHS)) {
    check(sourcePaths.has(path), `sourceClosure is missing required transitive path ${path}`);
    const item = evidence.sourceClosure.find((candidate) => candidate.path === path);
    check(item?.category === category, `sourceClosure category mismatch for ${path}; expected ${category}`);
  }
  check(
    sourcePaths.size === Object.keys(REQUIRED_SOURCE_PATHS).length,
    `sourceClosure must contain exactly the ${Object.keys(REQUIRED_SOURCE_PATHS).length} authorized paths`,
  );

  check(
    JSON.stringify(evidence.exclusions) === JSON.stringify(CANONICAL_EXCLUSIONS),
    "exclusions must equal the exact canonical exclusion set in canonical order",
  );
  for (const key of ["knownCaveats", "rollback"]) {
    check(Array.isArray(evidence[key]) && evidence[key].length > 0, `${key} must be a non-empty array`);
    check(evidence[key].every((value) => typeof value === "string" && value.length > 0), `${key} contains an invalid value`);
  }

  for (const [digest, indexedEnvelope] of rawEvidence.byDigest) {
    check(
      rawEvidence.referencedDigests.has(digest),
      `rawEvidence entry ${indexedEnvelope.index} is not referenced by an authorized evidence claim`,
    );
    for (const claimId of indexedEnvelope.entry.claimIds) {
      check(
        rawEvidence.referencedClaimIds.has(claimId),
        `rawEvidence entry ${indexedEnvelope.index} claimId ${claimId} is not referenced by its authorized claim`,
      );
    }
  }

  scanText(JSON.stringify(evidence, null, 2), "package-safe evidence index");
  return evidence;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

let discoveredPrivatePatterns;

function privateIdentifierPatterns() {
  if (discoveredPrivatePatterns) return discoveredPrivatePatterns;
  const identifiers = new Set();
  const add = (value) => {
    if (typeof value !== "string") return;
    const normalized = value.trim();
    if (normalized.length >= 4) identifiers.add(normalized);
  };

  const projectFiles = new Set([
    join(REPOSITORY_ROOT, ".vercel", "project.json"),
  ]);
  const commonDirectory = spawnSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  if (commonDirectory.status === 0) {
    projectFiles.add(
      join(dirname(commonDirectory.stdout.trim()), ".vercel", "project.json"),
    );
  }
  for (const projectFile of projectFiles) {
    try {
      if (!existsSync(projectFile)) continue;
      const info = lstatSync(projectFile);
      if (!info.isFile() || info.isSymbolicLink()) continue;
      const project = JSON.parse(readFileSync(projectFile, "utf8"));
      for (const key of [
        "orgId",
        "projectId",
        "projectName",
        "orgSlug",
        "teamId",
        "teamSlug",
        "accountId",
        "accountSlug",
      ]) {
        add(project[key]);
      }
    } catch {
      // Discovery is additive; malformed local metadata is never copied or emitted.
    }
  }

  for (const key of [
    "VERCEL_ORG_ID",
    "VERCEL_PROJECT_ID",
    "VERCEL_GIT_REPO_OWNER",
    "VERCEL_TEAM_ID",
    "VERCEL_TEAM_SLUG",
  ]) {
    add(process.env[key]);
  }

  const remote = spawnSync("git", ["config", "--get", "remote.origin.url"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
  if (remote.status === 0) {
    const owner = /(?:github\.com[/:])([^/]+)\//u.exec(remote.stdout.trim())?.[1];
    add(owner);
  }

  discoveredPrivatePatterns = [...identifiers].map(
    (identifier) => [
      "discovered private project/account identifier",
      new RegExp(escapeRegExp(identifier), "u"),
    ],
  );
  return discoveredPrivatePatterns;
}

export function forbiddenPatterns() {
  const currentUser = userInfo().username;
  return [
    ["repository absolute path", new RegExp(escapeRegExp(REPOSITORY_ROOT), "iu")],
    ["macOS user path", /\/Users\//iu],
    ["Linux user path", /\/home\//iu],
    ["private temporary path", /\/private\/(?:tmp|var)\//iu],
    ["temporary path", /\/tmp(?:\/|\b)/iu],
    ["macOS temporary path", /\/var\/folders\//iu],
    ["file URL", /\bfile:\/\/[^\s"'<>]+/iu],
    ["Windows user path", /(?:[a-z]:|\\\\)\\Users\\/iu],
    ["OS username", new RegExp(`(^|[^a-z0-9])${escapeRegExp(currentUser)}([^a-z0-9]|$)`, "iu")],
    ["known private username", /\bre3zy\b/iu],
    ["owner username", /\bCEOGABRIEL\b/iu],
    ["private Vercel account slug", /rey-gabriel-s-projects/iu],
    ["private provider identifier", /\b(?:prj|team|dpl)_[A-Za-z0-9]+\b/iu],
    ["private Vercel URL", /https?:\/\/[^\s"'<>]*vercel(?:\.app|\.com)[^\s"'<>]*/iu],
    ["network URL", /\b(?:https?|wss?|ftp):\/\/[^\s"'<>]+/iu],
    ["private Vercel hostname", /\b[A-Za-z0-9.-]+\.vercel\.(?:app|com)\b/iu],
    ["environment value assignment", /\b[A-Z][A-Z0-9_]{2,}\s*=\s*[^\s,;]+/u],
    ["environment colon assignment", /\b(?:[A-Z][A-Z0-9]*_[A-Z0-9_]+|NODE_ENV|VERCEL_ENV|DATABASE_URL|NEXTAUTH_SECRET|PORT|HOST|CI)\s*:\s*[^\s,;]+/u],
    ["prose environment value", /\b(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|NODE_ENV|VERCEL_ENV|DATABASE_URL|NEXTAUTH_SECRET|PORT|HOST|CI)\s+(?:was|is|equals|(?:was\s+)?set\s+to|has\s+(?:the\s+)?value)\s+(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s,;]+)/iu],
    ["Bearer credential", /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/iu],
    ["JWT credential", /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u],
    ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u],
    ["AWS access key", /AKIA[0-9A-Z]{16}/u],
    ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gith[A-Za-z0-9_-]{20,})\b/u],
    ["GitLab token", /\bglpat-[A-Za-z0-9_-]{20,}\b/u],
    ["npm token", /\bnpm_[A-Za-z0-9]{20,}\b/u],
    ["PyPI token", /\bpypi-[A-Za-z0-9_-]{30,}\b/u],
    ["Google API key", /\bAIza[A-Za-z0-9_-]{35}\b/u],
    ["SendGrid token", /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/u],
    ["Twilio API key", /\bSK[0-9a-f]{32}\b/iu],
    ["Mailgun API key", /\bkey-[0-9a-f]{32}\b/iu],
    ["Shopify token", /\bshpat_[A-Za-z0-9]{20,}\b/u],
    ["Hugging Face token", /\bhf_[A-Za-z0-9]{20,}\b/u],
    ["DigitalOcean token", /\bdop_v1_[A-Za-z0-9]{20,}\b/u],
    ["Linear token", /\blin_api_[A-Za-z0-9]{20,}\b/u],
    ["Vercel token", /\bvcp_[A-Za-z0-9_-]{20,}\b/u],
    ["PostHog token", /\bphc_[A-Za-z0-9]{20,}\b/u],
    ["Resend token", /\bre_[A-Za-z0-9]{20,}\b/u],
    ["PlanetScale token", /\bpscale_tkn_[A-Za-z0-9_-]{20,}\b/u],
    ["Stripe key", /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/u],
    ["Anthropic key", /sk-ant-[A-Za-z0-9_-]+/u],
    ["OpenAI-style key", /sk-[A-Za-z0-9]{20,}/u],
    ["database URL", /(?:postgres|postgresql):\/\/[^\s"<>]+/iu],
    ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
    ["email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u],
    ["SSN", /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/u],
    ["North American phone", /\b(?:\+?1[-. ]?)?\(?[2-9][0-9]{2}\)?[-. ][0-9]{3}[-. ][0-9]{4}\b/u],
    ["unformatted North American phone", /\b(?:1)?[2-9][0-9]{2}[2-9][0-9]{6}\b/u],
    ["unresolved template token", /(?:\{\{[^}]+\}\}|%%[^%]+%%)/u],
    ...privateIdentifierPatterns(),
  ];
}

export function scanText(text, label) {
  check(!text.includes("\r"), `${label} contains CR line endings`);
  for (const [name, pattern] of forbiddenPatterns()) {
    check(!pattern.test(text), `${label} contains forbidden ${name}`);
  }
}

export function scanHtml(html, label) {
  scanText(html, label);
  check(/^<!doctype html>/iu.test(html), `${label} is not standalone HTML`);
  check(/<meta name="viewport"/iu.test(html), `${label} lacks viewport metadata`);
  check(/<meta name="robots" content="noindex,nofollow,noarchive">/iu.test(html), `${label} lacks noindex metadata`);
  const external = [
    /<script\b/iu,
    /<link\b/iu,
    /<img[^>]+src\s*=/iu,
    /<iframe\b/iu,
    /<form\b/iu,
    /<object\b/iu,
    /<embed\b/iu,
    /<base\b/iu,
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh\b/iu,
    /@import\b/iu,
    /url\s*\(/iu,
    /javascript\s*:/iu,
    /\b(?:src|href|srcset|srcdoc|action|formaction|poster|data|cite|background|ping|manifest)\s*=/iu,
    /\bon[a-z]+\s*=/iu,
    /(?:href|src)\s*=\s*["']https?:/iu,
    /(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/u,
    /data:[^\s"']+;base64,/iu,
  ];
  for (const pattern of external) check(!pattern.test(html), `${label} contains external or active HTML: ${pattern}`);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/gu, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>");
}

function tableCells(line) {
  return line.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => cell.trim());
}

function tableDivider(line) {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function markdownBody(markdown) {
  const lines = normalizeText(markdown).split("\n");
  const output = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      index += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      const items = [];
      while (lines[index]?.startsWith("- ")) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      output.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s/u.test(line)) {
      const items = [];
      while (/^\d+\.\s/u.test(lines[index] ?? "")) {
        items.push(lines[index].replace(/^\d+\.\s/u, ""));
        index += 1;
      }
      output.push(`<ol>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }
    if (line.startsWith("|") && tableDivider(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      const rows = [];
      index += 2;
      while ((lines[index] ?? "").startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      output.push(
        `<div class="table-wrap" role="region" aria-label="Scrollable table" tabindex="0"><table><thead><tr>${headers.map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (
      lines[index]?.trim() &&
      !/^#{1,3}\s/u.test(lines[index]) &&
      !lines[index].startsWith("- ") &&
      !/^\d+\.\s/u.test(lines[index]) &&
      !lines[index].startsWith("> ") &&
      !(lines[index].startsWith("|") && tableDivider(lines[index + 1] ?? ""))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }
  return output.join("\n");
}

const HTML_STYLE = `
:root{color-scheme:light dark;--bg:#07131f;--panel:#0d2030;--line:#315269;--text:#effaff;--muted:#bed0da;--accent:#74e4d6;--focus:#ffd27a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html{background:var(--bg);color:var(--text);line-height:1.6}body{margin:0;background:var(--bg)}main{width:min(100% - 2rem,72rem);margin:auto;padding:2rem 0 5rem}article{padding:clamp(1rem,4vw,2.5rem);border:1px solid var(--line);border-radius:1rem;background:var(--panel)}h1{font-size:clamp(1.8rem,7vw,3.4rem);line-height:1.08}h2{margin-top:2.5rem;font-size:clamp(1.35rem,4vw,2rem)}h3{margin-top:1.75rem}p,li,td,th{overflow-wrap:anywhere}p,li{color:var(--muted)}strong{color:var(--text)}code{padding:.1rem .35rem;border:1px solid var(--line);border-radius:.3rem;background:#061019;color:#d7fbf6}.table-wrap{overflow-x:auto;margin:1rem 0;border:1px solid var(--line);border-radius:.75rem}.table-wrap:focus-visible,input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}table{width:100%;min-width:42rem;border-collapse:collapse}th,td{padding:.7rem;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--text)}blockquote{margin:1rem 0;padding:.8rem 1rem;border-left:.3rem solid var(--accent);background:#081925}.decision{display:flex;gap:.7rem;align-items:flex-start;min-height:44px;padding:.75rem 0}.decision input{width:1.25rem;height:1.25rem;margin-top:.25rem}@media(prefers-color-scheme:light){:root{--bg:#f4f8fb;--panel:#fff;--line:#abc1cf;--text:#102333;--muted:#405868;--accent:#006d68;--focus:#7a4900}code{background:#edf4f7;color:#143f4b}blockquote{background:#edf6f5}}@media(max-width:520px){main{width:min(100% - 1rem,72rem);padding-top:.5rem}article{border-radius:.75rem;padding:1rem}table{min-width:36rem}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

function standaloneHtml(title, contentHtml, eyebrow) {
  return normalizeText(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  <style>${HTML_STYLE}</style>
</head>
<body>
  <main>
    <p>${escapeHtml(eyebrow)}</p>
    <article>${contentHtml}</article>
  </main>
</body>
</html>`);
}

function markdownHtml(title, markdown, eyebrow) {
  return standaloneHtml(title, markdownBody(markdown), eyebrow);
}

function statusBlock() {
  return STATUS_LINES.map((status) => `- **${status}**`).join("\n");
}

function resultSummary(rows) {
  const counts = Object.fromEntries(EVIDENCE_RESULTS.map((result) => [result, 0]));
  for (const row of rows) counts[row.result] += 1;
  return EVIDENCE_RESULTS.map((result) => `${result}: ${counts[result]}`).join(" · ");
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("|", "\\|")).join(" | ")} |`),
  ].join("\n");
}

function privatePreviewSummary(evidence) {
  if (evidence.deployment.result === "PASS") {
    return "Work authorized. Protected Preview completed. Contract ratification pending.";
  }
  return `Work authorized. Protected Preview evidence is ${evidence.deployment.result}; completion is not verified. Contract ratification pending.`;
}

function verifiedBinding(record, assertionKey) {
  return record.assertions[assertionKey].result === "PASS"
    ? record.gitBindingSha
    : "NOT VERIFIED";
}

function privatePreviewCoordinatesSummary(evidence) {
  if (evidence.deployment.result === "PASS") {
    return "Private Preview coordinates: ESTABLISHED by PASS deployment evidence; omitted from this distributable and retained with raw evidence.";
  }
  return `Private Preview coordinates: NOT ESTABLISHED (${evidence.deployment.result}); no retained-coordinate claim is made.`;
}

function browserBehaviorSummary(evidence) {
  const history = evidence.browser.find((row) => row.id === "back-and-forward");
  const firstFrame = evidence.browser.find(
    (row) => row.id === "first-frame-disclosure",
  );
  const liveRegion = evidence.validation.find(
    (row) => row.id === "phase-1b-guard",
  );
  const allPassed = [history, firstFrame, liveRegion].every(
    (row) => row.result === "PASS",
  );
  if (allPassed) {
    return "Browser history: PASS; first-frame disclosure: PASS; one-live-region guard: PASS — all three were tested through preserved PASS evidence.";
  }
  return `Browser history: ${history.result}; first-frame disclosure: ${firstFrame.result}; one-live-region guard: ${liveRegion.result}. Verification is incomplete; no tested claim is made for a non-PASS item.`;
}

function worktreeIdentitySummary(evidence) {
  const worktree = evidence.validation.find(
    (row) => row.id === "clean-worktree-reproducibility",
  );
  if (worktree.result === "PASS") {
    return `Clean isolated-worktree evidence: PASS. ${worktree.detail} The absolute local path and operating-system username are intentionally omitted from this distributable.`;
  }
  return `Clean isolated-worktree provenance: NOT VERIFIED (${worktree.result}). The package makes no isolation or clean-worktree claim; absolute local path and operating-system username are omitted.`;
}

function assertionSummary(assertion) {
  return `${assertion.result}: ${assertion.detail} Raw evidence SHA-256: ${assertion.rawEvidenceSha256 ?? "No raw digest claimed"}.`;
}

function reportMarkdown(provenance, evidence) {
  const changedRows = provenance.changedFiles.map((item) => [item.status, item.path, item.bytes, item.sha256]);
  const validationRows = evidence.validation.map((item) => [item.id, item.result, item.detail]);
  const browserRows = evidence.browser.map((item) => [item.id, item.result, item.detail]);
  return normalizeText(`# CreditVector Growth Experience Phase 1B-R — Founder Report

${privatePreviewSummary(evidence)}

## 1. Executive summary

The bounded Phase 1B-R candidate implements changes to contract authority, ownership maturity, compatibility policy, semantic distinctions, production hard-off behavior, privacy wording, history behavior, and evidence provenance. Verification claims remain conditional on the recorded results below. This report does not record Founder approval.

${statusBlock()}

## 2. Exact remediation outcome

Evidence observed at: ${evidence.observedAt}. Validation: ${resultSummary(evidence.validation)}. Browser/accessibility: ${resultSummary(evidence.browser)}. Human comprehension: **${evidence.humanComprehension.status}**. Preserved raw-evidence files verified: ${evidence.rawEvidence.length}; private raw-evidence paths are omitted.

## 3. Repository and worktree identity

${worktreeIdentitySummary(evidence)}

## 4. Baseline, candidate, and remote SHAs

- Baseline: ${provenance.baselineSha}
- Candidate: ${provenance.candidateSha}
- Remote review branch: ${provenance.remoteSha}
- Branch: ${provenance.branch}

## 5. Commit range and parentage

- Range: ${provenance.commitRange}
- Merge base: ${provenance.mergeBase}
- Parent SHA(s): ${provenance.parents.join(", ")}
- Ordered candidate commits: ${provenance.commits.join(", ")}

## 6. Exact file allowlist

${markdownTable(["Change", "Repository-relative path", "Bytes", "SHA-256"], changedRows)}

## 7. Authority and status corrections

The contract no longer describes itself as approved, accepted, permanent, or ratified. Work authorization, protected-Preview evidence, and contract ratification are separate facts. The Founder receipt remains unchecked.

## 8. Ownership reconciliation

The frozen registry was not amended. Learning, Mentorship, Meetings, Documents, Community policy, certifications, and other unresolved domains remain proposed, future-owned, or owner-unresolved. Owner-unresolved pathways are non-operational.

## 9. Positive allowlist summary

All seventy known pathway/fixture pairs are explicitly classified with pair-specific rationales. Only four Organization-scope boundary examples are SUPPORTED_SYNTHETIC_REVIEW; proposed examples remain proposed; owner-unresolved and invalid inputs fail closed.

## 10. Production hard-off evidence

${evidence.validation.find((row) => row.id === "production-hard-off-matrix").result}: ${evidence.validation.find((row) => row.id === "production-hard-off-matrix").detail}

## 11. Deployment BOM

The separate BOM records complete lineage, exact delta, categorized transitive source closure, hashes, Git binding, build identity, exclusions, artifact identity, protection, production safety, and platform HTML mutation disposition.

## 12. Validation ledger

${markdownTable(["Evidence", "Result", "Detail"], validationRows)}

## 13. Browser and accessibility evidence

${markdownTable(["Evidence", "Result", "Detail"], browserRows)}

${browserBehaviorSummary(evidence)}

Human comprehension is **${evidence.humanComprehension.status}**. Mechanical assertions do not prove that a person understood the distinctions.

## 14. Exact nine-file package and SHA-256

${PACKAGE_MEMBERS.map((name, index) => `${index + 1}. ${name}`).join("\n")}

The evidence manifest hashes the eight non-manifest members. The manifest itself and the ZIP are hashed in the external package-integrity record after the archive exists; the ZIP hash is deliberately not embedded recursively.

## 15. Protected Preview identity

- Target: ${evidence.deployment.target}
- Result/state: ${evidence.deployment.result} / ${evidence.deployment.state}
- Git binding: ${verifiedBinding(evidence.deployment, "exactGitBinding")}
- Protection: ${assertionSummary(evidence.deployment.assertions.protection)}
- Anonymous redirect: ${assertionSummary(evidence.deployment.assertions.anonymousRedirect)}
- Authenticated HTTP 200: ${assertionSummary(evidence.deployment.assertions.authenticatedHttp200)}
- Exact Git binding: ${assertionSummary(evidence.deployment.assertions.exactGitBinding)}
- HTML mutation: ${assertionSummary(evidence.deployment.assertions.htmlMutation)}
- ${privatePreviewCoordinatesSummary(evidence)}

## 16. Known caveats

${evidence.knownCaveats.map((item) => `- ${item}`).join("\n")}

## 17. Production-safety proof

${assertionSummary(evidence.deployment.assertions.productionUnchanged)}

No public, participant, paid, production, source-integration, runtime-AI, schema, Community/Marketplace mutation, reputation, billing, payout, or economic activation is included.

## 18. Rollback

${evidence.rollback.map((item) => `- ${item}`).join("\n")}

## 19. Founder checklist

${evidence.humanComprehension.checklist.map((item) => `- [ ] ${item}`).join("\n")}

## 20. Founder decision request

- [ ] APPROVE GROWTH EXPERIENCE PHASE 1B-R CONTRACT FOR A SEPARATELY AUTHORIZED NEXT GATE
- [ ] APPROVE GROWTH EXPERIENCE PHASE 1B-R WITH AMENDMENTS — [exact amendments]
- [ ] HOLD GROWTH EXPERIENCE PHASE 1B-R — [exact blockers]
- [ ] REJECT GROWTH EXPERIENCE PHASE 1B-R — [reason]

No decision exists until the Founder explicitly records one.`);
}

function handoffText(provenance, evidence) {
  return normalizeText(`CREDITVECTOR GROWTH EXPERIENCE PHASE 1B-R — FOUNDER HANDOFF

${privatePreviewSummary(evidence)}

CONTROLLING STATUS
${STATUS_LINES.join("\n")}

CANDIDATE IDENTITY
Baseline: ${provenance.baselineSha}
Candidate: ${provenance.candidateSha}
Remote: ${provenance.remoteSha}
Branch: ${provenance.branch}
Range: ${provenance.commitRange}

REMEDIATION
- authority language no longer carries work authorization into contract approval;
- owner maturity follows the unchanged frozen registry;
- explicit reasoned 7 x 10 classifications replace blacklist behavior;
- completion, submission, correction, appeal, support, synthetic state, and ownership remain distinct;
- canonical Kai has one deterministic route-local explanation mode only;
- hosted production and unknown identity fail closed;
- privacy copy is limited to Growth Experience-owned behavior;
- ${browserBehaviorSummary(evidence)}

EVIDENCE
Observed at: ${evidence.observedAt}
Validation: ${resultSummary(evidence.validation)}
Browser/accessibility: ${resultSummary(evidence.browser)}
Human comprehension: ${evidence.humanComprehension.status}
Preview: ${evidence.deployment.result} / ${evidence.deployment.state}
${privatePreviewCoordinatesSummary(evidence)}

FOUNDER CHECKLIST
${evidence.humanComprehension.checklist.map((item) => `[ ] ${item}`).join("\n")}

FOUNDER DECISION — ALL UNCHECKED
[ ] APPROVE
[ ] APPROVE WITH AMENDMENTS
[ ] HOLD
[ ] REJECT

No decision exists until the Founder explicitly records one. No merge or production deployment is authorized by this handoff.`);
}

function validationLedgerHtml(evidence) {
  const rows = evidence.validation
    .map((row) => `<tr><td>${escapeHtml(row.id)}</td><td><strong>${escapeHtml(row.result)}</strong></td><td>${escapeHtml(row.detail)}</td><td>${escapeHtml(row.rawEvidenceSha256 ?? "No raw digest claimed")}</td></tr>`)
    .join("");
  return standaloneHtml(
    "Growth Experience Phase 1B-R — Validation Ledger",
    `<h1>Growth Experience Phase 1B-R — Validation Ledger</h1><p>Evidence observed at ${escapeHtml(evidence.observedAt)}. Results are limited to PASS, FAIL, NOT RUN, NOT APPLICABLE, or BLOCKED. A PASS requires a preserved raw-evidence digest.</p><div class="table-wrap" role="region" aria-label="Validation ledger" tabindex="0"><table><thead><tr><th scope="col">Evidence</th><th scope="col">Result</th><th scope="col">Detail</th><th scope="col">Raw evidence SHA-256</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    "Protected Founder evidence · package-safe ledger",
  );
}

function browserMatrixHtml(evidence) {
  const rows = evidence.browser
    .map((row) => `<tr><td>${escapeHtml(row.id)}</td><td><strong>${escapeHtml(row.result)}</strong></td><td>${escapeHtml(row.detail)}</td><td>${escapeHtml(row.rawEvidenceSha256 ?? "No raw digest claimed")}</td></tr>`)
    .join("");
  const checklist = evidence.humanComprehension.checklist
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return standaloneHtml(
    "Growth Experience Phase 1B-R — Browser Matrix",
    `<h1>Growth Experience Phase 1B-R — Browser Matrix</h1><p>Evidence observed at ${escapeHtml(evidence.observedAt)}. Arrival-settled evidence is separate from first-frame disclosure evidence. Local optimized-build and protected-Preview claims remain distinct.</p><div class="table-wrap" role="region" aria-label="Browser matrix" tabindex="0"><table><thead><tr><th scope="col">Evidence</th><th scope="col">Result</th><th scope="col">Detail</th><th scope="col">Raw evidence SHA-256</th></tr></thead><tbody>${rows}</tbody></table></div><h2>Human comprehension</h2><p><strong>${escapeHtml(evidence.humanComprehension.status)}</strong></p><ul>${checklist}</ul>`,
    "Protected Founder evidence · browser and accessibility",
  );
}

function deploymentBom(provenance, evidence) {
  const delta = provenance.changedFiles
    .map((item) => `${item.status}\t${item.bytes}\t${item.sha256}\t${item.path}`)
    .join("\n");
  const closure = evidence.sourceClosure
    .map((item) => `${item.category}\t${item.bytes}\t${item.sha256}\t${item.path}`)
    .join("\n");
  return normalizeText(`CREDITVECTOR GROWTH EXPERIENCE PHASE 1B-R — DEPLOYMENT BILL OF MATERIALS

SCHEMA VERSION
${EVIDENCE_SCHEMA_VERSION}

CONTROLLING STATUS
${STATUS_LINES.join("\n")}

LINEAGE
Evidence observed at: ${evidence.observedAt}
Baseline SHA: ${provenance.baselineSha}
Candidate SHA: ${provenance.candidateSha}
Remote SHA: ${provenance.remoteSha}
Branch: ${provenance.branch}
Merge base: ${provenance.mergeBase}
Parent SHA(s): ${provenance.parents.join(", ")}
Commit range: ${provenance.commitRange}
Ordered commits: ${provenance.commits.join(", ")}

EXACT CANDIDATE DELTA
STATUS\tBYTES\tSHA-256\tREPOSITORY-RELATIVE PATH
${delta}

TRANSITIVE SOURCE CLOSURE
CATEGORY\tBYTES\tSHA-256\tREPOSITORY-RELATIVE PATH
${closure}

DEPLOYMENT IDENTITY
Target: ${evidence.deployment.target}
Result: ${evidence.deployment.result}
State: ${evidence.deployment.state}
Git binding: ${verifiedBinding(evidence.deployment, "exactGitBinding")}
Protection: ${assertionSummary(evidence.deployment.assertions.protection)}
Anonymous redirect: ${assertionSummary(evidence.deployment.assertions.anonymousRedirect)}
Authenticated HTTP 200: ${assertionSummary(evidence.deployment.assertions.authenticatedHttp200)}
Production unchanged: ${assertionSummary(evidence.deployment.assertions.productionUnchanged)}
Exact Git binding: ${assertionSummary(evidence.deployment.assertions.exactGitBinding)}
${privatePreviewCoordinatesSummary(evidence)}

BUILD IDENTITY
Result: ${evidence.build.result}
Command summary: ${evidence.build.commandSummary}
Git binding: ${verifiedBinding(evidence.build, "candidateBinding")}
Optimized review: ${assertionSummary(evidence.build.assertions.optimizedReview)}
Identity: ${assertionSummary(evidence.build.assertions.identity)}
Candidate binding: ${assertionSummary(evidence.build.assertions.candidateBinding)}

RAW EVIDENCE INDEX
Verified files: ${evidence.rawEvidence.length}
Each schema-v${EVIDENCE_SCHEMA_VERSION} envelope binds the candidate SHA, exact evidence kind, exact namespaced claimIds, executed command/assertion summary, exit/result, capture timestamp, and verified file path/bytes/hash. Executable PASS receipts require exitCode 0. Every packaged PASS digest resolves to an actual regular non-symlink file with a matching PASS envelope that names the referencing claim. Private raw-evidence paths and contents are omitted from this distributable.

PLATFORM HTML MUTATION
${assertionSummary(evidence.deployment.assertions.htmlMutation)}

EXCLUSIONS
${evidence.exclusions.map((item) => `- ${item}`).join("\n")}

ARTIFACT IDENTITY
Generator candidate: ${provenance.candidateSha}
Package: ${ZIP_NAME}
Members, in exact order:
${PACKAGE_MEMBERS.map((name, index) => `${index + 1}. ${name}`).join("\n")}
The evidence manifest records hashes for the eight non-manifest members. The external package-integrity record hashes all nine members, including the manifest, plus the ZIP. The ZIP hash is external because an archive cannot contain its own final hash without recursion.

ROLLBACK
${evidence.rollback.map((item) => `- ${item}`).join("\n")}`);
}

function decisionReceiptHtml() {
  const choices = [
    "APPROVE",
    "APPROVE WITH AMENDMENTS",
    "HOLD",
    "REJECT",
  ];
  return standaloneHtml(
    "Growth Experience Phase 1B-R — Founder Decision Receipt",
    `<h1>Growth Experience Phase 1B-R — Founder Decision Receipt</h1><p><strong>No decision exists until the Founder explicitly records one.</strong></p><p>Every choice below is intentionally unchecked. This static receipt does not submit, save, or infer a decision.</p>${choices.map((choice, index) => `<label class="decision" for="decision-${index}"><input id="decision-${index}" type="checkbox" disabled><span><strong>${escapeHtml(choice)}</strong></span></label>`).join("")}<h2>Decision boundary</h2><p>Approval would apply only to the proposed Phase 1B-R contract for a separately authorized next gate. It would not authorize merge, production deployment, public or participant access, paid activation, source integration, schema, runtime AI, commerce, billing, payout, or economics.</p>`,
    "Protected Founder review · static unchecked receipt",
  );
}

function evidenceManifest(payloads, provenance) {
  const records = HASHED_MEMBERS.map((name) => {
    const bytes = payloads.get(name);
    check(bytes, `manifest source is missing ${name}`);
    return `${sha256(bytes)}  ${bytes.byteLength}  ${name}`;
  });
  return normalizeText([
    "# CreditVector Growth Experience Phase 1B-R — evidence manifest",
    `# Candidate SHA: ${provenance.candidateSha}`,
    "# SHA-256 and byte counts cover the eight non-manifest members.",
    "# The manifest hash and ZIP hash are published externally to avoid recursive hashing.",
    ...records,
  ].join("\n"));
}

export function generatePayloads(provenance, evidence) {
  const payloads = new Map();
  const report = reportMarkdown(provenance, evidence);
  payloads.set(PACKAGE_MEMBERS[0], Buffer.from(report));
  payloads.set(PACKAGE_MEMBERS[1], Buffer.from(markdownHtml("Growth Experience Phase 1B-R — Founder Report", report, "Protected Founder review · sanitized report")));
  const handoff = handoffText(provenance, evidence);
  payloads.set(PACKAGE_MEMBERS[2], Buffer.from(handoff));
  payloads.set(PACKAGE_MEMBERS[3], Buffer.from(markdownHtml("Growth Experience Phase 1B-R — Founder Handoff", handoff, "Protected Founder review · sanitized handoff")));
  payloads.set(PACKAGE_MEMBERS[4], Buffer.from(validationLedgerHtml(evidence)));
  payloads.set(PACKAGE_MEMBERS[5], Buffer.from(browserMatrixHtml(evidence)));
  payloads.set(PACKAGE_MEMBERS[7], Buffer.from(deploymentBom(provenance, evidence)));
  payloads.set(PACKAGE_MEMBERS[8], Buffer.from(decisionReceiptHtml()));
  payloads.set(PACKAGE_MEMBERS[6], Buffer.from(evidenceManifest(payloads, provenance)));

  for (const name of PACKAGE_MEMBERS) {
    const bytes = payloads.get(name);
    check(bytes && bytes.byteLength > 0, `generated payload is absent or empty: ${name}`);
    const text = bytes.toString("utf8");
    if (name.endsWith(".html")) scanHtml(text, name);
    else scanText(text, name);
  }
  return payloads;
}

function writeDeterministic(filePath, bytes, timestamp) {
  writeFileSync(filePath, bytes, { mode: 0o644 });
  chmodSync(filePath, 0o644);
  utimesSync(filePath, timestamp, timestamp);
}

export function buildStagedPackage(stageRoot, provenance, evidence) {
  mkdirSync(stageRoot, { recursive: true, mode: 0o755 });
  const timestamp = new Date(provenance.commitEpoch * 1000);
  const payloads = generatePayloads(provenance, evidence);
  for (const name of PACKAGE_MEMBERS) {
    writeDeterministic(join(stageRoot, name), payloads.get(name), timestamp);
  }

  const zipPath = join(stageRoot, ZIP_NAME);
  command("zip", ["-q", "-X", "-D", ZIP_NAME, ...PACKAGE_MEMBERS], {
    cwd: stageRoot,
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1",
      LC_ALL: "C",
      TZ: "UTC",
      SOURCE_DATE_EPOCH: String(provenance.commitEpoch),
    },
  });
  chmodSync(zipPath, 0o644);
  utimesSync(zipPath, timestamp, timestamp);
  return { payloads, zipBytes: readFileSync(zipPath) };
}

function compareBuilds(first, second) {
  for (const name of PACKAGE_MEMBERS) {
    check(first.payloads.get(name).equals(second.payloads.get(name)), `non-deterministic payload: ${name}`);
  }
  check(first.zipBytes.equals(second.zipBytes), "non-deterministic ZIP bytes");
}

function installArtifacts(stageRoot, provenance) {
  const timestamp = new Date(provenance.commitEpoch * 1000);
  for (const name of [...PACKAGE_MEMBERS, ZIP_NAME]) {
    const source = join(stageRoot, name);
    const temporary = join(REPOSITORY_ROOT, `.${name}.phase1br.tmp`);
    const target = join(REPOSITORY_ROOT, name);
    copyFileSync(source, temporary);
    chmodSync(temporary, 0o644);
    utimesSync(temporary, timestamp, timestamp);
    renameSync(temporary, target);
  }
}

function parseArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function evidenceTemplate() {
  const notRunRows = (ids) => ids.map((id) => ({
    id,
    label: id.replaceAll("-", " "),
    result: "NOT RUN",
    detail: "Evidence has not been supplied.",
    rawEvidenceSha256: null,
  }));
  const notRunAssertion = (detail = "Evidence has not been supplied.") => ({
    result: "NOT RUN",
    detail,
    rawEvidenceSha256: null,
  });
  const validation = notRunRows(REQUIRED_VALIDATION_IDS);
  const exactNine = validation.find((row) => row.id === "exact-nine-package-integrity");
  exactNine.detail = "External package-integrity.json is authoritative and is created only after package validation.";
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    observedAt: "REPLACE WITH ISO TIMESTAMP",
    baselineSha: EXPECTED_BASELINE_SHA,
    candidateSha: "REPLACE WITH CANDIDATE SHA",
    remoteSha: "REPLACE WITH REMOTE SHA",
    branch: EXPECTED_BRANCH,
    rawEvidence: [],
    validation,
    browser: notRunRows(REQUIRED_BROWSER_IDS),
    humanComprehension: {
      status: "NOT HUMAN-VALIDATED",
      checklist: [...REQUIRED_COMPREHENSION_CHECKLIST],
      rawEvidenceSha256: null,
    },
    deployment: {
      result: "NOT RUN",
      target: "Preview",
      state: "NOT RUN",
      gitBindingSha: null,
      privateReferenceOmitted: true,
      assertions: {
        protection: notRunAssertion(),
        anonymousRedirect: notRunAssertion(),
        authenticatedHttp200: notRunAssertion(),
        productionUnchanged: notRunAssertion(),
        exactGitBinding: notRunAssertion(),
        htmlMutation: {
          result: "NOT APPLICABLE",
          detail: "Package HTML is not asserted to have been served through a mutating platform.",
          rawEvidenceSha256: null,
        },
      },
    },
    build: {
      result: "NOT RUN",
      commandSummary: "NOT RUN",
      gitBindingSha: null,
      assertions: {
        optimizedReview: notRunAssertion(),
        identity: notRunAssertion(),
        candidateBinding: notRunAssertion(),
      },
    },
    sourceClosure: Object.entries(REQUIRED_SOURCE_PATHS).map(([path, category]) => ({
      category,
      path,
      bytes: 0,
      sha256: "REPLACE WITH SHA-256",
    })),
    exclusions: [...CANONICAL_EXCLUSIONS],
    knownCaveats: ["Human comprehension is not validated."],
    rollback: ["Retire the protected Preview and revert the bounded candidate commit."],
  };
}

function main() {
  if (process.argv.includes("--print-evidence-template")) {
    process.stdout.write(`${JSON.stringify(evidenceTemplate(), null, 2)}\n`);
    return;
  }

  const evidenceArgument = parseArgument("--evidence");
  check(evidenceArgument, `usage: node scripts/build-growth-experience-phase-1b-r-package.mjs --evidence ${EVIDENCE_ROOT_NAME}/<package-safe-evidence.json>`);
  const evidencePath = resolveEvidenceIndexPath(evidenceArgument);

  const provenance = collectProvenance();
  const evidence = validateEvidence(JSON.parse(readFileSync(evidencePath, "utf8")), provenance);
  const firstRoot = mkdtempSync(join(tmpdir(), "phase1br-package-a-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "phase1br-package-b-"));
  try {
    const first = buildStagedPackage(firstRoot, provenance, evidence);
    const second = buildStagedPackage(secondRoot, provenance, evidence);
    compareBuilds(first, second);
    installArtifacts(firstRoot, provenance);
    process.stdout.write(`${JSON.stringify({
      result: "PASS",
      candidateSha: provenance.candidateSha,
      remoteSha: provenance.remoteSha,
      zip: ZIP_NAME,
      zipBytes: first.zipBytes.byteLength,
      zipSha256: sha256(first.zipBytes),
      members: PACKAGE_MEMBERS.map((name) => ({
        name,
        bytes: first.payloads.get(name).byteLength,
        sha256: sha256(first.payloads.get(name)),
      })),
      note: "ZIP SHA-256 is external to the archive by design.",
    }, null, 2)}\n`);
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main();
}
