// Shared harness for the scripts/runtime/* guards.
//
// WHAT THIS IS. Every other guard in scripts/ is SOURCE-LEVEL: it reads the shape
// of the code with a regex and never executes it. The guards in this directory
// EXECUTE the product modules — the real app/api/stripe/checkout/route.ts, the
// real app/api/stripe/webhook/route.ts, the real lib/terms.ts and lib/billing.ts —
// with their I/O boundaries (Prisma, Stripe, NextAuth) replaced by in-process
// fakes. They observe behaviour, ordering and return values, not text.
//
// WHAT IT DELIBERATELY IS NOT. It is not an integration test. Nothing here opens
// a socket, reaches Postgres, or talks to Stripe. See scripts/runtime/README.md
// for the exact list of what these guards do and do not prove.
//
// HOW THE MOCKING WORKS. tsx runs these scripts as CommonJS, so every `import` in
// the modules under test becomes a `require()` that passes through
// `Module._load`. We patch that one function: a request whose RESOLVED absolute
// path (or whose bare specifier) has been registered returns the fake instead.
// Resolving first means `./prisma` from lib/billing.ts and `@/lib/prisma` from
// lib/terms.ts hit the SAME override, because tsx resolves both to the same file.
//
// ORDER MATTERS: register every mock BEFORE the first `loadModule()` of code
// under test. A top-level `import` of that code would be hoisted above the
// registrations and load the real module, so the guards use `loadModule()`.
import Module from "node:module";
import { createRequire } from "node:module";
import { join } from "node:path";

interface ModuleInternals {
  _load(request: string, parent: unknown, isMain: boolean): unknown;
  _resolveFilename(request: string, parent: unknown, isMain: boolean): string;
}
const M = Module as unknown as ModuleInternals;

/** Repository root, derived from this file's location (scripts/runtime/). */
export const ROOT = join(__dirname, "..", "..");
export const repoPath = (rel: string): string => join(ROOT, rel);

const nodeRequire = createRequire(__filename);
const byPath = new Map<string, unknown>();
const bySpecifier = new Map<string, unknown>();
let bypassOnce: string | null = null;
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;
  const originalLoad = M._load;
  M._load = function patchedLoad(request: string, parent: unknown, isMain: boolean): unknown {
    const bare = bySpecifier.get(request);
    if (bare !== undefined) return bare;
    let resolved: string | null = null;
    try {
      resolved = M._resolveFilename(request, parent, isMain);
    } catch {
      resolved = null;
    }
    if (resolved !== null && resolved === bypassOnce) {
      bypassOnce = null;
      return originalLoad.call(this, request, parent, isMain);
    }
    if (resolved !== null) {
      const fake = byPath.get(resolved);
      if (fake !== undefined) return fake;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

/** Replace a repo module (path relative to the repo root, e.g. "lib/prisma.ts"). */
export function mockModule(rel: string, exports: Record<string, unknown>): void {
  install();
  byPath.set(repoPath(rel), { __esModule: true, ...exports });
}

/** Replace a bare package specifier (e.g. "next-auth/next"). */
export function mockPackage(specifier: string, exports: Record<string, unknown>): void {
  install();
  bySpecifier.set(specifier, { __esModule: true, ...exports });
}

/**
 * Load the REAL module at `rel`, ignoring any override registered for it — but
 * still applying overrides to everything IT imports. Used when a mock only needs
 * to replace one export of a module and must keep the genuine rest.
 */
export function requireActual<T>(rel: string): T {
  install();
  const abs = repoPath(rel);
  bypassOnce = abs;
  try {
    return nodeRequire(abs) as T;
  } finally {
    bypassOnce = null;
  }
}

/** Load a module under test AFTER the mocks are registered. */
export function loadModule<T>(rel: string): T {
  install();
  return nodeRequire(repoPath(rel)) as T;
}

let pass = 0;
let fail = 0;

export function check(label: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

export function section(title: string): void {
  console.log(`\n${title}`);
}

/** Print the house-style summary line and exit non-zero on any failure. */
export function finish(name: string): never {
  console.log(`\n${name}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

/** Run an async guard body, turning an unexpected throw into a hard failure. */
export function run(name: string, body: () => Promise<void>): void {
  body().then(
    () => finish(name),
    (e: unknown) => {
      console.error(`\n  FAIL ${name} threw before completing:`);
      console.error(e);
      console.log(`\n${name}: ${pass} passed, ${fail + 1} failed`);
      process.exit(1);
    }
  );
}
