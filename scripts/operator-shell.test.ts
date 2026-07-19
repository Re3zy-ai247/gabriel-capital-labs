// Run: npx tsx scripts/operator-shell.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Operator Network Phase 1 guard — structural laws for the UI-only shell.
// Locks the Design Bible + Phase-1 scope invariants: ambient layer etiquette
// (reduced-motion/Save-Data/visibility/deterministic/capped parallax), server-
// rendered shell (no client feed state), unchanged access gate, unchanged
// records (no new Prisma models), preserved composer behavior, and the
// no-dopamine laws (feed ends; no entrance animations; hover = border only).
import { readFileSync } from "fs";

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

// ── Ambient layer etiquette (Design Bible §4.3) ──────────────────────────────
check("ambient honors prefers-reduced-motion (never mounts)", /prefers-reduced-motion/.test(ambient));
check("ambient honors Save-Data (never mounts)", /saveData/.test(ambient));
check("ambient pauses when the tab is hidden", /visibilitychange/.test(ambient) && /document\.hidden/.test(ambient));
check("ambient pauses off-viewport", /IntersectionObserver/.test(ambient));
check("ambient defers mount to idle (post-LCP)", /requestIdleCallback/.test(ambient));
check("ambient is aria-hidden decoration", /aria-hidden="true"/.test(ambient));
check("ambient is deterministic — no Math.random", !/Math\.random/.test(ambient));
check("pointer parallax capped at 6px (Bible cap)", /PARALLAX_MAX = 6\b/.test(ambient));
check("device pixel ratio capped at 2", /MAX_DPR = 2\b/.test(ambient));
check("ambient cleans up every listener/observer/frame",
  /removeEventListener\("pointermove"/.test(ambient) && /cancelAnimationFrame/.test(ambient) && /\.disconnect\(\)/.test(ambient));
check("ambient has a zero-JS CSS fallback layer", /bg-gradient-to-b/.test(ambient));
check("ambient imports only react (no libraries, no runtime generation)",
  (ambient.match(/^import .+ from "(.+)";?$/gm) ?? []).every((l) => /from "react"/.test(l)));

// ── Server-rendered shell (Phase 1 scope) ────────────────────────────────────
check("page is a server component (no 'use client')", !/"use client"/.test(page));
check("page is force-dynamic (session-dependent)", /dynamic = "force-dynamic"/.test(page));
check("page reads via prisma directly — no self-API fetch", !/fetch\(/.test(page));
check("page mirrors the existing list contract (pinned desc, activity desc, take 200)",
  /pinned: "desc"/.test(page) && /lastActivityAt: "desc"/.test(page) && /take: 200/.test(page));
check("access gate semantics unchanged (canAccessCommunity + Agency copy)",
  /canAccessCommunity\(account\)/.test(page) && /Community Hub is for Agency members/.test(page));
check("degraded DB state renders calm copy, never a crash",
  /unreachable right now/.test(page) && /degraded/.test(page));
check("channels come only from the existing category set",
  /CATEGORY_KEYS\.includes\(raw\)/.test(page) && /CATEGORIES/.test(rail) && !/"events"/.test(page));
check("rail marks unbuilt entries as non-navigable SOON (nothing fabricated)",
  /aria-disabled="true"/.test(rail) && />SOON</.test(rail));
check("stats use tabular numerals", /tnum/.test(page) && /tnum/.test(card));
check("nav landmarks labeled", /aria-label="Channels"/.test(rail) && /aria-label="Current activity"/.test(page));

// ── No new backend (STOP-condition proof) ────────────────────────────────────
check("no new Prisma models (schema untouched by Phase 1)",
  !/model (Operator|Channel|CommunityReaction|PublicMedia|Notification|Reputation|DataPoint|Ledger)/.test(schema));
check("community models remain exactly Thread/Reply/Report",
  ["model CommunityThread", "model CommunityReply", "model CommunityReport"].every((m) => schema.includes(m)) &&
  (schema.match(/^model Community/gm) ?? []).length === 3);
check("NowPanel is pure presentation over props (no prisma, no fetch)", !/prisma|fetch\(/.test(now));

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
check("feed cards render without entrance animation", !/animate-(rise|fadein|float)/.test(card));
check("card hover is a border shift only (no lift/scale/shadow)",
  /hover:border-/.test(card) && !/hover:(shadow|scale|-translate)/.test(card));
check("loading is a shape-matched skeleton, not a spinner", /animate-pulse/.test(loading) && !/Loader2|animate-spin/.test(loading));

if (bad.length) console.error(bad.join("\n"));
console.log(`\noperator-shell.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
