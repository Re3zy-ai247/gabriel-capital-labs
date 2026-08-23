// Run: npx tsx scripts/push-security.test.ts
//
// Source guard: disabled accounts cannot register a new push endpoint or receive
// notifications through a subscription that predates the disable action.
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

const subscribe = readFileSync("app/api/push/subscribe/route.ts", "utf8");
const push = readFileSync("lib/push.ts", "utf8");

check("subscribe resolves the current enabled account", /currentAccount\(\)/.test(subscribe));
check("subscribe does not trust the raw JWT session", !/getServerSession|authOptions/.test(subscribe));
check("subscription ownership uses the revalidated account id", /savePushSubscription\(account\.id,/.test(subscribe));
check("endpoint safety validation remains at the write boundary", /isSafePushEndpoint\(sub\.endpoint\)/.test(push));
check("send-to-user reloads recipient disable state", /select: \{ disabled: true \}/.test(push));
check("send-to-user stops for missing or disabled recipients", /if \(!recipient \|\| recipient\.disabled\) return;/.test(push));
check("admin broadcast selects enabled admins only", /where: \{ role: "ADMIN", disabled: false \}/.test(push));

console.log(`\npush-security.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
