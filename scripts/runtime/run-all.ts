// Run: npx --no-install tsx scripts/runtime/run-all.ts
//
// Runs every scripts/runtime/*.runtime.test.ts in its own process (each guard
// installs its own module mocks, so they must not share a module registry) and
// prints one house-style summary line. Exits non-zero if any guard fails.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const here = __dirname;
const guards = readdirSync(here)
  .filter((f) => f.endsWith(".runtime.test.ts"))
  .sort();

if (guards.length === 0) {
  console.error("run-all: no *.runtime.test.ts guards found — refusing to report success");
  process.exit(1);
}

let failed = 0;
for (const guard of guards) {
  const res = spawnSync(process.execPath, [require.resolve("tsx/cli"), join(here, guard)], {
    stdio: "inherit",
    cwd: join(here, "..", ".."),
  });
  if (res.status !== 0) failed++;
}

console.log(`\nscripts/runtime: ${guards.length - failed} guards passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
