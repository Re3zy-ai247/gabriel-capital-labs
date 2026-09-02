// Run: npx --no-install tsx scripts/dependency-runtime.test.ts
//
// Deterministic RC1 framework boundary. This guard checks both the committed
// dependency contract and the package manifests the current process resolves.
// It never contacts a registry.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, parse, relative } from "node:path";

type LockPackage = {
  version?: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
};

type PackageLock = {
  lockfileVersion?: number;
  packages?: Record<string, LockPackage>;
};

const TARGET = "15.5.24";
const REACT_TARGET = "18.3.1";
const ESLINT_TARGET = "8.57.1";
const root = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as PackageLock;
const packages = lock.packages ?? {};
const projectRequire = createRequire(join(root, "package.json"));

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean): void {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function locked(path: string): LockPackage {
  return packages[path] ?? {};
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

function resolveManifest(entryPath: string, expectedName: string): string {
  let directory = dirname(entryPath);
  const filesystemRoot = parse(directory).root;

  while (directory !== filesystemRoot) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate) && readManifest(candidate).name === expectedName) return candidate;
    directory = dirname(directory);
  }

  throw new Error(`Unable to resolve ${expectedName} package.json from ${entryPath}`);
}

function isOfficialRegistryResolution(resolved: string): boolean {
  try {
    const url = new URL(resolved);
    return url.protocol === "https:"
      && url.hostname === "registry.npmjs.org"
      && url.port === ""
      && url.username === ""
      && url.password === "";
  } catch {
    return false;
  }
}

function registryBound(path: string): boolean {
  const entry = locked(path);
  if (!entry.resolved || !entry.integrity?.startsWith("sha512-")) return false;
  return isOfficialRegistryResolution(entry.resolved);
}

function selectorPackageName(selector: string): string {
  if (!selector.startsWith("@")) {
    const versionSeparator = selector.indexOf("@");
    return versionSeparator === -1 ? selector : selector.slice(0, versionSeparator);
  }

  const scopeSeparator = selector.indexOf("/");
  if (scopeSeparator === -1) return selector;
  const versionSeparator = selector.indexOf("@", scopeSeparator);
  return versionSeparator === -1 ? selector : selector.slice(0, versionSeparator);
}

const protectedOverridePackages = new Set([
  "next",
  "eslint-config-next",
  "@next/env",
  "@next/eslint-plugin-next",
  "react",
  "react-dom",
]);

function hasProtectedOverride(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).some(([selector, nested]) =>
    protectedOverridePackages.has(selectorPackageName(selector)) || hasProtectedOverride(nested),
  );
}

function runtimeManifest(packageName: string, requireFrom = projectRequire): { path: string; manifest: PackageManifest } {
  const path = resolveManifest(requireFrom.resolve(packageName), packageName);
  return { path, manifest: readManifest(path) };
}

function isProjectRuntimePath(path: string): boolean {
  const runtimeRoot = realpathSync(join(root, "node_modules"));
  const candidate = realpathSync(path);
  const fromRuntimeRoot = relative(runtimeRoot, candidate);
  return fromRuntimeRoot !== "" && !fromRuntimeRoot.startsWith("..") && !isAbsolute(fromRuntimeRoot);
}

const runtimeNext = runtimeManifest("next");
const runtimeEslintConfig = runtimeManifest("eslint-config-next");
const runtimeReact = runtimeManifest("react");
const runtimeReactDom = runtimeManifest("react-dom");
const runtimeEslint = runtimeManifest("eslint");
const runtimeNextAuth = runtimeManifest("next-auth");
const runtimeNextPwa = runtimeManifest("next-pwa");

const nextRequire = createRequire(runtimeNext.path);
const runtimeNextEnv = runtimeManifest("@next/env", nextRequire);
const eslintConfigRequire = createRequire(runtimeEslintConfig.path);
const runtimeNextPlugin = runtimeManifest("@next/eslint-plugin-next", eslintConfigRequire);
const runtimeReactHooks = runtimeManifest("eslint-plugin-react-hooks", eslintConfigRequire);
const nextPluginRequire = createRequire(runtimeNextPlugin.path);
const runtimeFastGlob = runtimeManifest("fast-glob", nextPluginRequire);
const nextAuthRequire = createRequire(runtimeNextAuth.path);
const runtimeUuid = runtimeManifest("uuid", nextAuthRequire);
const nextPwaRequire = createRequire(runtimeNextPwa.path);
const runtimeWorkboxBuild = runtimeManifest("workbox-build", nextPwaRequire);

