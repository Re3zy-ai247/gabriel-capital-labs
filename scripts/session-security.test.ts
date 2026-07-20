// Run: npx tsx scripts/session-security.test.ts
//
// Guards session revocation for disabled accounts.
//
// THE DEFECT (found 2026-07-20): `disabled` was checked ONLY inside authorize()
// in lib/auth.ts — i.e. only at sign-in. Sessions are stateless JWTs with no
// server-side registry, so an account disabled AFTER sign-in kept full access
// until its token expired on its own. Admin suspension, security lock and agency
// removal therefore only took effect against users who happened to be signed out.
//
// THE RULE: currentAccount() is the single gate every authenticated surface
// resolves through. It already loads the user row, so re-checking `disabled`
// there costs nothing and evicts a suspended account everywhere at once.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const session = readFileSync(join(root, "lib/session.ts"), "utf8");
const auth = readFileSync(join(root, "lib/auth.ts"), "utf8");

// ── The post-login gate exists ───────────────────────────────────────────────
check("currentAccount re-checks disabled after sign-in", /account\?\.disabled/.test(session));
check("a disabled account resolves to null (fail-closed)",
  /if \(account\?\.disabled\) return null;/.test(session));

// The check must come AFTER the row is loaded and BEFORE it is returned —
// otherwise it is decorative.
const loadAt = session.indexOf("const account = await prisma.user.findUnique");
const checkAt = session.indexOf("account?.disabled");
const returnAt = session.indexOf("return account;");
check("the check sits between loading the row and returning it",
  loadAt > -1 && checkAt > loadAt && returnAt > checkAt);

// ── It must not have cost an extra query ─────────────────────────────────────
// If someone later re-fetches the user to test the flag, that doubles the query
// count on the hottest path in the app.
const accountFn = session.slice(loadAt, returnAt > loadAt ? returnAt : undefined);
check("no second user fetch was introduced in currentAccount",
  (accountFn.match(/prisma\.user\.find/g) ?? []).length === 1);

// ── Sign-in must still block disabled accounts ───────────────────────────────
// Removing the login check would let a disabled user mint a fresh token that the
// currentAccount gate would then have to reject on every request.
check("authorize() still refuses disabled accounts at sign-in", /user\.disabled/.test(auth));

// ── Login throttle must survive (same file, easy to regress) ─────────────────
check("sign-in throttle still present", /login-id:/.test(auth) && /login-ip:/.test(auth));

// ── Known remaining gap, deliberately recorded ───────────────────────────────
// Password reset updates only passwordHash, so a stolen session survives the
// reset. Closing that needs server-side session state (a notBefore timestamp),
// which changes the stateless-JWT posture and must be sequenced with a migration
// — see the sprint report. This assertion documents that the gap is known rather
// than silently accepted; it should be inverted when the fix lands.
const reset = readFileSync(join(root, "app/api/auth/reset-password/route.ts"), "utf8");
check("password reset still only rotates the hash (known gap, tracked)",
  /passwordHash/.test(reset) && !/sessionsValidFrom|notBefore/.test(reset));

console.log(`\nsession-security.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
