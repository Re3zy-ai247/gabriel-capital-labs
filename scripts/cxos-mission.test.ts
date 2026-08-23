// Run: npx tsx scripts/cxos-mission.test.ts
//
// SOURCE-LEVEL guard for CXOS Phase 4 — the authenticated entry, the Mission
// Control shell, and the Preview-only Founder bootstrap. Labelled as such; the
// behavioural evidence is the Playwright pass in the Phase 4 report.
//
// WHAT THIS HOLDS:
//   1. The bootstrap is HARD OFF in production, refuses shared-database
//      writes, carries no static credential, and never echoes one.
//   2. The entry never masks auth truth: it is rendered only by the
//      authenticated branch, mounts nothing at tier D, is skippable, writes
//      no session in review, and carries the pure-CSS safety fade.
//   3. Review-data isolation: the stage is fixtures-only — no prisma, no
//      fetch, no session import can reach it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const boot = readFileSync(join(root, "app/api/cxos/founder-bootstrap/route.ts"), "utf8");
const entry = readFileSync(join(root, "components/cxos/mission/MissionEntry.tsx"), "utf8");
const header = readFileSync(join(root, "components/cxos/mission/CommandHeader.tsx"), "utf8");
const dash = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
const stage = readFileSync(join(root, "app/review/mission-control/stage.tsx"), "utf8");
const stagePage = readFileSync(join(root, "app/review/mission-control/page.tsx"), "utf8");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── 1 · the bootstrap gate order is a safety order ───────────────────────────
{
  const fn = boot.slice(boot.indexOf("export async function POST"));
  const prodIdx = fn.indexOf('process.env.VERCEL_ENV === "production"');
  check("bootstrap: the production hard-off EXISTS and is the FIRST condition",
    prodIdx !== -1 &&
    prodIdx < fn.indexOf('process.env.VERCEL_ENV === "preview"') &&
    /if \(process\.env\.VERCEL_ENV === "production"\) \{\s*return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/.test(fn));
  const isoIdx = fn.indexOf('CXOS_PREVIEW_DB_ISOLATED');
  check("bootstrap: the shared-database STOP exists, precedes every write, and refuses with 409",
    isoIdx !== -1 && isoIdx < fn.indexOf("prisma.user") && /status: 409/.test(fn));
  check("bootstrap: secret AND password must both come from env — unset means the route does not exist",
    /const secret = process\.env\.CXOS_FOUNDER_BOOTSTRAP_SECRET;/.test(fn) &&
    /const password = process\.env\.CXOS_FOUNDER_REVIEW_PASSWORD;/.test(fn) &&
    /if \(!secret \|\| !password\) \{\s*return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/.test(fn));
  check("bootstrap: the header compare is timing-safe", /timingSafeEqual/.test(boot) && /safeEqual\(presented, secret\)/.test(fn));
  check("bootstrap: rate limited", /enforceRateLimit\(`cxos-bootstrap:/.test(fn));
  check("bootstrap: revocation path disables (never deletes — Slice 0 containment)",
    /data: \{ disabled: true \}/.test(fn) && !/user\.delete/.test(boot) && !/deleteMany/.test(boot));
  check("bootstrap: accounts are marked synthetic and live on the preview subdomain",
    /cxos\.review\.consumer@preview\.creditvector\.app/.test(boot) &&
    /CXOS Review — Synthetic/.test(boot));
  check("bootstrap: no static credential exists and none is echoed",
    !/password\s*[:=]\s*["'][^"']+["']/.test(boot) &&
    !/passwordHash:\s*["']/.test(boot) &&
    /Never echo any credential/.test(fn) &&
    !/json\([^)]*password/i.test(fn.replace(/CXOS_FOUNDER_REVIEW_PASSWORD/g, "")));
  check("bootstrap: minimum role — no role escalation is ever written",
    !/role:\s*["']?(ADMIN|AGENCY)/.test(boot));
}

// ── 1b · the isolation fingerprint (GET) discloses facts, never secrets ──────
{
  const fn = boot.slice(boot.indexOf("export async function GET"), boot.indexOf("export async function POST"));
  const prodIdx = fn.indexOf('process.env.VERCEL_ENV === "production"');
  check("GET: the production hard-off EXISTS and is the FIRST condition",
    prodIdx !== -1 && prodIdx < fn.indexOf('VERCEL_ENV === "preview"') &&
    /if \(process\.env\.VERCEL_ENV === "production"\) \{\s*return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/.test(fn));
  check("GET: the database is queried ONLY behind the isolation attestation",
    /if \(attested\) \{\s*try \{\s*const rows = await prisma/.test(fn) &&
    (fn.match(/prisma\./g) ?? []).length === 1);
  // scope: the fingerprint helper + GET only — the POST legitimately parses
  // its own ?revoke searchParam, which is not a disclosure surface
  const fpAndGet = boot.slice(boot.indexOf("function dbFingerprint"), boot.indexOf("export async function POST"));
  check("GET: the fingerprint never echoes credentials or the query string",
    !/u\.username|u\.password|u\.search\b|searchParams/.test(fpAndGet) &&
    /createHash\("sha256"\)/.test(fpAndGet));
  check("GET: gate variables are disclosed as BOOLEANS only",
    /bootstrapSecretConfigured: !!process\.env\.CXOS_FOUNDER_BOOTSTRAP_SECRET/.test(fn) &&
    /reviewPasswordConfigured: !!process\.env\.CXOS_FOUNDER_REVIEW_PASSWORD/.test(fn) &&
    /nextauthSecretConfigured: !!process\.env\.NEXTAUTH_SECRET/.test(fn));
}

// ── 2 · the entry never masks truth ──────────────────────────────────────────
// Phase-1a's dashboard resolves an altitude-routed principal before `user` is
// ever derived — the auth/early-return guard variable is `principal`, not
// `user` (see app/dashboard/page.tsx's resolveDashboardPrincipal()). `user`
// itself (`client ?? account`) is always truthy once reached, so the
// equivalent guard is expressed entirely via `!principal`.
// RC1 S2 (P0-5) replaced the linkless "Please sign in." shell with a redirect. The
// property is unchanged: nothing renders for an unresolved principal, so the
// cinematic entry can never be shown to a signed-out visitor.
//
// Three traps this guard must avoid, all of which the old spelling walked into:
//   • ordering measured on the bare identifier `redirectToLogin` is vacuous — it
//     also appears in the import, so the test passes with the guard call deleted.
//     Measure the CALL.
//   • indexOf(-1) comparisons go vacuous once the searched string is gone
//     (-1 < N is always true). Require both indices to be found.
//   • "Please sign in." now appears in an explanatory COMMENT in this file, so any
//     absence check must read comment-stripped source.
//
// RC1 S7 / Founder Decision D-6 — RE-PINNED, DELIBERATELY AND UPWARD.
// The original property was an ORDERING one: the auth guard must precede the
// <MissionEntry> mount, so the cinematic entry can never be shown to a
// signed-out visitor. D-6 unmounts MissionEntry at consumer altitude (the
// 7.3 s veil showed nothing the room beneath does not already show, and
// carried the over-claiming CLEARANCE/SYSTEMS register — C-03/C-05). ABSENCE
// is strictly stronger than ordering for this property: there is no overlay
// to show a signed-out visitor at all. Both halves are asserted, so neither
// can be quietly undone:
//   (a) the auth guard still precedes EVERY render on this page, and
//   (b) no cinematic overlay is mounted here.
// A future slice that restores the mount must restore the ordering check with
// it — (b) fails the moment <MissionEntry> reappears.
const dashRendered = dash.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const guardAt = dashRendered.indexOf('if (!principal) redirectToLogin("/dashboard");');
const firstReturnAt = dashRendered.indexOf("return (");
check("entry: the auth guard still precedes EVERY render — an unresolved principal leaves for /login before any markup",
  guardAt !== -1 && firstReturnAt !== -1 && guardAt < firstReturnAt);
check("entry: D-6 — no full-screen cinematic entry overlay is mounted on the dashboard at all (absence, not ordering)",
  !dashRendered.includes("<MissionEntry"));
check("entry: the component is KEPT, not deleted — CXOS is unmounted for RC1, not abandoned",
  entry.includes("export function MissionEntry"));
check("entry: the dashboard no longer renders a linkless sign-in shell",
  !dashRendered.includes("Please sign in."));
check("entry: tier D mounts nothing (reduced motion / effects off)",
  /if \(tier === "D"\) return;/.test(entry));
check("entry: skippable three ways — Escape, the button, click anywhere",
  /e\.key === "Escape"\) finish\(\)/.test(entry) && /onClick=\{finish\}/.test(entry) && /Skip — Esc/.test(entry));
check("entry: the skip control takes first focus", /autoFocus/.test(entry));
check("entry: pure-CSS 12s safety fade exists (the reveal-safety pattern)",
  /@keyframes cx-mc-safety/.test(css) && /cx-mc-safety 0\.5s ease 12s forwards/.test(css));
check("entry: review runs never consume the session marker",
  /if \(!review\.current\) \{\s*try \{\s*sessionStorage\.setItem\(SESSION_KEY, "1"\)/.test(entry));
check("entry: durations inside the mandate (first ≈7s ≤9s; returning ≈1.1s ≤1.5s)",
  /arm\(\(\) => finish\(\), 7300\)/.test(entry) && /arm\(\(\) => finish\(\), 1100\)/.test(entry));
check("entry: an accessible dialog that names its escape hatch",
  /role="dialog"/.test(entry) && /Press Escape to skip/.test(entry));
check("entry: focus lands on the room's heading after the dissolve",
  /querySelector<HTMLElement>\("main h1, h1"\)/.test(entry));
// RC1 S7 — RE-PINNED. The second half of this check read the dashboard for
// `data.nextAction ? data.nextAction.title : null`, i.e. the value being piped
// into the now-removed <MissionEntry>. The PROPERTY it protected — the CXOS
// presentation layer displays only server-resolved state, never an invented
// value — is unchanged and is re-expressed against the surface that still
// renders: the Command Header. MissionEntry's own prop contract is still
// pinned so the component cannot rot into inventing values while unmounted.
check("entry: every displayed value is declared as a prop (the component invents nothing)",
  ["firstName", "identity", "role", "plan", "health", "tasksCount", "waitingCount", "nextAction"]
    .every((p) => new RegExp(`${p}[?]?:`).test(entry)));
check("header: every displayed value the dashboard passes comes from the engine's resolved `data`",
  /health=\{cxHealth\}/.test(dashRendered) &&
  /const cxHealth = data\.health\.map/.test(dashRendered) &&
  /standing=\{data\.standing\}/.test(dashRendered) &&
  /capacity=\{data\.capacity\}/.test(dashRendered));
check("entry: reduced-motion CSS backstop covers the veil",
  /\.cx-mc-veil, \.cx-mc-leave \{ animation: none !important; display: none !important; \}/.test(css));

// ── 3 · the shell reports, never invents ─────────────────────────────────────
check("header: consumes HealthSignal/CapacityInfo types from the real engine",
  /from "@\/lib\/missionControl"/.test(header));
check("header: no fetch, no prisma, no invented numbers (presentation only)",
  !/fetch\(/.test(header) && !/prisma/.test(header) && !/Math\.random/.test(header));
// RC1 S7 — RE-PINNED, and measured on COMMENT-STRIPPED source. Two changes:
//   1. `assembleExecution` leaves the required list. D-6 unmounts the
//      Executive Queue and the ambient GXL field at consumer altitude, and
//      those were its only two consumers here; calling a per-request fold over
//      every engine's output and discarding the result is how a second
//      "what to do next" ranking (C-04) quietly grows back. lib/execution is
//      untouched and scripts/execution.test.ts still guards it.
//   2. The measurement moves from `dash` to `dashRendered`. On raw source this
//      check was about to pass VACUOUSLY: the comment explaining why
//      assembleExecution is no longer called contains the identifier, so
//      `dash.includes("assembleExecution")` is true with the call deleted.
//      Comment-stripped source is the only honest way to assert either
//      presence or absence of a call.
check("dashboard: every engine the room still renders from is called",
  ["getMissionControl", "loadSnapshot", "assembleIntelligence", "assembleMissions",
   "buildRoadmap", "buildBuilder", "buildAcademy"].every((f) => dashRendered.includes(f)));
check("dashboard: the engine whose only consumers D-6 unmounted is not called-and-discarded",
  !dashRendered.includes("assembleExecution"));
// D-6 / C-04 — the duplicate rankings and the decorative rAF field stay
// unmounted at consumer altitude. Absence assertions, one per surface, so a
// regression names itself instead of silently restoring a second answer.
for (const gone of ["<MissionEntry", "<GxlField", "<ExecutiveQueue", "<MissionQueue"]) {
  check(`dashboard: ${gone}> is not mounted (D-6 task-first posture)`, !dashRendered.includes(gone));
}

// ── 4 · review-data isolation ────────────────────────────────────────────────
check("stage: fixtures only — no prisma, no session, no fetch can reach it",
  !/prisma/.test(stage) && !/getServerSession|currentUser|currentAccount/.test(stage) && !/fetch\(/.test(stage));
check("stage: the synthetic banner is unconditional",
  /SYNTHETIC REVIEW DATA/.test(stage));
check("stage: gated by reviewBuildAllowed like every review surface",
  /reviewBuildAllowed\(\)/.test(stagePage));
check("stage: fixture identities are the synthetic review handles, no real names",
  /cxreview-consumer/.test(stage) && /cxreview-agency/.test(stage));

console.log(`\ncxos-mission.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
