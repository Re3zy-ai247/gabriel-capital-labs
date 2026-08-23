// Run: npx tsx scripts/critical-paths.test.ts
//
// Pins three RC1 critical fixes that are structural properties of the source, so
// a future edit cannot quietly undo them:
//   B-11 · requireAdmin() fails closed on `disabled` and resolves privilege by
//          session user id — never by a user-mutable email.
//   B-07 · /api/demo/seed is unreachable in production and never returns a
//          working credential in any environment.
//   B-08 · analyzeReportText() re-links dispute letters after the tradeline
//          deleteMany, so a re-analysis cannot orphan a consumer's letters.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const read = (p: string) => readFileSync(p, "utf8");

// ── B-11 · admin privilege has a revocation path ─────────────────────────────
{
  const admin = read("lib/admin.ts");
  const body = admin.match(/export async function requireAdmin\(\)[\s\S]*?\n\}/)?.[0] ?? "";

  check("B-11a· requireAdmin() exists and is still exported with no arguments", body.length > 0);
  check("B-11b· requireAdmin() rejects a disabled account", /user\.disabled/.test(body));
  check("B-11c· the disabled check fails closed (returns null, not a user row)",
    /if \(user\.disabled\) return null;/.test(body));
  check("B-11d· the disabled check runs before the row is returned",
    body.indexOf("user.disabled") > -1 && body.indexOf("user.disabled") < body.lastIndexOf("return user;"));
  check("B-11e· requireAdmin() resolves the session user by id", /findUnique\(\{ where: \{ id \} \}\)/.test(body));
  check("B-11f· requireAdmin() still enforces the ADMIN role", /user\.role !== "ADMIN"/.test(body));

  check("B-11g· no admin lookup in lib/admin.ts keys on email (user-mutable identifier)",
    !/where: \{ email/.test(admin));
  check("B-11h· isAdmin() takes no email argument", !/function isAdmin\(\s*[A-Za-z_]/.test(admin));
  check("B-11i· isAdmin() delegates to requireAdmin() (so it inherits the disabled gate)",
    /export async function isAdmin\(\)[\s\S]*?requireAdmin\(\)/.test(admin));

  // NOTE: a negative control asserted against a string literal written inside this
  // file can never fail and only inflates the pass count. The real non-vacuity
  // proof is running this guard against the pre-fix tree (git show HEAD~:lib/admin.ts),
  // which fails these checks. Assert against the FILE, not against a constant.
  check("B-11: the disabled check is in the real file, after the role check",
    admin.indexOf("role !== \"ADMIN\"") > -1 &&
    admin.indexOf("user.disabled") > admin.indexOf("role !== \"ADMIN\""));
}

// ── B-07 · unauthenticated demo seed cannot run (or leak) in production ──────
{
  const seed = read("app/api/demo/seed/route.ts");
  const handler = seed.match(/async function handle\(req: Request\)[\s\S]*?\n\}/)?.[0] ?? "";

  check("B-07a· the route is positively limited to development", /process\.env\.NODE_ENV !== "development"/.test(seed));
  check("B-07b· the guard returns 404 outside development",
    /process\.env\.NODE_ENV !== "development"\)\s*\{[\s\S]{0,160}?status: 404/.test(seed));
  check("B-07c· the guard is the FIRST thing the handler does (before the fail-open rate limiter)",
    handler.length > 0
    && handler.indexOf("NODE_ENV") > -1
    && handler.indexOf("NODE_ENV") < handler.indexOf("enforceRateLimit"));
  check("B-07d· both exported methods route through the guarded handler",
    /export async function GET\(req: Request\) \{\s*return handle\(req\);/.test(seed)
    && /export async function POST\(req: Request\) \{\s*return handle\(req\);/.test(seed));

  check("B-07e· no response body carries a password field", !/password\s*:/i.test(seed));
  check("B-07f· the demo password is not even imported", !/DEMO_PASSWORD/.test(seed));
  check("B-07g· the IP rate limit on the destructive re-seed is retained",
    /enforceRateLimit\(`demo-seed:/.test(seed));
}

// ── B-08 · re-analysis re-links letters instead of orphaning them ────────────
{
  const analyze = read("lib/analyze.ts");
  const del = analyze.indexOf("tradeline.deleteMany");
  const relink = analyze.indexOf("letter.updateMany");
  const snapshot = analyze.indexOf("letter.findMany");

  check("B-08a· the tradeline deleteMany is still there (this is the rebuild path)", del > -1);
  check("B-08b· the letters pointing at the old rows are captured BEFORE the delete",
    snapshot > -1 && snapshot < del);
  check("B-08c· letters are re-linked AFTER the delete/recreate", relink > -1 && relink > del);
  check("B-08d· the re-link writes a new tradelineId onto those letters",
    /letter\.updateMany\(\{ where: \{ id: \{ in: letterIds \} \}, data: \{ tradelineId: newId \} \}\)/.test(analyze));
  check("B-08e· old→new identity is matched on a stable natural key, not the cuid",
    /function tradelineKey\(/.test(analyze) && /newIdByKey/.test(analyze) && /keyByPriorId/.test(analyze));
  check("B-08f· the natural key excludes balance (it legitimately changes between pulls)",
    !/balance/i.test(analyze.match(/function tradelineKey\([\s\S]*?\n\}/)?.[0] ?? "balance"));

  check("B-08g· delete + recreate + re-link run inside one transaction", /prisma\.\$transaction\(/.test(analyze));
  const tx = analyze.match(/await prisma\.\$transaction\(\s*async \(tx\) => \{[\s\S]*?\n  \);/)?.[0] ?? "";
  check("B-08h· the delete is inside the transaction", /tx\.tradeline\.deleteMany/.test(tx));
  check("B-08i· the creates are inside the transaction", /tx\.tradeline\.create/.test(tx));
  check("B-08j· the re-link is inside the transaction", /tx\.letter\.updateMany/.test(tx));
  check("B-08k· no unguarded pre-transaction delete remains",
    !/await prisma\.tradeline\.deleteMany/.test(analyze));
  check("B-08l· the transaction timeout is raised above the 5s default for large reports",
    /timeout: 15_000/.test(analyze));

  check("B-08m· furnisher contacts are re-saved after the rebuild (the delete cascades them away)",
    /saveFurnisherContact\(/.test(analyze) && /getFurnisherContacts\(/.test(analyze));
  check("B-08n· furnisher contacts are written AFTER the transaction commits (their FK is on the base client)",
    analyze.indexOf("saveFurnisherContact(id, contact)") > analyze.indexOf("{ maxWait: 10_000, timeout: 15_000 }"));
  check("B-08o· a letter whose account is gone is left null, never deleted",
    !/letter\.delete/.test(analyze));

  // NOTE: as above — a control asserted against an inline constant is vacuous.
  // Assert the real ordering in the real file instead.
  check("B-08: the re-link follows the delete in the real file",
    analyze.indexOf("tradeline.deleteMany") > -1 &&
    analyze.indexOf("letter.updateMany") > analyze.indexOf("tradeline.deleteMany"));
}

console.log(`\ncritical-paths.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
