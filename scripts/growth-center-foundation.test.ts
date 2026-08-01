// Run: node --import tsx scripts/growth-center-foundation.test.ts
//
// DB-less executable + source guard for the non-monetary Growth Center Founder
// preview. It proves deterministic fixtures, exact districts, two-key fail-closed
// gating, absent effect/data authority, and accessible static equivalence.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import {
  GROWTH_EXPLANATION_INTENT_IDS,
  GROWTH_CENTER_DISTRICTS,
  GROWTH_CENTER_DISTRICT_IDS,
  GROWTH_CENTER_HEARTBEAT,
  GROWTH_CENTER_KAI_NO_ACTION_RECEIPT,
  GROWTH_CENTER_LENS_IDS,
  GROWTH_CENTER_REVIEW_DISCLOSURE,
  resolveGrowthExplanationPlan,
} from "../lib/growthNetwork/experience";
import { growthPayoutExecutionEnabled } from "../lib/growthNetwork/flags";
import { growthCenterPreviewEnabled } from "../lib/growthNetwork/previewFlags";
import { reviewServerBuildAllowed } from "../lib/cxos/reviewMode";

const ROOT = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${label}`);
  }
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function codeOf(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const expectedDistricts = [
  "growth-center",
  "professional-development",
  "mentorship",
  "education-center",
  "marketplace-preview",
  "community-contribution",
  "agency-builder",
] as const;
const expectedHeartbeat = [
  "develop",
  "mentor-or-teach",
  "contribute",
  "verify",
  "strengthen-ecosystem",
] as const;

check("exact seven Founder-directed districts", equal(GROWTH_CENTER_DISTRICT_IDS, expectedDistricts));
check("district registry is unique", new Set(GROWTH_CENTER_DISTRICT_IDS).size === 7);
check("district registry is frozen", Object.isFrozen(GROWTH_CENTER_DISTRICT_IDS));
check("district projection preserves exact order", equal(GROWTH_CENTER_DISTRICTS.map((district) => district.id), expectedDistricts));
check("every district answers purpose, contribution, source, cue, and unavailable boundary", GROWTH_CENTER_DISTRICTS.every((district) =>
  [district.purpose, district.opportunity, district.evidence, district.nextAction, district.boundary].every((value) => value.trim().length > 20)
));
check("Growth Center is the sole protagonist", GROWTH_CENTER_DISTRICTS.filter((district) => district.plane === "protagonist").map((district) => district.id).join() === "growth-center");
check("heartbeat is exact, qualitative, and ordered", equal(GROWTH_CENTER_HEARTBEAT.map((beat) => beat.id), expectedHeartbeat));
check("persistent disclosure says synthetic and no live program", /Synthetic/.test(GROWTH_CENTER_REVIEW_DISCLOSURE) && /No live program/.test(GROWTH_CENTER_REVIEW_DISCLOSURE));
check("Kai no-action receipt is exact and explicit", GROWTH_CENTER_KAI_NO_ACTION_RECEIPT === "Preview only. No model was called. Nothing was saved, sent, assigned, scheduled, purchased, or changed.");

for (const lensId of GROWTH_CENTER_LENS_IDS) {
  for (const intentId of GROWTH_EXPLANATION_INTENT_IDS) {
    const first = resolveGrowthExplanationPlan(lensId, intentId);
    const second = resolveGrowthExplanationPlan(lensId, intentId);
    check(`${lensId}/${intentId} resolves deterministically`, equal(first, second));
    check(`${lensId}/${intentId} resolves to an approved district`, GROWTH_CENTER_DISTRICT_IDS.includes(first.districtId));
    check(`${lensId}/${intentId} cites its fictional fixture source`, /fictional operator review fixture/.test(first.source));
    check(`${lensId}/${intentId} has exactly three human review steps`, first.steps.length === 3);
    check(`${lensId}/${intentId} result is frozen`, Object.isFrozen(first) && Object.isFrozen(first.steps));
  }
}

const priorPreview = process.env.GROWTH_CENTER_PREVIEW_ENABLED;
const priorVercel = process.env.NEXT_PUBLIC_VERCEL_ENV;
const priorServerVercel = process.env.VERCEL_ENV;
const priorVercelMarker = process.env.VERCEL;
const priorCxos = process.env.NEXT_PUBLIC_CXOS_REVIEW;
const priorNode = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;
try {
  delete process.env.GROWTH_CENTER_PREVIEW_ENABLED;
  check("subordinate preview flag defaults off", !growthCenterPreviewEnabled());
  for (const value of ["", "false", "TRUE", "1", " true", "true "]) {
    process.env.GROWTH_CENTER_PREVIEW_ENABLED = value;
    check(`subordinate preview flag rejects ${JSON.stringify(value)}`, !growthCenterPreviewEnabled());
  }
  process.env.GROWTH_CENTER_PREVIEW_ENABLED = "true";
  check("subordinate preview flag accepts exact true", growthCenterPreviewEnabled());

  mutableEnv.NODE_ENV = "production";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  process.env.NEXT_PUBLIC_CXOS_REVIEW = "1";
  check("canonical production identity hard-disables review despite public/manual overrides", !reviewServerBuildAllowed() && growthCenterPreviewEnabled());

  process.env.VERCEL_ENV = "preview";
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  delete process.env.NEXT_PUBLIC_CXOS_REVIEW;
  check("canonical Vercel preview requires and accepts the subordinate flag", reviewServerBuildAllowed() && growthCenterPreviewEnabled());

  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  process.env.NEXT_PUBLIC_CXOS_REVIEW = "1";
  check("hosted build with missing canonical identity fails closed", !reviewServerBuildAllowed());
  check("payout execution remains unconditionally false", growthPayoutExecutionEnabled() === false);
} finally {
  if (priorPreview === undefined) delete process.env.GROWTH_CENTER_PREVIEW_ENABLED;
  else process.env.GROWTH_CENTER_PREVIEW_ENABLED = priorPreview;
  if (priorVercel === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  else process.env.NEXT_PUBLIC_VERCEL_ENV = priorVercel;
  if (priorServerVercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = priorServerVercel;
  if (priorVercelMarker === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = priorVercelMarker;
  if (priorCxos === undefined) delete process.env.NEXT_PUBLIC_CXOS_REVIEW;
  else process.env.NEXT_PUBLIC_CXOS_REVIEW = priorCxos;
  if (priorNode === undefined) delete mutableEnv.NODE_ENV;
  else mutableEnv.NODE_ENV = priorNode;
}

const routeDirectory = join(ROOT, "app/review/growth-center");
check("Phase 1A route files remain exact beside the separately authorized Phase 1B annex", equal(readdirSync(routeDirectory).sort(), [
  "capability-contract",
  "growth-center.module.css",
  "page.tsx",
  "stage.tsx",
]));

const page = source("app/review/growth-center/page.tsx");
const stage = source("app/review/growth-center/stage.tsx");
const css = source("app/review/growth-center/growth-center.module.css");
const experience = source("lib/growthNetwork/experience.ts");
const previewFlags = source("lib/growthNetwork/previewFlags.ts");
const routeCode = codeOf(`${page}\n${stage}`);
const pureCode = codeOf(`${experience}\n${previewFlags}`);

const gateIndex = page.indexOf("if (!reviewServerBuildAllowed() || !growthCenterPreviewEnabled())");
const importIndex = page.indexOf('await import("./stage")');
check("both review controls run before importing the stage", gateIndex >= 0 && importIndex > gateIndex);
check("page does not statically import the client stage", !/^import .*\.\/stage/m.test(page));
check("page remains a server component", !/^\s*["']use client["'];/m.test(page));
check("route is dynamic and inherits review noindex policy", /export const dynamic = "force-dynamic"/.test(page));
check("Growth main repairs and focuses the global #main skip-link target", /<main[\s\S]*?id="main"[\s\S]*?tabIndex=\{-1\}[\s\S]*?data-growth-room="growth-center-room"/.test(stage));
check("stage adopts only the headless CXOS Core Runtime seam", stage.includes("useCxosRoomRuntime") && stage.includes("CxosRoomRuntimeDefinition"));
check("runtime contract uses exact six arrival beats", [
  "orientation", "contribution-principle", "network-map", "heartbeat", "kai-recommendation", "district-settlement",
].every((beat) => stage.includes(`"${beat}"`)));
check("runtime contract uses exact three motion channels", [
  "network-breath", "contribution-flow", "kai-beacon",
].every((channel) => stage.includes(`"${channel}"`)));
check("route has no AppShell or production product component", !/AppShell|Sidebar|AgencyBar|KaiPresence/.test(routeCode));

const importSpecifiers = [...routeCode.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]).sort();
const allowedImports = [
  "react",
  "next/navigation",
  "@/lib/cxos/reviewMode",
  "@/components/cxos/runtime/useCxosRoomRuntime",
  "@/lib/cxos/runtime",
  "@/lib/growthNetwork/previewFlags",
  "@/lib/growthNetwork/experience",
  "./growth-center.module.css",
].sort();
check("route static import boundary is exact", equal(importSpecifiers, allowedImports));
const dynamicImportSpecifiers = [...routeCode.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]);
check("route dynamic import boundary is exactly the gated stage", equal(dynamicImportSpecifiers, ["./stage"]));
check("route contains no bare import or require escape hatch", !/^\s*import\s*["']/m.test(routeCode) && !/\brequire\s*\(/.test(routeCode));
for (const forbiddenImport of [
  "prisma", "stripe", "billing", "auth", "session", "identity", "organization",
  "agency", "community", "marketplace", "arena", "mission-control", "eventBus",
  "analytics", "reputation", "kai", "anthropic", "openai",
]) {
  check(`route imports no ${forbiddenImport} authority`, importSpecifiers.every((specifier) => !specifier.toLowerCase().includes(forbiddenImport.toLowerCase())));
}

for (const forbiddenEffect of [
  "fetch(", "axios", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
  "localStorage", "sessionStorage", "indexedDB", "document.cookie", "navigator.share",
  "<form", "onSubmit", "use server", "server action", "@prisma/client", "$queryRaw",
  "$executeRaw", "Math.random", "Date.now", "new Date", "crypto.randomUUID",
]) {
  check(`review projection excludes ${forbiddenEffect}`, !`${routeCode}\n${pureCode}`.includes(forbiddenEffect));
}
check("route has no external link", !/href\s*=\s*["']https?:\/\//.test(routeCode));
check("route renders persistent review disclosure", stage.includes("GROWTH_CENTER_REVIEW_DISCLOSURE"));
check("director truth scopes storage and network claims to Growth-owned behavior",
  /no Growth-owned data request, storage/.test(stage)
  && /inherited shell session\/theme/.test(stage)
  && !/no storage · no network/i.test(stage));
check("first frame refuses recruiting", stage.includes("Recruiting is not rewarded."));
check("Kai keeps canonical identity and boundary-safe route-local role",
  stage.includes("Kai · Credit Intelligence Officer · route-local review mode")
  && stage.includes("Deterministic Growth Explanation Mode")
  && !stage.includes("Growth Advisor"));
check("Kai offers fixed buttons, not an open prompt", !/<input|<textarea|contentEditable/.test(stage));
check("first and return visits are explicit controls", stage.includes('"first"') && stage.includes('"return"') && stage.includes("never detected"));
check("district navigation uses real hash links", stage.includes('href={`#${district.id}`}') && stage.includes('aria-current='));
check(
  "district navigation owns focusable browser history restoration",
  stage.includes("event.preventDefault()")
    && stage.includes("window.history.pushState")
    && stage.includes('addEventListener("popstate"')
    && stage.includes('addEventListener("hashchange"'),
);
check(
  "district history preserves native non-district fragment navigation",
  stage.includes("if (requested && !isDistrict) return;")
    && stage.includes("The runtime owns only district history"),
);
check(
  "full review boundary is a focusable native fragment target",
  stage.includes('href="#full-review-boundary"')
    && /id="full-review-boundary"[\s\S]*?tabIndex=\{-1\}/.test(stage),
);
check(
  "visit fixtures replace and activate their declared starting district",
  stage.includes("window.history.replaceState(null, \"\", fixtureHash)")
    && stage.includes("moveToDistrict(fixture.districtId)")
    && stage.includes("Fixture controls replace their route-local starting point"),
);
check(
  "Replay arrival reuses the normalized First fixture transition",
  stage.includes('onClick={() => selectVisitFixture("first")}')
    && !/className=\{styles\.replayButton\}[\s\S]{0,220}setVisitFixture\("first"\)/.test(stage),
);
check("compass and fixed Kai questions expose labeled groups", stage.includes('role="group"') && stage.includes('aria-labelledby="compass-title"'));
check("boundary Previous and Next states are inert text, not disabled anchors", stage.includes('<span aria-disabled="true">Previous</span>') && stage.includes('<span aria-disabled="true">Next</span>'));
check(
  "compact compass copy and district ordinals keep the 12px readability floor",
  /\.compassCore span,[\s\S]*?\.districtRail a span,[\s\S]*?font-size: 0\.75rem;/.test(css),
);
const mobile560 = css.slice(
  css.indexOf("@media (max-width: 560px)"),
  css.indexOf("@media (max-width: 350px)"),
);
check(
  "mobile preserves DOM-aligned Director and hero focus order",
  !/\.director\s*\{[^}]*order:/.test(mobile560)
    && !/\.hero\s*\{[^}]*order:/.test(mobile560),
);
check("Agency Builder explicitly says no live Growth Distribution", stage.includes("No live Growth Distribution."));

