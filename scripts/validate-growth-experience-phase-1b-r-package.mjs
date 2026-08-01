#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_ROOT_NAME,
  HASHED_MEMBERS,
  PACKAGE_MEMBERS,
  REPOSITORY_ROOT,
  RETIRED_PACKAGE_ARTIFACTS,
  ZIP_NAME,
  assertBuildLogExecutedBinding,
  buildStagedPackage,
  collectProvenance,
  collectTrackedRepositoryBom,
  finalStatusLine,
  generatePayloads,
  resolveEvidenceIndexPath,
  scanHtml,
  scanText,
  sha256,
  validateEvidence,
} from "./build-growth-experience-phase-1b-r-package.mjs";

const VALIDATOR_SCRIPT_PATH = fileURLToPath(import.meta.url);
const failures = [];
const EXACT_PACKAGE_MEMBERS = Object.freeze([
  "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.md",
  "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.txt",
  "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_CAPABILITY_CONTRACT.md",
  "GROWTH_EXPERIENCE_PHASE_1B_R_VALIDATION_LEDGER.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_BROWSER_MATRIX.html",
  "GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE_MANIFEST.txt",
  "GROWTH_EXPERIENCE_PHASE_1B_R_FOUNDER_DECISION_RECEIPT.md",
]);
const EXACT_RECEIPT_CHOICES = Object.freeze([
  "- [ ] APPROVE",
  "- [ ] APPROVE WITH AMENDMENTS",
  "- [ ] HOLD",
  "- [ ] REJECT",
]);
const VALIDATOR_EXACT_BUILD_COMMANDS = Object.freeze([
  Object.freeze({
    id: "optimized-review-build",
    sanitizedCommand:
      "VERCEL_ENV→<PREVIEW> NEXT_PUBLIC_VERCEL_ENV→<PREVIEW> NEXT_PUBLIC_CXOS_REVIEW→<ENABLED> GROWTH_CENTER_PREVIEW_ENABLED→<ENABLED> GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED→<ENABLED> npx next build",
  }),
  Object.freeze({
    id: "production-identity-build",
    sanitizedCommand:
      "VERCEL_ENV→<PRODUCTION> NEXT_PUBLIC_VERCEL_ENV→<PREVIEW-SPOOF> NEXT_PUBLIC_CXOS_REVIEW→<ENABLED-SPOOF> GROWTH_CENTER_PREVIEW_ENABLED→<ENABLED-SPOOF> GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED→<ENABLED-SPOOF> npx next build",
  }),
]);

export function assertValidatorExactBuildCommands(commands) {
  if (
    JSON.stringify(commands) !== JSON.stringify(VALIDATOR_EXACT_BUILD_COMMANDS)
  ) {
    throw new Error(
      "validator rejected missing, extra, reordered, or altered exact build commands",
    );
  }
}

function expectContractRejection(label, action) {
  try {
    action();
  } catch {
    return label;
  }
  throw new Error(`negative contract self-test was not rejected: ${label}`);
}

