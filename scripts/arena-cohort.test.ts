// Run: npx tsx scripts/arena-cohort.test.ts
//
// Proves the Arena internal-cohort gate: the flag being ON is not enough — the
// account must also be in the cohort, checked server-side. And proves the evidence
// classification keeps the verified tier unreachable.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { arenaAccessible, type CohortAccount } from "../lib/arena/cohort";
import { EVIDENCE_STATES, MAX_LIVE_EVIDENCE_STATE, ARENA_CLASSES } from "../lib/arena/policy";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const withFlag = (v: string | undefined, cohort: string | undefined, fn: () => void) => {
  const pf = process.env.ARENA_ENABLED, pc = process.env.ARENA_COHORT;
  if (v === undefined) delete process.env.ARENA_ENABLED; else process.env.ARENA_ENABLED = v;
  if (cohort === undefined) delete process.env.ARENA_COHORT; else process.env.ARENA_COHORT = cohort;
  try { fn(); } finally {
    if (pf === undefined) delete process.env.ARENA_ENABLED; else process.env.ARENA_ENABLED = pf;
    if (pc === undefined) delete process.env.ARENA_COHORT; else process.env.ARENA_COHORT = pc;
  }
};

const admin: CohortAccount = { id: "adm", role: "ADMIN", email: "ceo@x.com" };
const tester: CohortAccount = { id: "t-1", email: "tester@x.com" };
const demo: CohortAccount = { id: "d-1", email: "demo@gabrielcapitallabs.com" };
const outsider: CohortAccount = { id: "o-1", email: "someone@x.com" };
const disabledAdmin: CohortAccount = { id: "adm2", role: "ADMIN", disabled: true };

// ── Flag OFF blocks everyone, even admin ─────────────────────────────────────
withFlag(undefined, undefined, () => {
  check("flag OFF blocks admin", arenaAccessible(admin) === false);
  check("flag OFF blocks a listed tester", arenaAccessible(tester) === false);
});

// ── Flag ON but outside cohort still blocks ──────────────────────────────────
withFlag("true", undefined, () => {
  check("flag ON: admin is in-cohort", arenaAccessible(admin) === true);
  check("flag ON: demo account is in-cohort by email", arenaAccessible(demo) === true);
  check("flag ON but NOT listed: outsider is blocked", arenaAccessible(outsider) === false);
  check("flag ON: an unlisted tester is blocked", arenaAccessible(tester) === false);
  check("flag ON: anonymous is blocked", arenaAccessible(null) === false);
  check("flag ON: disabled admin is blocked (fail-closed)", arenaAccessible(disabledAdmin) === false);
});

// ── Explicit cohort list admits the listed account (by email or id) ──────────
withFlag("true", "tester@x.com, some-id-2", () => {
  check("flag ON + listed email: tester is admitted", arenaAccessible(tester) === true);
  check("flag ON + listed id: matched by id", arenaAccessible({ id: "some-id-2" }) === true);
  check("flag ON + list: still blocks an unlisted outsider", arenaAccessible(outsider) === false);
});

// ── Flag not exactly 'true' is OFF ───────────────────────────────────────────
withFlag("1", undefined, () => check("flag = '1' is OFF", arenaAccessible(admin) === false));
withFlag("false", undefined, () => check("flag = 'false' is OFF", arenaAccessible(admin) === false));

// ── The user-facing page enforces the gate server-side (redirect), not UI ────
{
  const page = readFileSync(join(__dirname, "..", "app/arena/page.tsx"), "utf8");
  check("arena page calls arenaAccessible and redirects when not permitted", /arenaAccessible\(/.test(page) && /redirect\(/.test(page));
  check("arena page reads OWN progress only (no cross-user read)", /readOwnProgress\(/.test(page) && !/aggregateStats|leaderboard/i.test(page));
}

// ── Evidence classification keeps 'verified' unreachable ─────────────────────
check("evidence states are documented < corroborated < verified", JSON.stringify(EVIDENCE_STATES) === JSON.stringify(["documented", "corroborated", "verified"]));
check("the max LIVE evidence state is 'documented'", MAX_LIVE_EVIDENCE_STATE === "documented");
check("no contribution class exceeds the documented cap", Object.values(ARENA_CLASSES).every((c) => c.evidenceClass === "documented"));

// ── NEGATIVE CONTROL ─────────────────────────────────────────────────────────
withFlag("true", undefined, () => check("negative control: an outsider is NOT admitted just because the flag is on", arenaAccessible(outsider) !== true));

console.log(`\narena-cohort.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
