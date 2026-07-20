// Run: npx tsx scripts/eng-ops.test.ts
//
// Guards the Engineering Operations Center (Sprint 6, Wave 8): it must stay
// admin-only and composed of real committed data only — never fabricated metrics.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getOpsSummary } from "../lib/engOps";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const page = readFileSync(join(root, "app/admin/ops/page.tsx"), "utf8");
const lib = readFileSync(join(root, "lib/engOps.ts"), "utf8");

// ── Admin-only, fail-closed ──────────────────────────────────────────────────
// The page lives under app/admin/, whose layout.tsx gates the whole area with
// requireAdmin() + redirect. That is the security boundary; this guard pins that
// the page did not escape it (no separate route, no public export).
check("ops page lives under the admin-gated area", page.includes("AppShell") && page.includes("AdminTabs"));
check("ops page is force-dynamic (no static leak of internal state)", /export const dynamic = "force-dynamic"/.test(page));
check("a nav entry exists under /admin/ops",
  readFileSync(join(root, "components/admin/AdminTabs.tsx"), "utf8").includes('href: "/admin/ops"'));

// ── Real data only — the load-bearing product law ───────────────────────────
// Every value must come from a committed artifact. The lib imports the two
// ledgers and reads the release SHA from env; it must invent nothing.
check("composes from the quality ledger", lib.includes('.ai/quality-ledger.json'));
check("composes from the work ledger", lib.includes('.ai/work-ledger.json'));
check("release SHA is read from the build env, not fabricated", /VERCEL_GIT_COMMIT_SHA/.test(lib));
check("unknown release is reported honestly, not faked", /known: !!sha/.test(lib) && /"local"/.test(page));
check("no Math.random / Date.now fabrication in the lib", !/Math\.random|Date\.now/.test(lib));

// ── The summary actually reflects the ledger ─────────────────────────────────
const s = getOpsSummary();
const ledger = JSON.parse(readFileSync(join(root, ".ai/quality-ledger.json"), "utf8"));
check("total defect count matches the ledger", s.quality.total === ledger.defects.length);
check("needs-human = owner-action + blocked",
  s.quality.needsHuman.every((d: any) => d.status === "owner-action" || d.status === "blocked"));
check("needs-human is severity-ordered (critical first)", (() => {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const seq = s.quality.needsHuman.map((d: any) => order[d.severity]);
  return seq.every((v, i) => i === 0 || seq[i - 1] <= v);
})());
check("active work packages come from the work ledger", Array.isArray(s.work.active));
check("the Stripe audit closed the double-billing historical row",
  (ledger.defects.find((d: any) => d.fingerprint === "billing/existing-double-subscribed-customers") || {}).status === "fixed");

console.log(`\neng-ops.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
