// Run: npx tsx scripts/admin-migrate-security.test.ts
//
// Source guard for the privileged migration endpoint. It must not accept a
// reusable setup credential from a URL or expose an effectful GET method.
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean): void {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

const route = readFileSync("app/api/admin/migrate/route.ts", "utf8");

check("signed-in admin authorization remains available", /await requireAdmin\(\)/.test(route));
check("headless setup secret is accepted from the request header", /headers\.get\("x-setup-secret"\)/.test(route));
check("query-string authentication is absent", !/searchParams|get\("secret"\)|new URL\(req\.url\)/.test(route));
check("effectful GET export is absent", !/export async function GET\s*\(/.test(route));
check("mutation remains an explicit POST", /export async function POST\(req: Request\)/.test(route));
const authorizationCall = route.indexOf("await authorize(req)");
const migrationCall = route.indexOf("await run()");
check(
  "authorization runs before migration statements",
  authorizationCall !== -1 && migrationCall !== -1 && authorizationCall < migrationCall,
);

console.log(`\nadmin-migrate-security.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
