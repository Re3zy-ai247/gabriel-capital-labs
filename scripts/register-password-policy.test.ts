// Run: npx tsx scripts/register-password-policy.test.ts
//
// Guards registration against drifting below the canonical password policy
// already used by password reset and account-security flows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePassword } from "../lib/password";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

const root = join(__dirname, "..");
const route = readFileSync(join(root, "app/api/register/route.ts"), "utf8");
const page = readFileSync(join(root, "app/register/page.tsx"), "utf8");

console.log("\ncanonical policy behavior");
check("rejects the historical eight-character floor", validatePassword("Abcd123!") !== null);
check("rejects a password without lowercase", validatePassword("ABCDEFGHI1!") !== null);
check("rejects a password without uppercase", validatePassword("abcdefghi1!") !== null);
check("rejects a password without a number", validatePassword("Abcdefghi!!") !== null);
check("rejects a password without a special character", validatePassword("Abcdefghi12") !== null);
check("accepts a policy-compliant password", validatePassword("CreditVec1!") === null);

console.log("\nregistration parity");
check("registration API imports the canonical validator", /import \{ validatePassword \} from ["']@\/lib\/password["']/.test(route));
check("registration API fails closed on the canonical validator result", /const passwordError = validatePassword\(password\);[\s\S]{0,120}if \(passwordError\)[\s\S]{0,120}status: 400/.test(route));
check("registration API no longer carries a competing eight-character schema", !/password:\s*z\.string\(\)\.min\(8\)/.test(route));
check("registration page imports the canonical validator", /import \{ validatePassword \} from ["']@\/lib\/password["']/.test(page));
const firstClientValidation = page.indexOf("validatePassword(password)");
const registrationRequest = page.indexOf('fetch("/api/register"');
check(
  "registration page validates before its network request",
  firstClientValidation !== -1 && registrationRequest !== -1 && firstClientValidation < registrationRequest
);
check("registration input exposes the canonical ten-character minimum", /minLength=\{10\}/.test(page));
check("registration page no longer advertises eight characters", !/At least 8 characters|minLength=\{8\}/.test(page));

console.log(`\nregister-password-policy.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
