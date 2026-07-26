// Guard for Implementation Slice 0 — Consumer deletion safety containment.
// Identity Constitution v1.0 §12.1-12.3, §12.6, §15.12, §16.5, §19.1.
//
// The invariant: an agency-initiated request MUST NOT be able to destroy a Consumer
// account or its case evidence, and MUST NOT write success/KPI/audit evidence for an
// operation that did not occur.
//
// Proof technique. The destructive call is proven UNREACHABLE BY ABSENCE, repo-wide,
// rather than by mocking one path: `prisma.user.delete` / `user.deleteMany` must not
// appear anywhere under app/ or lib/. Absence across the whole tree is a strictly
// stronger proof than stubbing a single handler, and it is the DB-free technique this
// repository already uses for route boundaries (see scripts/agency-capacity.test.ts §R1-R6,
// which asserts on route source the same way). No database is touched.
//
// Run: npx tsx scripts/consumer-deletion-containment.test.ts
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

let pass = 0, fail = 0; const bad: string[] = [];
const ok = (l: string, c: boolean) => { c ? pass++ : (fail++, bad.push(`FAIL: ${l}`)); };
const read = (p: string) => readFileSync(p, "utf8");

const ROUTE = "app/api/agency/clients/[id]/route.ts";
const UI = "app/agency/page.tsx";

// Scan CODE, not prose. The contained route documents the removed calls by name, and a
// naive text scan would match that explanation and defeat its own guard. Stripping is
// deliberately conservative — block comments and comment-ONLY lines — so it can never
// hide a real call site (a real call is never alone on a `//` line, and removing a
// `/* */` span leaves any code that followed it on the line).
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

const routeText = read(ROUTE);      // full text, for asserting on the user-facing message
const route = stripComments(routeText); // executable code only, for every prohibition

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
const sourceFiles = [...walk("app"), ...walk("lib")];

// ── 1. The destructive mutation is gone, repo-wide ───────────────────────────
{
  const deleters = sourceFiles.filter((f) => /prisma\.user\.delete\b|prisma\.user\.deleteMany\b|\btx\.user\.delete\b/.test(stripComments(read(f))));
  ok("1· no Consumer hard-delete exists anywhere under app/ or lib/", deleters.length === 0);
  if (deleters.length) bad.push(`     residual delete call sites: ${deleters.join(", ")}`);
}
ok("2· the contained route calls no user delete", !/user\.delete/.test(route));

// ── 2. No relationship mutation, no silent detach ────────────────────────────
// Nulling managedByAgencyId here would be an unevidenced termination (§12.2), which is
// forbidden just as firmly as deleting.
ok("3· the route performs no user update / relationship mutation",
  !/prisma\.user\.update|user\.updateMany|\$executeRaw|\$queryRaw/.test(route));
ok("4· the route never writes managedByAgencyId (no silent detach)",
  !/managedByAgencyId\s*:/.test(route.replace(/where:\s*\{[^}]*\}/g, "")));
ok("5· the route deletes no related Consumer case rows",
  !/(document|report|tradeline|letter|scoreEntry|outcome)\w*\.delete/i.test(route));

// ── 3. No evidence written for an operation that did not happen ──────────────
ok("6· the route writes no AgencyClientDeletion KPI/audit row",
  !/agencyClientDeletion/i.test(route));
ok("7· the route writes no success/outcome/event record",
  !/\.create\(|recordIdentityEvent|publish\(|emit\(|appendEvent/.test(route));
ok("8· the route returns no success envelope",
  !/ok:\s*true/.test(route));

// ── 4. Fail-closed response is stable and deterministic ──────────────────────
ok("9· the route fails closed with the repo-conventional 409 envelope",
  /status:\s*409/.test(route) && /NextResponse\.json\(\s*\{\s*error:/.test(route));
ok("10· the refusal states nothing was changed", /Nothing was changed/.test(route));
ok("11· the refusal does not tell the caller to delete the Consumer",
  !/delete (the |this )?(account|consumer|client)/i.test(route.split("export async function")[1] ?? ""));
ok("12· the response is deterministic — no time, randomness or env in the handler",
  !/Date\.now\(|new Date\(|Math\.random\(|process\.env/.test(route));

// ── 5. Authorization ladder preserved and non-enumerating ────────────────────
const at = (s: string) => route.indexOf(s);
ok("13· 401 for an unauthenticated caller", /status:\s*401/.test(route) && /currentAccount\(\)/.test(route));
ok("14· 403 for a non-agency account", /isAgency/.test(route) && /status:\s*403/.test(route));
ok("15· 404 for an id this agency does not manage", /status:\s*404/.test(route));
ok("16· denials precede the containment response (no bypass of authz)",
  at("status: 401") < at("status: 409") && at("status: 403") < at("status: 409") && at("status: 404") < at("status: 409"));
ok("17· the lookup stays tenant-scoped, so the route is not an existence oracle (§15.12)",
  /where:\s*\{\s*id:\s*params\.id,\s*managedByAgencyId:\s*agency\.id\s*\}/.test(route));
ok("18· the contained path reads no Consumer PII (id only)",
  /select:\s*\{\s*id:\s*true\s*\}/.test(route) && !/fullName|\bname:\s*true/.test(route));

// ── 6. Containment is unconditional ──────────────────────────────────────────
// §12.6 and the Slice 0 plan: safety containment must not hide behind a feature flag,
// least of all the Identity flag, which guards a dormant subsystem this route never uses.
ok("19· containment is not gated by any feature flag",
  !/operatorIdentityEnabled|OPERATOR_IDENTITY_ENABLED|EVENT_BUS_ENABLED|flags?\./.test(route));
ok("20· the route imports no Identity subsystem", !/@\/lib\/identity/.test(route));

// ── 7. Sibling agency routes are unchanged in kind ───────────────────────────
// Containment must not have leaked into unrelated agency behavior.
ok("21· client creation still enforces capacity in a transaction",
  /prisma\.\$transaction\(/.test(read("app/api/agency/clients/route.ts")));
ok("22· the KPI route still reads deletion history (read-only, unaffected)",
  /agencyClientDeletion\.findMany/.test(read("app/api/agency/kpi/route.ts")));
ok("23· workspace selection still verifies the managed edge",
  /managedByAgencyId:\s*account\.id/.test(read("lib/session.ts")));

// ── 8. The UI no longer promises destruction and no longer swallows refusal ──
{
  const ui = read(UI);
  const fn = ui.match(/async function removeClient[\s\S]*?\n  \}/)?.[0] ?? "";
  ok("24· the confirm copy no longer promises irreversible deletion",
    fn.length > 0 && !/cannot be undone/i.test(fn) && !/Delete \$\{name\}/.test(fn));
  ok("25· the refusal is surfaced to the operator, not silently swallowed",
    /setError\(/.test(fn) && /else/.test(fn));
}

if (bad.length) console.error(bad.join("\n"));

console.log(`\nconsumer-deletion-containment.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
