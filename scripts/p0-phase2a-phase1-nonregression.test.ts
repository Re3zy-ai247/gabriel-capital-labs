import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseline = "4bbdf5c561f94a132962d27971551096b53528d9";
const frozenPhase1SchemaSha256 =
  "a18b04ab0026c3e1b6e4dd6f034fa59182acf39fdcc1181f714bb79039bb9d91";

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isOrderedLineSubsequence(baselineText: string, currentText: string): boolean {
  const baselineLines = baselineText.split("\n");
  const currentLines = currentText.split("\n");
  let baselineIndex = 0;
  for (const line of currentLines) {
    if (line === baselineLines[baselineIndex]) baselineIndex += 1;
  }
  return baselineIndex === baselineLines.length;
}

let passed = 0;
function check(label: string, predicate: () => void): void {
  predicate();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${label}\n`);
}

const baselineSchema = git(["show", `${baseline}:prisma/schema.prisma`]);
const currentSchema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");

check("baseline object and exact frozen Phase 1 schema digest are available", () => {
  assert.equal(git(["cat-file", "-t", baseline]).trim(), "commit");
  assert.equal(sha256(baselineSchema), frozenPhase1SchemaSha256);
});

check("every frozen Phase 1 schema line survives in exact order", () => {
  assert.equal(isOrderedLineSubsequence(baselineSchema, currentSchema), true);
});

check("the reviewed schema and legacy upload seam tracked deltas are additions-only", () => {
  const rows = git([
    "diff",
    "--numstat",
    baseline,
    "--",
    "prisma/schema.prisma",
    "app/api/reports/upload/route.ts",
  ])
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  assert.deepEqual(
    rows.map(([added, deleted, path]) => ({ added: Number(added), deleted: Number(deleted), path })),
    [
      { added: 40, deleted: 0, path: "app/api/reports/upload/route.ts" },
      { added: 667, deleted: 0, path: "prisma/schema.prisma" },
    ],
  );
});

const frozenPaths = git([
  "ls-tree",
  "-r",
  "--name-only",
  baseline,
  "--",
  "lib/creditTruth",
  "prisma/migrations",
  "scripts",
])
  .trim()
  .split("\n")
  .filter(
    (path) =>
      path.startsWith("lib/creditTruth/") ||
      path.startsWith("prisma/migrations/20260808_p0_credit_truth_foundation/") ||
      /^scripts\/p0-(?!phase2a)/.test(path) ||
      path === "scripts/fixtures/p0-credit-truth.synthetic.json" ||
      path === "scripts/sql/p0-phase1-disposable-rollback.sql",
  );

check("all frozen Phase 1 source, tests, migration, verifier, and fixtures are byte-identical", () => {
  assert(frozenPaths.length > 0);
  for (const path of frozenPaths) {
    const currentPath = resolve(root, path);
    assert.equal(existsSync(currentPath), true, `${path} must remain present`);
    assert.equal(
      readFileSync(currentPath, "utf8"),
      git(["show", `${baseline}:${path}`]),
      `${path} must remain byte-identical`,
    );
  }
});

check("the frozen Phase 1 guard still pins the exact original schema digest", () => {
  const guard = readFileSync(
    resolve(root, "scripts/p0-phase1-migration-guard.test.ts"),
    "utf8",
  );
  assert(guard.includes(frozenPhase1SchemaSha256));
});

check("current HEAD descends from the exact accepted Phase 1.1 baseline", () => {
  assert.equal(git(["merge-base", "--is-ancestor", baseline, "HEAD"]), "");
});

check("Phase 2A index remains clean", () => {
  assert.equal(git(["diff", "--cached", "--name-only"]).trim(), "");
});

process.stdout.write(
  `${passed}/${passed} PASS p0-phase2a-phase1-nonregression\n`,
);
