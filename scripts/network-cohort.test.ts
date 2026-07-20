// Run: npx tsx scripts/network-cohort.test.ts
//
// Proves the Operator Network internal-cohort gate: the flag being ON is not enough
// — the account must ALSO be in the cohort, checked server-side. Fail-closed on
// every uncertain input. Mirrors scripts/arena-cohort.test.ts on purpose.
import { operatorNetworkAccessible, type NetworkCohortAccount } from "../lib/network/cohort";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const withFlag = (v: string | undefined, cohort: string | undefined, fn: () => void) => {
  const pf = process.env.OPERATOR_NETWORK_ENABLED, pc = process.env.OPERATOR_NETWORK_COHORT;
  if (v === undefined) delete process.env.OPERATOR_NETWORK_ENABLED; else process.env.OPERATOR_NETWORK_ENABLED = v;
  if (cohort === undefined) delete process.env.OPERATOR_NETWORK_COHORT; else process.env.OPERATOR_NETWORK_COHORT = cohort;
  try { fn(); } finally {
    if (pf === undefined) delete process.env.OPERATOR_NETWORK_ENABLED; else process.env.OPERATOR_NETWORK_ENABLED = pf;
    if (pc === undefined) delete process.env.OPERATOR_NETWORK_COHORT; else process.env.OPERATOR_NETWORK_COHORT = pc;
  }
};

const admin: NetworkCohortAccount = { id: "adm", role: "ADMIN", email: "ceo@x.com" };
const tester: NetworkCohortAccount = { id: "t-1", email: "tester@x.com" };
const demo: NetworkCohortAccount = { id: "d-1", email: "demo@gabrielcapitallabs.com" };
const outsider: NetworkCohortAccount = { id: "o-1", email: "someone@x.com" };
const disabledAdmin: NetworkCohortAccount = { id: "adm2", role: "ADMIN", disabled: true };

// ── Flag OFF blocks everyone, even admin ─────────────────────────────────────
withFlag(undefined, undefined, () => {
  check("flag OFF blocks admin", operatorNetworkAccessible(admin) === false);
  check("flag OFF blocks a listed tester", operatorNetworkAccessible(tester) === false);
});

// ── Flag ON but outside cohort still blocks ──────────────────────────────────
withFlag("true", undefined, () => {
  check("flag ON: admin is in-cohort", operatorNetworkAccessible(admin) === true);
  check("flag ON: demo account is in-cohort by email", operatorNetworkAccessible(demo) === true);
  check("flag ON but NOT listed: outsider is blocked", operatorNetworkAccessible(outsider) === false);
  check("flag ON: an unlisted tester is blocked", operatorNetworkAccessible(tester) === false);
  check("flag ON: anonymous is blocked", operatorNetworkAccessible(null) === false);
  check("flag ON: disabled admin is blocked (fail-closed)", operatorNetworkAccessible(disabledAdmin) === false);
});

// ── Explicit cohort list admits the listed account (by email or id) ──────────
withFlag("true", "tester@x.com, some-id-2", () => {
  check("flag ON + listed email: tester is admitted", operatorNetworkAccessible(tester) === true);
  check("flag ON + listed id: matched by id", operatorNetworkAccessible({ id: "some-id-2" }) === true);
  check("flag ON + list: still blocks an unlisted outsider", operatorNetworkAccessible(outsider) === false);
});

// ── Flag not exactly 'true' is OFF ───────────────────────────────────────────
withFlag("1", undefined, () => check("flag = '1' is OFF", operatorNetworkAccessible(admin) === false));
withFlag("false", undefined, () => check("flag = 'false' is OFF", operatorNetworkAccessible(admin) === false));
withFlag("TRUE", undefined, () => check("flag = 'TRUE' (wrong case) is OFF", operatorNetworkAccessible(admin) === false));

// ── NEGATIVE CONTROL ─────────────────────────────────────────────────────────
withFlag("true", undefined, () => check("negative control: an outsider is NOT admitted just because the flag is on", operatorNetworkAccessible(outsider) !== true));

console.log(`\nnetwork-cohort.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
