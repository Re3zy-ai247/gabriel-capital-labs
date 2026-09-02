// Run: npx tsx scripts/operator-shell.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Operator Network guard (Phase 1.1) — structural + behavioral laws for the
// Intelligence Operations Center shell. Locks: the attention-queue comparator
// (deterministic, open-loop-first), the all-paid access model (single canonical
// predicate, fail-closed), the naming decision (no customer-facing "Community"
// chrome), ambient-layer etiquette + data-driven state, no-dopamine laws, and
// the Phase-1 scope (no new records/backend).
import { readFileSync } from "fs";
import { compareThreads, isOpenLoop, type OperatorThread } from "../components/community/format";

let pass = 0, fail = 0; const bad: string[] = [];
const check = (l: string, ok: boolean) => { ok ? pass++ : (fail++, bad.push(`FAIL: ${l}`)); };
const read = (p: string) => readFileSync(p, "utf8");

const ambient = read("components/community/AmbientGrid.tsx");
const page = read("app/community/page.tsx");
const rail = read("components/community/OperatorRail.tsx");
const card = read("components/community/FeedCard.tsx");
const now = read("components/community/NowPanel.tsx");
const composer = read("components/community/Composer.tsx");
const loading = read("app/community/loading.tsx");
const schema = read("prisma/schema.prisma");
const community = read("lib/community.ts");
const sidebar = read("components/Sidebar.tsx");
const pricing = read("app/pricing/PricingTiers.tsx");

// ── Attention-queue comparator: deterministic, open-loop-first ───────────────
const T = (o: Partial<OperatorThread>): OperatorThread => ({
  id: "t0", title: "x", category: "general", authorName: "a", pinned: false, locked: false,
  replyCount: 1, kaiAnswered: false, lastActivityAt: "2026-07-01T00:00:00.000Z", excerpt: "", ...o,
});
const pinnedOld = T({ id: "p1", pinned: true, lastActivityAt: "2026-01-01T00:00:00.000Z" });
const openLoop = T({ id: "o1", replyCount: 0, lastActivityAt: "2026-06-01T00:00:00.000Z" });
const lockedUnanswered = T({ id: "l1", replyCount: 0, locked: true, lastActivityAt: "2026-07-10T00:00:00.000Z" });
const activeNew = T({ id: "a1", replyCount: 5, lastActivityAt: "2026-07-15T00:00:00.000Z" });
const twinA = T({ id: "aaa", replyCount: 2 });
const twinB = T({ id: "bbb", replyCount: 2 });

check("comparator: pinned beats everything (even a stale pin)", compareThreads(pinnedOld, activeNew) < 0);
check("comparator: open loop (0 responses, unlocked) beats recent activity", compareThreads(openLoop, activeNew) < 0);
check("comparator: a LOCKED zero-response thread is NOT an open loop", !isOpenLoop(lockedUnanswered) && compareThreads(activeNew, lockedUnanswered) < 0);
check("comparator: within a class, most recent activity first", compareThreads(activeNew, T({ id: "a2", replyCount: 3, lastActivityAt: "2026-07-12T00:00:00.000Z" })) < 0);
check("comparator: equal timestamps tie-break on immutable id (stable)", compareThreads(twinA, twinB) < 0 && compareThreads(twinB, twinA) > 0);
check("comparator: reflexively zero (sort-safe)", compareThreads(twinA, twinA) === 0);
const shuffled = [activeNew, twinB, openLoop, pinnedOld, lockedUnanswered, twinA];
const sortedIds = [...shuffled].sort(compareThreads).map((t) => t.id).join(",");
const resortedIds = [...shuffled].reverse().sort(compareThreads).map((t) => t.id).join(",");
check("comparator: input-order independent (deterministic replay)", sortedIds === resortedIds);
check("comparator: full order is pinned → open loops → recency → id", sortedIds === "p1,o1,a1,l1,aaa,bbb");
check("page sorts the feed through the canonical comparator", /\.sort\(compareThreads\)/.test(page));
check("no randomness anywhere in the shell", ![ambient, page, card, now, rail].some((s) => /Math\.random/.test(s)));