console.log("\ndirect framework floor and alignment");
const directNext = manifest.dependencies?.next ?? "";
const directEslintConfig = manifest.devDependencies?.["eslint-config-next"] ?? "";
check("Next is pinned exactly to the approved RC1 target", directNext === TARGET);
check("Next is not 14.x", !directNext.startsWith("14."));
check("Next is not below the approved 15.5.24 floor", /^\d+\.\d+\.\d+$/.test(directNext) && compareVersions(directNext, TARGET) >= 0);
check("eslint-config-next is pinned exactly with Next", directEslintConfig === directNext);
check("the override detector rejects a direct Next override", hasProtectedOverride({ next: "14.2.18" }));
check("the override detector rejects a nested versioned React override", hasProtectedOverride({ parent: { "react-dom@^18": "18.3.0" } }));
check("the override detector permits an unrelated override", !hasProtectedOverride({ "ansi-regex": "6.2.2" }));
check("no package override masks the framework graph", !hasProtectedOverride(manifest.overrides));

console.log("\nroot lock and installed graph contract");
const lockRoot = locked("");
check("npm lockfile v3 is present", lock.lockfileVersion === 3);
check("the lock root pins the same Next target", lockRoot.dependencies?.next === TARGET);
check("the lock root pins the same eslint-config-next target", lockRoot.devDependencies?.["eslint-config-next"] === TARGET);
check("the locked Next package is exact", locked("node_modules/next").version === TARGET);
check("the locked eslint-config-next package is exact", locked("node_modules/eslint-config-next").version === TARGET);
check("Next and eslint-config-next cannot drift", locked("node_modules/next").version === locked("node_modules/eslint-config-next").version);
check("Next's @next/env is aligned", locked("node_modules/@next/env").version === TARGET);
check("eslint-config-next's plugin is aligned", locked("node_modules/@next/eslint-plugin-next").version === TARGET);
check("Next declares the aligned @next/env dependency", locked("node_modules/next").dependencies?.["@next/env"] === TARGET);
check("eslint-config-next declares the aligned Next plugin", locked("node_modules/eslint-config-next").dependencies?.["@next/eslint-plugin-next"] === TARGET);

console.log("\npeer and project compatibility pins");
check("React remains resolved at 18.3.1", locked("node_modules/react").version === REACT_TARGET);
check("React DOM remains resolved at 18.3.1", locked("node_modules/react-dom").version === REACT_TARGET);
check("React DOM's peer contract remains ^18.3.1", locked("node_modules/react-dom").peerDependencies?.react === "^18.3.1");
check("Next's peer contract accepts React 18", locked("node_modules/next").peerDependencies?.react?.includes("^18.2.0") === true);
check("ESLint remains resolved at 8.57.1", locked("node_modules/eslint").version === ESLINT_TARGET);
check("eslint-config-next's peer contract accepts ESLint 8", locked("node_modules/eslint-config-next").peerDependencies?.eslint?.includes("^8.0.0") === true);
check("React Hooks is a stable peer, not a canary", locked("node_modules/eslint-plugin-react-hooks").version === "5.2.0");
check("the Next plugin's exact fast-glob dependency is present", locked("node_modules/@next/eslint-plugin-next/node_modules/fast-glob").version === "3.3.1");
check("next-pwa remains at the accepted 5.6.0", locked("node_modules/next-pwa").version === "5.6.0");
check("Workbox remains at the accepted 6.6.0", locked("node_modules/workbox-build").version === "6.6.0");

