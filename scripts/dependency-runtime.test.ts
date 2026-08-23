// Run: npx tsx scripts/dependency-runtime.test.ts
//
// Release guard for the exact dependency pair that closes the malformed
// NextAuth bearer-token advisory. Metadata alone is insufficient: this test
// resolves the packages that the current process would actually execute.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
};

type LockPackage = {
  version?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
};

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

function resolveManifest(entryPath: string, expectedName: string): string {
  let directory = dirname(entryPath);
  const root = parse(directory).root;

  while (directory !== root) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate) && readManifest(candidate).name === expectedName) return candidate;
    directory = dirname(directory);
  }

  throw new Error(`Unable to resolve ${expectedName} package.json from ${entryPath}`);
}

const repositoryRoot = join(__dirname, "..");
const projectRequire = createRequire(join(repositoryRoot, "package.json"));
const packageJson = readManifest(join(repositoryRoot, "package.json"));
const packageLock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8")) as {
  lockfileVersion?: number;
  packages?: Record<string, LockPackage>;
};

const lockedNextAuth = packageLock.packages?.["node_modules/next-auth"];
const lockedUuid = packageLock.packages?.["node_modules/uuid"];
const nextAuthManifestPath = resolveManifest(projectRequire.resolve("next-auth"), "next-auth");
const runtimeNextAuth = readManifest(nextAuthManifestPath);
const nextAuthRequire = createRequire(nextAuthManifestPath);
const uuidManifestPath = resolveManifest(nextAuthRequire.resolve("uuid"), "uuid");
const runtimeUuid = readManifest(uuidManifestPath);

check("package-lock uses lockfileVersion 3", packageLock.lockfileVersion === 3);
check("package.json pins NextAuth 4.24.15 exactly", packageJson.dependencies?.["next-auth"] === "4.24.15");
check("package-lock resolves NextAuth 4.24.15", lockedNextAuth?.version === "4.24.15");
check("locked NextAuth has an integrity digest", Boolean(lockedNextAuth?.integrity));
check("runtime resolves NextAuth 4.24.15", runtimeNextAuth.version === "4.24.15");
check("runtime NextAuth requires UUID 11.1.1 or newer within major 11", runtimeNextAuth.dependencies?.uuid === "^11.1.1");
check("package-lock resolves UUID 11.1.1", lockedUuid?.version === "11.1.1");
check("locked UUID has an integrity digest", Boolean(lockedUuid?.integrity));
check("NextAuth runtime resolves UUID 11.1.1", runtimeUuid.version === "11.1.1");

console.log(`\ndependency-runtime.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
