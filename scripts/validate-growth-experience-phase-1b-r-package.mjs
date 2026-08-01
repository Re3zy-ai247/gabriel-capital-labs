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
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  EVIDENCE_ROOT_NAME,
  HASHED_MEMBERS,
  PACKAGE_MEMBERS,
  REPOSITORY_ROOT,
  ZIP_NAME,
  buildStagedPackage,
  collectProvenance,
  generatePayloads,
  resolveEvidenceIndexPath,
  scanHtml,
  scanText,
  sha256,
  validateEvidence,
} from "./build-growth-experience-phase-1b-r-package.mjs";

const failures = [];

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

function verifyFiles(provenance, evidence) {
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

  const receiptName = "GROWTH_EXPERIENCE_PHASE_1B_R_FOUNDER_DECISION_RECEIPT.html";
  const receipt = observed.get(receiptName)?.toString("utf8") ?? "";
  check((receipt.match(/type="checkbox" disabled/gu) ?? []).length === 4, "Founder receipt must contain exactly four disabled checkboxes");
  check(!/type="checkbox"[^>]*\schecked(?:\s|>)/iu.test(receipt), "Founder receipt contains a checked choice");
  for (const choice of ["APPROVE", "APPROVE WITH AMENDMENTS", "HOLD", "REJECT"]) {
    check(receipt.includes(choice), `Founder receipt is missing ${choice}`);
  }
  check(receipt.includes("No decision exists until the Founder explicitly records one."), "Founder receipt lacks no-decision statement");

  for (const reportName of [
    "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.md",
    "GROWTH_EXPERIENCE_PHASE_1B_R_REPORT.html",
  ]) {
    const report = observed.get(reportName)?.toString("utf8") ?? "";
    for (const member of PACKAGE_MEMBERS) {
      check(report.includes(member), `${reportName} omits package member ${member}`);
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
  check(JSON.stringify(listed) === JSON.stringify(PACKAGE_MEMBERS), `ZIP member allowlist/order mismatch: ${JSON.stringify(listed)}`);

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

function writeIntegrityEvidence(evidencePath, provenance, zipBytes, observed) {
  const integrity = {
    schemaVersion: 1,
    result: "PASS",
    candidateSha: provenance.candidateSha,
    remoteSha: provenance.remoteSha,
    zip: ZIP_NAME,
    zipBytes: zipBytes.byteLength,
    zipSha256: sha256(zipBytes),
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
      "sanitization and standalone HTML scans pass",
      "schema-v3 evidence envelopes bind candidate, exact kind, exact namespaced claimIds, execution, exit/result, capture time, and verified file identity",
      "executable PASS receipts require exitCode 0",
      "package-safe evidence resolves every PASS digest to a matching preserved PASS envelope that names its referencing claim",
      "validation rows, structured deployment/build assertions, aggregates, and assertion-based Git bindings agree",
      "canonical exclusions are exact and complete",
      "transitive source closure contains the exact 42-path canonical set",
      "both Founder report formats enumerate all nine package members",
      "embedded exact-nine status remains non-self-referential",
      "Founder decision receipt has four unchecked choices",
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

  const { integrity } = writeIntegrityEvidence(evidencePath, provenance, zipBytes, observed);
  process.stdout.write(`${JSON.stringify(integrity, null, 2)}\n`);
}

main();