const routeDirectoryPrefix = `${routeDirectory}${sep}`;
const registrationConsumers = ["app", "components", "lib"]
  .flatMap((directory) => walk(join(ROOT, directory)))
  .filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))
  .filter((path) => !path.startsWith(routeDirectoryPrefix))
  .filter((path) => readFileSync(path, "utf8").includes("/review/growth-center"))
  .map((path) => relative(ROOT, path));
check("Growth Center route remains unregistered outside its own directory", equal(registrationConsumers, []));

for (const forbiddenKey of [
  "amount", "balance", "currency", "commissionRate", "payoutDate", "referralCount",
  "operatorCount", "revenue", "wallet", "taxWithholding", "bankAccount",
]) {
  check(`experience declares no economic-shaped ${forbiddenKey} field`, !new RegExp(`\\b${forbiddenKey}\\s*:`, "i").test(codeOf(experience)));
}

check("CSS includes visible focus treatment", /:focus-visible/.test(css));
check("CSS declares 44px minimum targets", /min-height:\s*44px/.test(css));
check("CSS includes browser reduced-motion equivalence", /prefers-reduced-motion:\s*reduce/.test(css));
check("CSS has 320px-class reflow coverage", /max-width:\s*350px/.test(css));
check("CSS has mobile and tablet breakpoints", /max-width:\s*560px/.test(css) && /max-width:\s*820px/.test(css) && /max-width:\s*1080px/.test(css));
check("CSS avoids horizontal carousel dependency", !/overflow-x:\s*(?:auto|scroll)/.test(css));
for (const keyframes of css.matchAll(/@keyframes\s+[^\s{]+\s*{([\s\S]*?)\n}/g)) {
  const properties = [...keyframes[1].matchAll(/^\s*([a-z-]+)\s*:/gm)].map((match) => match[1]);
  check("keyframes animate transform/opacity only", properties.every((property) => property === "transform" || property === "opacity"));
}

console.log(`\ngrowth-center-foundation.test.ts: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