// ── Access model: all paid members, one predicate, fail-closed ───────────────
// RC1-S6a (Founder D-8): the network is OFF, not priced. The gate is a feature
// switch, and the billing predicate must never come back — the negative half is
// the half that matters.
check("canAccessCommunity delegates to communityEnabled(), absent = off",
  /return communityEnabled\(\);/.test(community) &&
  /process\.env\.COMMUNITY_ENABLED === "true"/.test(community) &&
  !/isPremium/.test(community));
check("no duplicated billing logic (no plan-string comparisons anywhere in the gate module)",
  !/plan\s*===/.test(community));
// RC1-S6b (Founder D-8). The network is switched OFF, not priced, so the three
// rows that pinned "paid membership" gate copy, a /pricing CTA, and an
// Operator-Network row in the consumer pricing matrix all assert copy that was
// ordered removed. Their protective intent — the gate must state the TRUE reason
// and must not dead-end the reader — survives, re-expressed against the new
// truth. Comment-stripped, because this file documents the sentence it removed
// (app/community/page.tsx:141-154) and commit 1fbe901 showed a raw scan passing
// on that narration.
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
   .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const pageCode = strip(page), pricingCode = strip(pricing);

check("gate copy: closed for everyone, not a plan or a membership decision",
  /closed right now/.test(pageCode) &&
  /switched off for everyone/.test(pageCode) &&
  /nothing to buy that would open it/.test(pageCode) &&
  !/membership|paid plan|Agency members|is for members/i.test(pageCode));
check("gate offers no purchase CTA and no /pricing destination",
  !/href="\/pricing"/.test(pageCode) && !/See plans/.test(pageCode));
check("gate is not a dead end — it routes back into the product the consumer does have",
  /href="\/dashboard"/.test(pageCode) &&
  /Everything else in CreditVector is unaffected/.test(pageCode));
check("gate states the author keeps control of their own posts (S6a's carve-out)",
  /delete anything you wrote/.test(pageCode));