console.log("\ninstalled runtime resolution");
for (const runtime of [
  runtimeNext,
  runtimeEslintConfig,
  runtimeReact,
  runtimeReactDom,
  runtimeEslint,
  runtimeNextEnv,
  runtimeNextPlugin,
  runtimeReactHooks,
  runtimeFastGlob,
  runtimeNextAuth,
  runtimeUuid,
  runtimeNextPwa,
  runtimeWorkboxBuild,
]) {
  check(`${runtime.manifest.name ?? runtime.path} resolves from this project's node_modules`, isProjectRuntimePath(runtime.path));
}
check("the executing Next runtime is the approved target", runtimeNext.manifest.version === TARGET);
check("the executing eslint-config-next runtime is aligned", runtimeEslintConfig.manifest.version === TARGET);
check("the executing Next runtime declares aligned @next/env", runtimeNext.manifest.dependencies?.["@next/env"] === TARGET);
check("the executing @next/env runtime is aligned", runtimeNextEnv.manifest.version === TARGET);
check("the executing eslint-config-next runtime declares the aligned plugin", runtimeEslintConfig.manifest.dependencies?.["@next/eslint-plugin-next"] === TARGET);
check("the executing Next ESLint plugin is aligned", runtimeNextPlugin.manifest.version === TARGET);
check("the executing React runtime remains 18.3.1", runtimeReact.manifest.version === REACT_TARGET);
check("the executing React DOM runtime remains 18.3.1", runtimeReactDom.manifest.version === REACT_TARGET);
check("the executing React DOM peer contract remains ^18.3.1", runtimeReactDom.manifest.peerDependencies?.react === "^18.3.1");
check("the executing ESLint runtime remains 8.57.1", runtimeEslint.manifest.version === ESLINT_TARGET);
check("the executing React Hooks plugin is stable", runtimeReactHooks.manifest.version === "5.2.0");
check("the executing Next plugin resolves its exact fast-glob", runtimeFastGlob.manifest.version === "3.3.1");
check("the executing next-pwa runtime remains 5.6.0", runtimeNextPwa.manifest.version === "5.6.0");
check("the executing Workbox build runtime remains 6.6.0", runtimeWorkboxBuild.manifest.version === "6.6.0");

console.log("\naccepted NextAuth advisory closure");
check("package.json keeps NextAuth pinned exactly", manifest.dependencies?.["next-auth"] === "4.24.15");
check("the lock keeps NextAuth 4.24.15", locked("node_modules/next-auth").version === "4.24.15");
check("the locked NextAuth artifact is registry/integrity bound", registryBound("node_modules/next-auth"));
check("the executing NextAuth runtime is 4.24.15", runtimeNextAuth.manifest.version === "4.24.15");
check("the executing NextAuth runtime requires UUID ^11.1.1", runtimeNextAuth.manifest.dependencies?.uuid === "^11.1.1");
check("the lock keeps UUID 11.1.1", locked("node_modules/uuid").version === "11.1.1");
check("the locked UUID artifact is registry/integrity bound", registryBound("node_modules/uuid"));
check("the UUID runtime resolved from NextAuth is 11.1.1", runtimeUuid.manifest.version === "11.1.1");

console.log("\nframework artifacts are registry-bound and integrity-pinned");
check("the registry validator accepts canonical npm HTTPS tarballs", isOfficialRegistryResolution("https://registry.npmjs.org/next/-/next-15.5.24.tgz"));
check("the registry validator rejects plaintext npm transport", !isOfficialRegistryResolution("http://registry.npmjs.org/next/-/next-15.5.24.tgz"));
check("the registry validator rejects an arbitrary package host", !isOfficialRegistryResolution("https://packages.example.test/next-15.5.24.tgz"));
for (const path of [
  "node_modules/next",
  "node_modules/eslint-config-next",
  "node_modules/@next/env",
  "node_modules/@next/eslint-plugin-next",
  "node_modules/eslint-plugin-react-hooks",
  "node_modules/@next/eslint-plugin-next/node_modules/fast-glob",
]) {
  check(`${path} has registry.npmjs.org resolution plus sha512 integrity`, registryBound(path));
}

const swcEntries = Object.entries(packages).filter(([path]) => path.startsWith("node_modules/@next/swc-"));
check("the lock contains platform-specific Next compiler artifacts", swcEntries.length > 0);
check("every locked Next compiler artifact is version-aligned", swcEntries.every(([, entry]) => entry.version === TARGET));
check("every locked Next compiler artifact is registry/integrity bound", swcEntries.every(([path]) => registryBound(path)));

const externalResolution = Object.entries(packages).find(([, entry]) => {
  if (!entry.resolved) return false;
  return !isOfficialRegistryResolution(entry.resolved);
});
const missingIntegrity = Object.entries(packages).find(([path, entry]) => path !== "" && entry.resolved && !entry.integrity?.startsWith("sha512-"));
check("the lock contains no arbitrary package or git resolution", externalResolution === undefined);
check("every resolved package has sha512 integrity", missingIntegrity === undefined);

console.log(`\ndependency-runtime.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