export function runContractSelfTests() {
  const exact = structuredClone(VALIDATOR_EXACT_BUILD_COMMANDS);
  assertValidatorExactBuildCommands(exact);
  assertBuildLogExecutedBinding({
    evidenceKind: "BUILD_LOG",
    claimIds: [
      "build:optimizedReview",
      "validation:optimized-review-build",
    ],
    executed: exact[0].sanitizedCommand,
  });
  const rejected = [];
  rejected.push(
    expectContractRejection("unrelated BUILD_LOG executed value", () =>
      assertBuildLogExecutedBinding({
        evidenceKind: "BUILD_LOG",
        claimIds: [
          "build:optimizedReview",
          "validation:optimized-review-build",
        ],
        executed: "echo unrelated",
      }),
    ),
  );
  rejected.push(
    expectContractRejection("mixed build-command claim groups", () =>
      assertBuildLogExecutedBinding({
        evidenceKind: "BUILD_LOG",
        claimIds: ["build:identity", "build:optimizedReview"],
        executed: exact[0].sanitizedCommand,
      }),
    ),
  );
  rejected.push(
    expectContractRejection("altered BUILD_LOG executed value", () =>
      assertBuildLogExecutedBinding({
        evidenceKind: "BUILD_LOG",
        claimIds: [
          "build:optimizedReview",
          "validation:optimized-review-build",
        ],
        executed: `${exact[0].sanitizedCommand} --altered`,
      }),
    ),
  );
  const altered = structuredClone(exact);
  altered[0].sanitizedCommand += " --altered";
  for (const [label, commands] of [
    ["missing exact build command", exact.slice(0, 1)],
    [
      "extra exact build command",
      [...exact, { id: "extra", sanitizedCommand: "npx next build" }],
    ],
    ["reordered exact build commands", [...exact].reverse()],
    ["altered exact build command", altered],
  ]) {
    rejected.push(
      expectContractRejection(label, () =>
        assertValidatorExactBuildCommands(commands),
      ),
    );
  }
  return Object.freeze({
    result: "PASS",
    exactAccepted: true,
    rejected,
  });
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: options.cwd ?? REPOSITORY_ROOT,
    encoding: options.encoding === undefined ? "utf8" : options.encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  check(result.status === 0, `${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function parseArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeHtmlForVerification(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function verifyExactBuildCommandEvidence(evidence, observed) {
  try {
    assertValidatorExactBuildCommands(evidence.build.commands);
  } catch (error) {
    check(false, error.message);
  }
  const targets = [
    "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.md",
    "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.html",
    "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.txt",
    "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.html",
    "GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE_MANIFEST.txt",
  ];
  for (const name of targets) {
    const rendered = observed.get(name)?.toString("utf8") ?? "";
    let priorIndex = -1;
    for (const commandRecord of VALIDATOR_EXACT_BUILD_COMMANDS) {
      const exactCommand = name.endsWith(".html")
        ? escapeHtmlForVerification(commandRecord.sanitizedCommand)
        : commandRecord.sanitizedCommand;
      const index = rendered.indexOf(exactCommand);
      check(index >= 0, `${name} omits exact build command ${commandRecord.id}`);
      check(index > priorIndex, `${name} reorders exact build command ${commandRecord.id}`);
      priorIndex = index;
    }
    check(
      (rendered.match(/npx next build/gu) ?? []).length ===
        VALIDATOR_EXACT_BUILD_COMMANDS.length,
      `${name} contains a missing or extra rendered build command`,
    );
  }
}

function verifyFiles(provenance, evidence) {
  check(
    JSON.stringify(PACKAGE_MEMBERS) === JSON.stringify(EXACT_PACKAGE_MEMBERS),
    "builder package member contract does not equal the exact mandated nine names/order",
  );
  const expected = generatePayloads(provenance, evidence);
  const observed = new Map();
  const expectedTime = provenance.commitEpoch * 1000;

  for (const name of PACKAGE_MEMBERS) {
    const filePath = join(REPOSITORY_ROOT, name);
    check(existsSync(filePath), `missing package member source ${name}`);
    if (!existsSync(filePath)) continue;
    const info = lstatSync(filePath);
    check(info.isFile(), `${name} is not a regular file`);
    check(!info.isSymbolicLink(), `${name} is a symbolic link`);
    check((info.mode & 0o777) === 0o644, `${name} mode is not 0644`);
    check(Math.abs(info.mtimeMs - expectedTime) < 1000, `${name} does not use the candidate timestamp`);
    const bytes = readFileSync(filePath);
    observed.set(name, bytes);
    check(bytes.byteLength > 0, `${name} is empty`);
    check(bytes.equals(expected.get(name)), `${name} differs from deterministic generation`);
    const text = bytes.toString("utf8");
    try {
      if (name.endsWith(".html")) scanHtml(text, name);
      else scanText(text, name);
    } catch (error) {
      check(false, error.message);
    }
  }

  for (const name of RETIRED_PACKAGE_ARTIFACTS) {
    check(!existsSync(join(REPOSITORY_ROOT, name)), `retired package artifact still exists: ${name}`);
  }
  verifyExactBuildCommandEvidence(evidence, observed);

  const manifestName = "GROWTH_EXPERIENCE_PHASE_1B_R_EVIDENCE_MANIFEST.txt";
  const manifestText = observed.get(manifestName)?.toString("utf8") ?? "";
  const records = manifestText
    .split("\n")
    .filter((line) => /^[0-9a-f]{64}  [0-9]+  /u.test(line));
  check(records.length === HASHED_MEMBERS.length, "evidence manifest must contain exactly eight hash records");
  records.forEach((line, index) => {
    const [hash, byteText, name] = line.split("  ");
    check(name === HASHED_MEMBERS[index], `manifest order/name mismatch at record ${index + 1}`);
    const bytes = observed.get(name);
    if (!bytes) return;
    check(hash === sha256(bytes), `manifest hash mismatch for ${name}`);
    check(Number(byteText) === bytes.byteLength, `manifest byte count mismatch for ${name}`);
  });

  const expectedBom = collectTrackedRepositoryBom(provenance.candidateSha);
  check(
    manifestText.includes(`Tracked blob count: ${expectedBom.length}`),
    "evidence manifest omits the complete tracked-blob count",
  );
  for (const item of expectedBom) {
    const record = `${item.category}\t${item.mode}\t${item.bytes}\t${item.sha256}\t${item.path}`;
    check(manifestText.includes(record), `evidence manifest omits tracked BOM record ${item.path}`);
  }
  for (const item of provenance.changedFiles) {
    const record = `${item.status}\t${item.bytes}\t${item.sha256}\t${item.path}`;
    check(manifestText.includes(record), `evidence manifest omits candidate delta record ${item.path}`);
  }
  for (const value of [
    provenance.baselineSha,
    provenance.candidateSha,
    provenance.remoteSha,
    provenance.branch,
    provenance.mergeBase,
    provenance.commitRange,
    ...provenance.parents,
    ...provenance.commits,
  ]) {
    check(manifestText.includes(value), `evidence manifest omits provenance value ${value}`);
  }
  for (const raw of evidence.rawEvidence) {
    check(manifestText.includes(raw.sha256), `evidence manifest omits raw-evidence digest ${raw.sha256}`);
  }
  check(manifestText.includes(finalStatusLine(evidence)), "evidence manifest omits the dynamic final status");
  check(!/Final ZIP byte size:\s*\d/iu.test(manifestText), "evidence manifest recursively embeds final ZIP byte size");
  check(!/Final ZIP SHA-256:\s*[0-9a-f]{64}/iu.test(manifestText), "evidence manifest recursively embeds final ZIP SHA-256");

  const receiptName = "GROWTH_EXPERIENCE_PHASE_1B_R_FOUNDER_DECISION_RECEIPT.md";
  const receipt = observed.get(receiptName)?.toString("utf8") ?? "";
  const receiptChoices = receipt.split("\n").filter((line) => /^- \[[^\]]*\] /u.test(line));
  check(
    JSON.stringify(receiptChoices) === JSON.stringify(EXACT_RECEIPT_CHOICES),
    "Founder receipt must contain exactly four canonical unchecked Markdown choices in order",
  );
  check(!/^- \[[xX]\] /mu.test(receipt), "Founder receipt contains a checked choice");
  check(receipt.includes("No decision exists until the Founder explicitly records one."), "Founder receipt lacks no-decision statement");

  for (const reportName of [
    "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.md",
    "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.html",
  ]) {
    const report = observed.get(reportName)?.toString("utf8") ?? "";
    for (const member of PACKAGE_MEMBERS) {
      check(report.includes(member), `${reportName} omits package member ${member}`);
    }
    check(report.includes(`Archive filename: ${ZIP_NAME}`), `${reportName} omits archive filename`);
    check(report.includes(`Exact member count: ${EXACT_PACKAGE_MEMBERS.length}`), `${reportName} omits exact member count`);
    check(report.includes(finalStatusLine(evidence)), `${reportName} omits dynamic final status`);
    check(!/ZIP SHA-256:\s*[0-9a-f]{64}/iu.test(report), `${reportName} recursively embeds final ZIP SHA-256`);
    check(!/ZIP (?:byte size|bytes):\s*\d/iu.test(report), `${reportName} recursively embeds final ZIP byte size`);
  }

  for (const handoffName of [
    "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.txt",
    "GROWTH_EXPERIENCE_PHASE_1B_R_HANDOFF.html",
  ]) {
    const handoff = observed.get(handoffName)?.toString("utf8") ?? "";
    check(handoff.includes(finalStatusLine(evidence)), `${handoffName} omits dynamic final status`);
    check(handoff.includes(evidence.humanComprehension.evaluatorBasis), `${handoffName} omits evaluator basis`);
    if (handoffName.endsWith(".html")) {
      check(handoff.includes("COMPREHENSION REVIEW"), `${handoffName} omits comprehension review section`);
      continue;
    }
    check(handoff.includes(evidence.humanComprehension.method), `${handoffName} omits comprehension method`);
    for (const prompt of evidence.humanComprehension.prompts) {
      check(handoff.includes(prompt.prompt), `${handoffName} omits comprehension prompt ${prompt.id}`);
      check(handoff.includes(prompt.outcome), `${handoffName} omits comprehension outcome ${prompt.id}`);
    }
    for (const change of evidence.humanComprehension.resultingCopyChanges) {
      check(handoff.includes(change), `${handoffName} omits comprehension copy-change disposition`);
    }
  }

  return observed;
}

function verifyZip(provenance, observed) {
  const archivePath = join(REPOSITORY_ROOT, ZIP_NAME);
  check(existsSync(archivePath), `missing ${ZIP_NAME}`);
  if (!existsSync(archivePath)) return Buffer.alloc(0);
  const info = lstatSync(archivePath);
  check(info.isFile(), `${ZIP_NAME} is not a regular file`);
  check(!info.isSymbolicLink(), `${ZIP_NAME} is a symbolic link`);
  check((info.mode & 0o777) === 0o644, `${ZIP_NAME} mode is not 0644`);
  check(Math.abs(info.mtimeMs - provenance.commitEpoch * 1000) < 1000, `${ZIP_NAME} does not use the candidate timestamp`);

  command("unzip", ["-t", archivePath]);
  const listed = command("zipinfo", ["-1", archivePath])
    .trim()
    .split("\n")
    .filter(Boolean);
  check(JSON.stringify(listed) === JSON.stringify(EXACT_PACKAGE_MEMBERS), `ZIP member allowlist/order mismatch: ${JSON.stringify(listed)}`);

  for (const name of listed) {
    check(!name.startsWith("/"), `ZIP member is absolute: ${name}`);
    check(!name.includes("/"), `ZIP member is not flat: ${name}`);
    check(!name.includes(".."), `ZIP member contains traversal: ${name}`);
    check(!/^(?:__MACOSX|\.DS_Store|\._|Thumbs\.db|desktop\.ini)/iu.test(name), `ZIP member is hidden metadata: ${name}`);
    const extracted = command("unzip", ["-p", archivePath, name], { encoding: null });
    check(Buffer.isBuffer(extracted), `could not extract ${name}`);
    if (Buffer.isBuffer(extracted) && observed.get(name)) {
      check(extracted.equals(observed.get(name)), `ZIP member differs from authoritative file: ${name}`);
    }
  }

  const verbose = command("zipinfo", ["-v", archivePath]);
  const extraLengths = [...verbose.matchAll(/length of extra field:\s+(\d+) bytes/gu)].map((match) => Number(match[1]));
  check(extraLengths.length === PACKAGE_MEMBERS.length, "could not account for every ZIP extra field");
  check(extraLengths.every((length) => length === 0), "ZIP contains extra fields or platform metadata");
  check(!/apparently encrypted:\s+yes/iu.test(verbose), "ZIP is encrypted");

  const modes = command("zipinfo", ["-l", archivePath]);
  check(!/^l/mu.test(modes), "ZIP contains a symbolic-link member");
  check((modes.match(/^-rw-r--r--/gmu) ?? []).length === PACKAGE_MEMBERS.length, "ZIP members are not all regular 0644 files");

  return readFileSync(archivePath);
}

function verifyDeterministicRebuild(provenance, evidence, rootZipBytes) {
  const firstRoot = mkdtempSync(join(tmpdir(), "phase1br-verify-a-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "phase1br-verify-b-"));
  try {
    const first = buildStagedPackage(firstRoot, provenance, evidence);
    const second = buildStagedPackage(secondRoot, provenance, evidence);
    for (const name of PACKAGE_MEMBERS) {
      check(first.payloads.get(name).equals(second.payloads.get(name)), `two-build payload mismatch: ${name}`);
      check(first.payloads.get(name).equals(readFileSync(join(REPOSITORY_ROOT, name))), `rebuilt payload differs from root: ${name}`);
    }
    check(first.zipBytes.equals(second.zipBytes), "two-build ZIP mismatch");
    check(first.zipBytes.equals(rootZipBytes), "rebuilt ZIP differs from root ZIP");
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
}

function writeIntegrityEvidence(evidencePath, provenance, evidence, zipBytes, observed) {
  const integrity = {
    schemaVersion: 2,
    result: "PASS",
    readinessStatus: finalStatusLine(evidence),
    candidateSha: provenance.candidateSha,
    remoteSha: provenance.remoteSha,
    zip: ZIP_NAME,
    zipBytes: zipBytes.byteLength,
    zipSha256: sha256(zipBytes),
    memberCount: EXACT_PACKAGE_MEMBERS.length,
    members: PACKAGE_MEMBERS.map((name) => ({
      name,
      bytes: observed.get(name).byteLength,
      sha256: sha256(observed.get(name)),
    })),
    assertions: [
      "exact flat member allowlist and order",
      "regular 0644 files with no symlinks",
      "no traversal, hidden metadata, encryption, or extra fields",
      "member bytes equal deterministic generation",
      "two independent package builds are byte-identical",
      "sanitization and strict standalone HTML scans pass with only the exact embedded local copy-control script",
      `schema-v${EVIDENCE_SCHEMA_VERSION} evidence envelopes bind candidate, exact kind, exact namespaced claimIds, execution, exit/result, capture time, and verified file identity`,
      "executable PASS receipts require exitCode 0",
      "package-safe evidence resolves every PASS digest to a matching preserved PASS envelope that names its referencing claim",
      "validation rows, structured deployment/build assertions, aggregates, and assertion-based Git bindings agree",
      "canonical exclusions are exact and complete",
      "source closure exactly matches every tracked Git blob with category, mode, byte count, digest, and path",
      "both Founder report formats enumerate all nine package members",
      "embedded artifacts do not recursively claim final ZIP byte size or SHA-256",
      "Founder decision receipt is Markdown with exactly four canonical unchecked choices",
      "structured evaluator-basis comprehension records method, non-human basis, six exact prompts, outcomes, copy-change disposition, and a PASS HUMAN_REVIEW digest",
    ],
    note: "This external evidence is intentionally not embedded in the ZIP it verifies.",
  };
  const outputPath = join(dirname(evidencePath), "package-integrity.json");
  writeFileSync(outputPath, `${JSON.stringify(integrity, null, 2)}\n`, { mode: 0o644 });
  chmodSync(outputPath, 0o644);
  return { outputPath, integrity };
}

function main() {
  const evidenceArgument = parseArgument("--evidence");
  if (!evidenceArgument) {
    process.stderr.write(`usage: node scripts/validate-growth-experience-phase-1b-r-package.mjs --evidence ${EVIDENCE_ROOT_NAME}/<package-safe-evidence.json>\n`);
    process.exit(2);
  }
  let evidencePath;
  try {
    evidencePath = resolveEvidenceIndexPath(evidenceArgument);
  } catch (error) {
    process.stderr.write(`PACKAGE VERIFICATION FAILED\n- ${error.message}\n`);
    process.exit(2);
  }

  let provenance;
  let evidence;
  try {
    provenance = collectProvenance();
    evidence = validateEvidence(JSON.parse(readFileSync(evidencePath, "utf8")), provenance);
  } catch (error) {
    process.stderr.write(`PACKAGE VERIFICATION FAILED\n- ${error.message}\n`);
    process.exit(1);
  }

  const observed = verifyFiles(provenance, evidence);
  const zipBytes = verifyZip(provenance, observed);
  if (zipBytes.byteLength > 0) verifyDeterministicRebuild(provenance, evidence, zipBytes);

  if (failures.length > 0) {
    process.stderr.write(`PACKAGE VERIFICATION FAILED (${failures.length})\n`);
    for (const failure of failures) process.stderr.write(`- ${failure}\n`);
    process.exit(1);
  }

  const { integrity } = writeIntegrityEvidence(evidencePath, provenance, evidence, zipBytes, observed);
  process.stdout.write(`${JSON.stringify(integrity, null, 2)}\n`);
}

if (resolve(process.argv[1] ?? "") === VALIDATOR_SCRIPT_PATH) {
  if (process.argv.includes("--self-test-contracts")) {
    process.stdout.write(`${JSON.stringify(runContractSelfTests(), null, 2)}\n`);
  } else {
    main();
  }
}