check("page title chrome is Operator Network", /title="\/ Operator Network"/.test(page) && /title="\/ Operator Network"/.test(loading));
check("sidebar label is Operator Network", /label: "Operator Network"/.test(sidebar));
check("the consumer cost page carries no tier matrix and no Operator Network tier row",
  !/\["Operator Network"/.test(pricingCode) && !/\["Community access"/.test(pricingCode));
check("no customer-facing 'Community Hub' chrome remains in the shell",
  !/Community Hub/.test(page) && !/Community Hub/.test(sidebar));

// ── Rail: working destinations only; no false semantics ──────────────────────
check("rail has NO disabled/SOON navigation theater", !/SOON|aria-disabled/.test(rail));
check("rail has no success-colored navigation state (green = verified only)", !/success-/.test(rail) && !/>HERE</.test(rail));
check("rail renders only the existing category rooms", /CATEGORIES\.map/.test(rail) && !/"events"|Lounge|Bookmarks/.test(rail));
check("nav landmarks labeled (workspace + situation vocabulary)", /aria-label="Workspaces"/.test(rail) && /aria-label="Situation report"/.test(page));

// ── Ambient layer: data-driven + etiquette (Design Bible §4.3) ───────────────
check("ambient is driven by real aggregate state (typed props from the server)",
  /AmbientState/.test(ambient) && /AmbientGrid state=\{ambient\}/.test(page.replace(/[\n ]+/g, " ")));
check("ambient derives density/breath/accents from state only",
  /deriveParams/.test(ambient) && /spacing: 76 - total \* 0\.2/.test(ambient) && /accents: awaiting/.test(ambient));
check("ambient receives only aggregate integers (no content/identifiers)",
  /total: number/.test(ambient) && !/title|authorName|email|userId/.test(ambient));
check("ambient honors prefers-reduced-motion (never mounts)", /prefers-reduced-motion/.test(ambient));
check("ambient honors Save-Data (never mounts)", /saveData/.test(ambient));
check("ambient pauses when the tab is hidden", /visibilitychange/.test(ambient) && /document\.hidden/.test(ambient));
check("ambient pauses off-viewport", /IntersectionObserver/.test(ambient));
check("ambient defers mount to idle (post-LCP)", /requestIdleCallback/.test(ambient));
check("ambient is aria-hidden decoration", /aria-hidden="true"/.test(ambient));
check("pointer parallax capped at 6px (Bible cap)", /PARALLAX_MAX = 6\b/.test(ambient));
check("device pixel ratio capped at 2", /MAX_DPR = 2\b/.test(ambient));
check("ambient cleans up every listener/observer/frame",
  /removeEventListener\("pointermove"/.test(ambient) && /cancelAnimationFrame/.test(ambient) && /\.disconnect\(\)/.test(ambient));
check("ambient has a zero-JS CSS fallback layer", /bg-gradient-to-b/.test(ambient));
check("ambient imports only react (no libraries, no runtime generation)",
  (ambient.match(/^import .+ from "(.+)";?$/gm) ?? []).every((l) => /from "react"/.test(l)));

// ── Server-rendered shell (scope unchanged) ──────────────────────────────────
check("page is a server component (no 'use client')", !/"use client"/.test(page));
check("page is force-dynamic (session-dependent)", /dynamic = "force-dynamic"/.test(page));
check("page reads via prisma directly — no self-API fetch", !/fetch\(/.test(page));
check("page keeps the existing list contract (cap 200, isKai annotation)", /take: 200/.test(page) && /isKai: true/.test(page));
check("degraded DB state renders calm copy, never a crash", /unreachable right now/.test(page) && /degraded/.test(page));
check("channels come only from the existing category set", /CATEGORY_KEYS\.includes\(raw\)/.test(page));
check("no hero masthead: operational strip only (no marketing paragraph, no text-lg outside the gate)",
  !/Ask anything about the dispute process/.test(page) && !/KaiBadge/.test(page));
check("strip states are derived, never fabricated", /awaiting = scoped\.filter\(isOpenLoop\)\.length/.test(page) && /activeRecent = scoped\.filter\(isRecent\)/.test(page));

// ── No new backend (STOP-condition proof) ────────────────────────────────────
// The operator-shell/community scope adds NO backend models. Word-boundary anchored so
// a bare `model Operator` (and the other still-unbuilt speculative models) stay forbidden,
// while the sanctioned Sprint 9 `model OperatorIdentity` foundation is not false-matched.
check("no new operator-shell/community backend models",
  !/model (Operator|Channel|CommunityReaction|PublicMedia|Notification|Reputation|DataPoint|Ledger)\b/.test(schema));
check("community models remain exactly Thread/Reply/Report",
  ["model CommunityThread", "model CommunityReply", "model CommunityReport"].every((m) => schema.includes(m)) &&
  (schema.match(/^model Community/gm) ?? []).length === 3);
check("NowPanel is pure presentation over props (no prisma, no fetch)", !/prisma|fetch\(/.test(now));

// ── Network State panel: intelligence-shaped, no social vanity ───────────────
check("no contributor/popularity widgets remain", !/Recent contributors|Initials|Most active/.test(now));
check("panel sections are work-state shaped", /Needs attention/.test(now) && /Recently active/.test(now) && /Kai activity/.test(now));
check("panel sits on a quieter plane (border containment, not filled cards)", !/className="card/.test(now) && /border border-ink-700\/50/.test(now));

// ── Card anatomy: work object, attribution secondary ─────────────────────────
check("card leads with domain + provable state, attribution demoted to footer",
  card.indexOf("categoryLabel(t.category)") < card.indexOf("{t.title}") &&
    card.indexOf("Awaiting first response") < card.indexOf("opened by"));
check("card states are provable only (no verification/confidence claims)",
  !/[Vv]erified|[Cc]onfidence|[Ss]upported|[Cc]ontested|[Pp]roven/.test(card));
check("card wording: responses, not social replies", /responses/.test(card) && /opened by/.test(card));
check("feed cards render without entrance animation", !/animate-(rise|fadein|float)/.test(card));
check("card hover is a border shift only (no lift/scale/shadow)",
  /hover:border-/.test(card) && !/hover:(shadow|scale|-translate)/.test(card));

// ── Composer behavior preserved (existing functionality, not new) ────────────
check("composer posts multipart to the existing route",
  /fetch\("\/api\/community\/threads", \{ method: "POST", body: form \}\)/.test(composer));
check("composer preserves askKai + attachments + paste-to-attach",
  /askKai/.test(composer) && /AttachmentPicker/.test(composer) && /imagesFromClipboard/.test(composer));
check("composer keeps the moderation house-rule copy verbatim",
  /House rule: process language, never promised outcomes/.test(composer));
check("composer inputs are labeled (a11y)", /htmlFor="composer-title"/.test(composer) && /htmlFor="composer-body"/.test(composer));

// ── Anti-dopamine laws (Design Bible §7/§14) ─────────────────────────────────
check("the feed ends — honest end-cap, no infinite scroll",
  /caught up/.test(page) && !/IntersectionObserver/.test(page) && !/IntersectionObserver/.test(card));
check("loading is a shape-matched skeleton, not a spinner", /animate-pulse/.test(loading) && !/Loader2|animate-spin/.test(loading));
check("tabular numerals on comparable numbers", /tnum/.test(page) && /tnum/.test(card) && /tnum/.test(now));

// ── Phase 1.1 adversarial-review pins (34-agent workflow, confirmed findings) ─
const detail = read("app/community/[id]/page.tsx");
check("detail page chrome renamed one click deep (no '/ Community' titles)",
  !/title="\/ Community"/.test(detail) && /title="\/ Operator Network"/.test(detail) && !/Back to Community</.test(detail));
check("detail page vocabulary matches the shell (responses, not replies)", /"response" : "responses"/.test(detail));
check("display-name fallback is population-neutral (never 'Agency Member')",
  /\|\| "Member"/.test(community) && !/"Agency Member"/.test(community));
check("strip counts are scoped to the visible queue (same set as the feed)",
  /scoped\.filter\(isOpenLoop\)/.test(page) && /const queue = scoped/.test(page));
check("strip title is a real heading (h1 → h2 outline restored)", /<h2 className="text-sm font-semibold/.test(page));
check("card state vocabulary is field-backed ('In session', never a recency claim)",
  /In session/.test(card) && !/>Active</.test(card) && !/In discussion/.test(card));
check("Kai panel claims only what the payload proves ('Most recently active', not 'Latest')",
  /Most recently active:/.test(now) && !/Latest: \{/.test(now));
check("canvas is viewport-bounded (sticky h-screen frame measured, not the feed wrapper)",
  /sticky top-0 h-screen/.test(ambient) && /stick\.getBoundingClientRect/.test(ambient) && /overflow-clip/.test(ambient));
check("ambient effect keys on primitive values, never object identity",
  /\[active, total, awaiting, activeThreads\]/.test(ambient));
check("mobile composer trigger is viewport-fixed (no sticky-overlap trap)",
  /fixed bottom-20 right-4/.test(composer) && !/-mb-10/.test(composer));
check("no ARIA label on a generic span; loading region is role=status",
  !/<span[^>]*aria-label="Network state"/.test(page) && /role="status"/.test(loading));
check("no sub-AA slate-600 TEXT in the shell (decorative aria-hidden icons exempt)",
  ![page, rail].some((s) => s.split("\n").some((l) => /text-slate-600/.test(l) && !/aria-hidden="true"/.test(l))));
check("admin/module registry naming follows the decision",
  /Operator Network/.test(read("lib/platform/modules.ts")) && /Operator Network/.test(read("components/marketing/SiteNav.tsx")));

const living = read("components/community/LivingIntelligence.tsx");
const css = read("app/globals.css");
const shared = read("lib/communityShared.ts");

// ── Phase 1.2: Intelligence Operations Center interaction language ───────────
check("workspaces, not chat channels: no hash glyph and no Hash icon in the rail",
  !/Hash/.test(rail) && !/>#/.test(rail) && /Workspaces/.test(rail));
check("rooms carry LIVE derived state (briefs + awaiting) on every door",
  /RoomState/.test(rail) && /awaiting/.test(rail) && /briefs/.test(rail));
check("workspace names are executive rooms over FROZEN storage keys",
  /Strategy Council/.test(shared) && /Kai Intelligence/.test(shared) && /Executive Briefing/.test(shared) &&
  /key: "wins"/.test(shared) && /key: "questions"/.test(shared) && /key: "general"/.test(shared));
check("room bylines stay process-language (records, never promises)",
  /records, never promises/.test(shared) && !/guarantee/i.test(shared));
check("the queue is sectioned operational work, not a feed",
  /Requires attention/.test(page) && /Active intelligence/.test(page) && /requiresAttention/.test(page));
check("each room has a server-chosen atmosphere (deterministic tint map)",
  /ATMOSPHERE/.test(page) && /tint=\{ATMOSPHERE\[channel\]/.test(page.replace(/\s+/g, " ")));
check("no forum vocabulary in shell display strings",
  ![page, card, now, composer].some((f) => /discussion|forum\b|any thread/i.test(f)) &&
  !/>Channel</.test(composer) && /Workspace</.test(composer));
check("brief vocabulary is consistent (file a brief, briefs end-cap)",
  /File a brief/.test(composer) && /File brief/.test(composer) && /"brief" : "briefs"/.test(page));
check("house-rule compliance copy keeps its binding first sentence",
  /House rule: process language, never promised outcomes/.test(composer));
check("Living Intelligence island: reduced-motion + Save-Data attach nothing",
  /prefers-reduced-motion/.test(living) && /saveData/.test(living));
check("Living Intelligence island: delegated, throttled, fully cleaned up",
  /closest/.test(living) && /requestAnimationFrame/.test(living) &&
  /removeEventListener\("pointermove"/.test(living) && /removeEventListener\("pointerover"/.test(living));
check("Living Intelligence island renders nothing (behavior only)", /return null;/.test(living));
check("Living Intelligence imports only react", (living.match(/^import .+ from "(.+)";?$/gm) ?? []).every((l) => /from "react"/.test(l)));
check("computation reveal is pure CSS at render (ops-card overlay + vars)",
  /\.ops-card::after/.test(css) && /--lx/.test(css) && /radial-gradient/.test(css));
check("breathing is MEANINGFUL only: awaiting-first-response cards, 6s border-alpha",
  /ops-breathe 6s/.test(css) && /\$\{open \? " ops-breathe" : ""\}/.test(card));
check("living-intelligence CSS is reduced-motion silent",
  /prefers-reduced-motion[^}]*\{[^}]*\.ops-card::after \{ display: none/s.test(css.replace(/\n/g, " ")) || (/@media \(prefers-reduced-motion: reduce\)/.test(css) && /\.ops-breathe \{ animation: none/.test(css)));
check("ambient responds to room presence (operator-focus bias, eased + decaying)",
  /operator-focus/.test(ambient) && /focus\.bias/.test(ambient) && /decayAt/.test(ambient) &&
  /removeEventListener\("operator-focus"/.test(ambient.replace(/window\./g, "")));
check("room doors announce themselves to the ambient field (data-workspace)",
  /data-workspace/.test(rail) && /data-workspace/.test(living));
check("detail page speaks brief/response vocabulary",
  /this brief/.test(detail) && !/this discussion/.test(detail) && /Add your response/.test(detail));

if (bad.length) console.error(bad.join("\n"));
console.log(`\noperator-shell.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
