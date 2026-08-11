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
const dash = readFileSync(join(root, "app/(rooms)/dashboard/page.tsx"), "utf8");
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
// `user` (see app/(rooms)/dashboard/page.tsx's resolveDashboardPrincipal()).
// `user` itself (`client ?? account`) is always truthy once reached, so the
// equivalent guard is expressed entirely via `!principal`.
// T2 persistent-shell note: the page no longer wraps its signed-out early
// return in a local `<AppShell>` (T2 §1 — the persistent RoomsShell supplies
// that chrome now, for both branches, from app/(rooms)/layout.tsx). The
// guard below is rewritten to pin the CURRENT shape: the signed-out branch
// (from `if (!principal) return (` up to the `principal` destructure that
// only the authenticated path reaches) still shows "Please sign in." and
// still never reaches <MissionEntry>.
{
  const guardIdx = dash.indexOf("if (!principal) return (");
  const destructureIdx = dash.indexOf("const { account, client } = principal;");
  const signedOutBranch = guardIdx !== -1 && destructureIdx !== -1 ? dash.slice(guardIdx, destructureIdx) : "";
  check("entry: rendered ONLY by the authenticated branch (signed-out renders no overlay) — phase-1a's guard variable is `principal`",
    dash.indexOf("Please sign in.") < dash.indexOf("<MissionEntry") &&
    guardIdx !== -1 &&
    /Please sign in\./.test(signedOutBranch) &&
    !/<MissionEntry/.test(signedOutBranch));
}
check("entry: tier D mounts nothing (reduced motion / effects off)",
  /if \(tier === "D"\) return;/.test(entry));
check("entry: journey-arrival bail (T2 §5) — an in-shell journey that already arrived (sequence > 0) suppresses a stacked returning veil",
  /if \(machine && machine\.state\(\)\.sequence > 0 && variant === "returning"\) \{/.test(entry));
check("entry: reads the OPTIONAL journey hook only — never the hard hook that throws outside a provider",
  /import \{ useOptionalJourneyMachine \} from "@\/components\/transition-runtime\/TransitionRuntimeProvider";/.test(entry) &&
  !/useJourneyMachine\(/.test(entry));
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
check("entry: every displayed value is a prop from the server's REAL resolved state",
  ["firstName", "identity", "role", "plan", "health", "tasksCount", "waitingCount", "nextAction"]
    .every((p) => new RegExp(`${p}[?]?:`).test(entry)) &&
  /data\.nextAction \? data\.nextAction\.title : null/.test(dash));
check("entry: reduced-motion CSS backstop covers the veil",
  /\.cx-mc-veil, \.cx-mc-leave \{ animation: none !important; display: none !important; \}/.test(css));

// ── 3 · the shell reports, never invents ─────────────────────────────────────
check("header: consumes HealthSignal/CapacityInfo types from the real engine",
  /from "@\/lib\/missionControl"/.test(header));
check("header: no fetch, no prisma, no invented numbers (presentation only)",
  !/fetch\(/.test(header) && !/prisma/.test(header) && !/Math\.random/.test(header));
check("dashboard: every existing engine call is preserved",
  ["getMissionControl", "loadSnapshot", "assembleIntelligence", "assembleMissions",
   "buildRoadmap", "buildBuilder", "assembleExecution", "buildAcademy"].every((f) => dash.includes(f)));

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
