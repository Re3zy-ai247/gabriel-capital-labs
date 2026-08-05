// Run: npx --no-install tsx scripts/cxos-isolated-review.test.ts
//
// Source guard for the intentionally narrow RC1 review shell. Historical
// review-system guards require excluded CXOS rooms and live dashboard wiring;
// this candidate guard pins only the two real routes present here.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reviewBuildAllowed } from "../lib/cxos/reviewMode";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const mode = read("lib/cxos/reviewMode.ts");
const rooms = read("lib/cxos/rooms.ts");
const layout = read("app/review/layout.tsx");
const hub = read("app/review/page.tsx");
const agencyPage = read("app/review/agency-command/page.tsx");
const agencyStage = read("app/review/agency-command/stage.tsx");
const agencyEnvironment = read("app/review/agency-command/environment.ts");
const agencyFixtures = read("app/review/agency-command/fixtures.ts");
const missionPage = read("app/review/mission-control/page.tsx");
const missionStage = read("app/review/mission-control/stage.tsx");
const missionEntry = read("components/cxos/mission/MissionEntry.tsx");
const missionHeader = read("components/cxos/mission/CommandHeader.tsx");
const globals = read("app/globals.css");

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL: ${label}`);
  }
}

const modeFunction = mode.slice(mode.indexOf("export function reviewBuildAllowed"));
check(
  "server review policy reads authoritative Vercel environments before public flags",
  modeFunction.indexOf("VERCEL_TARGET_ENV") >= 0 &&
    modeFunction.indexOf("VERCEL_TARGET_ENV") <
      modeFunction.indexOf("NEXT_PUBLIC_CXOS_REVIEW"),
);
check(
  "protected Preview builds are review-enabled",
  /targetEnvironment === "preview"/.test(mode) &&
    /publicEnvironment === "preview"/.test(mode),
);

const reviewEnvironmentKeys = [
  "NODE_ENV",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_TARGET_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_TARGET_ENV",
  "NEXT_PUBLIC_CXOS_REVIEW",
] as const;
const originalReviewEnvironment = Object.fromEntries(
  reviewEnvironmentKeys.map((key) => [key, process.env[key]]),
);
const mutableReviewEnvironment = process.env as Record<
  string,
  string | undefined
>;
const reviewAllowedFor = (environment: Partial<Record<(typeof reviewEnvironmentKeys)[number], string>>) => {
  for (const key of reviewEnvironmentKeys) delete mutableReviewEnvironment[key];
  Object.assign(mutableReviewEnvironment, environment);
  const allowed = reviewBuildAllowed();
  for (const key of reviewEnvironmentKeys) {
    const original = originalReviewEnvironment[key];
    if (original === undefined) delete mutableReviewEnvironment[key];
    else mutableReviewEnvironment[key] = original;
  }
  return allowed;
};

check(
  "authoritative VERCEL_ENV production blocks an override when public environment is absent",
  !reviewAllowedFor({
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    NEXT_PUBLIC_CXOS_REVIEW: "1",
  }),
);
check(
  "authoritative production target dominates contradictory Preview projections",
  !reviewAllowedFor({
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "production",
    NEXT_PUBLIC_VERCEL_ENV: "preview",
    NEXT_PUBLIC_CXOS_REVIEW: "1",
  }),
);
check(
  "unknown Vercel deployment context fails closed",
  !reviewAllowedFor({
    NODE_ENV: "production",
    VERCEL: "1",
    NEXT_PUBLIC_VERCEL_ENV: "preview",
    NEXT_PUBLIC_CXOS_REVIEW: "1",
  }),
);
check(
  "custom Vercel target fails closed for this bounded Preview gate",
  !reviewAllowedFor({
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "staging",
    NEXT_PUBLIC_CXOS_REVIEW: "1",
  }),
);
check(
  "authoritative Vercel Preview context is enabled",
  reviewAllowedFor({
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "preview",
  }),
);
check(
  "local production review requires and accepts the explicit override",
  reviewAllowedFor({
    NODE_ENV: "production",
    NEXT_PUBLIC_CXOS_REVIEW: "1",
  }),
);
check(
  "local production review remains off without the explicit override",
  !reviewAllowedFor({ NODE_ENV: "production" }),
);
check(
  "local development review remains enabled",
  reviewAllowedFor({ NODE_ENV: "development" }),
);
check(
  "review subtree is noindex and nofollow",
  /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(layout),
);

for (const [label, source] of [
  ["review layout", layout],
  ["review hub", hub],
  ["Agency page", agencyPage],
  ["Mission Control page", missionPage],
] as const) {
  check(`${label} is server-gated through reviewBuildAllowed`,
    /reviewBuildAllowed\(\)/.test(source) &&
      /notFound\(\)/.test(source));
}

check(
  "client review stages are imported only after their server page gates",
  /if \(!reviewBuildAllowed\(\)\) notFound\(\);[\s\S]*await import\("\.\/stage"\)/.test(
    agencyPage,
  ) &&
    /if \(!reviewBuildAllowed\(\)\) notFound\(\);[\s\S]*await import\("\.\/stage"\)/.test(
      missionPage,
    ),
);

const roomKeys = [...rooms.matchAll(/^ {4}key: "([a-z-]+)"/gm)].map(
  (match) => match[1],
);
const roomHrefs = [...rooms.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
check(
  // Phase 1A-CX2: the Founder Walkthrough entry leads the registry, ahead of
  // RC2's two rooms and the four recovered phase3 destinations — nothing
  // wider than what actually exists as a route.
  "isolated registry contains exactly the seven review rooms, walkthrough first",
  JSON.stringify(roomKeys) ===
    JSON.stringify(["founder-walkthrough", "agency-command", "mission-control", "threshold", "landing-journey", "arena", "passage"]),
);
check(
  "isolated registry contains only real local review destinations",
  JSON.stringify(roomHrefs) ===
    JSON.stringify(["/review/cxos", "/review/agency-command", "/review/mission-control", "/review/threshold", "/review/landing", "/review/arena", "/review/mission-control-to-arena"]) &&
    roomHrefs.every((href) =>
      existsSync(join(root, "app", href.replace(/^\//, ""), "page.tsx")),
    ),
);
check(
  "hub truthfully identifies the isolated candidate",
  // Phase 1A-CX recovery: the hub now names the recovered six-room roster;
  // the honesty requirement that it disclaims production approval stands.
  /recovered cinematic review\s+rooms/.test(hub) &&
    /does not represent production\s+integration approval/.test(hub),
);
check(
  "Agency return resolves to the reconstructed Mission Control route",
  /href:\s*"\/review\/mission-control"/.test(agencyStage) &&
    existsSync(join(root, "app/review/mission-control/page.tsx")),
);

check(
  "Mission Control remains a review fixture and is not runtime-migrated",
  /SYNTHETIC fixtures/.test(missionStage) &&
    !/useCxosRoomRuntime|@\/lib\/cxos\/runtime/.test(
      `${missionPage}\n${missionStage}\n${missionEntry}\n${missionHeader}`,
    ),
);
check(
  "review route sources have no network, API, database, auth, or live dashboard import",
  !/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|@\/app\/api|@\/lib\/prisma|next-auth|@\/lib\/auth|@\/lib\/session|app\/dashboard/.test(
    `${hub}\n${agencyPage}\n${agencyStage}\n${agencyEnvironment}\n${agencyFixtures}\n${missionPage}\n${missionStage}\n${missionEntry}\n${missionHeader}`,
  ),
);
check(
  "Agency fixtures remain import-free deterministic literals",
  !/^import\b/m.test(agencyFixtures) &&
    !/Math\.random|randomUUID|\bDate\b|performance\.now/.test(agencyFixtures),
);
// The negative clause that used to close this check (excluding any
// .cx-ar-/.cx-p-/.cx-threshold-/.cx-journey- selector) asserted RC1's
// ISOLATION from the wider CXOS room graph. The Phase 1A-CX integration
// deliberately ends that isolation — app/globals.css now also carries
// phase3's arena/passage/threshold/journey styling by design (that merge is
// the point of this reconciliation, not an accident). The positive
// requirement below — every rule this guard exists to protect is still
// present and correct — is unchanged.
check(
  "Mission return CSS still includes every one of its required CXOS selector families (isolation from the wider room graph is no longer asserted post-integration)",
  /--ease-vector/.test(globals) &&
    /--dur-settle/.test(globals) &&
    /--aurora-app/.test(globals) &&
    /@keyframes cx-mc-safety/.test(globals) &&
    /\.cx-mc-veil/.test(globals) &&
    /\.cx-mc-leave/.test(globals) &&
    /\.cx-mc-line/.test(globals),
);
check(
  "Mission overlays fail down under genuine reduced motion",
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cx-mc-veil, \.cx-mc-leave[\s\S]*display: none !important[\s\S]*\.cx-mc-line[\s\S]*animation: none !important/.test(
    globals,
  ),
);

console.log(`\ncxos-isolated-review.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
