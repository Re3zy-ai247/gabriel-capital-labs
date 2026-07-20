// Guard for ADR-0031 §4 — the canonical Agency capacity & packaging resolver.
// Pure decision logic + structural scans. Run: npx tsx scripts/agency-capacity.test.ts
import { readFileSync } from "fs";
import {
  resolveAgencyCapacity, WORKSPACE_BASE_V3, STAFF_USER_LIMIT, ADDON_WORKSPACES_PER_PACK,
  type AgencyCapacityInput,
} from "../lib/agencyCapacity";
import { CAPABILITY_MATRIX } from "../config/capabilityMatrix";

let pass = 0, fail = 0; const bad: string[] = [];
const ok = (l: string, c: boolean) => { c ? pass++ : (fail++, bad.push(`FAIL: ${l}`)); };
const read = (p: string) => readFileSync(p, "utf8");

const V3 = new Date("2026-08-01");     // ≥ 2026-07-19 → v3
const V2 = new Date("2026-07-18");     // 2026-07-17..18 → v2 (grandfathered)
const LEGACY = new Date("2026-07-01"); // < 2026-07-17 → v1_legacy
const ws = (i: AgencyCapacityInput) => resolveAgencyCapacity(i).workspaceLimit;

// 1-3 · v3 base caps
ok("1· Agency v3 = 15", ws({ isAgency: true, createdAt: V3 }) === 15);
ok("2· Agency Pro v3 = 30", ws({ plan: "agency_pro", isAgency: true, createdAt: V3 }) === 30);
ok("3· Scale v3 = 50", ws({ plan: "scale", isAgency: true, createdAt: V3 }) === 50);
ok("3b· v3 base equals the exported canonical constants", WORKSPACE_BASE_V3.agency === 15 && WORKSPACE_BASE_V3.agency_pro === 30 && WORKSPACE_BASE_V3.scale === 50);

// 4 · staff limits (declaration-only) = 1/3/5
ok("4· staff limits 1/3/5", resolveAgencyCapacity({ isAgency: true, createdAt: V3 }).staffUserLimit === 1
  && resolveAgencyCapacity({ plan: "agency_pro", isAgency: true, createdAt: V3 }).staffUserLimit === 3
  && resolveAgencyCapacity({ plan: "scale", isAgency: true, createdAt: V3 }).staffUserLimit === 5
  && STAFF_USER_LIMIT.agency === 1 && STAFF_USER_LIMIT.agency_pro === 3 && STAFF_USER_LIMIT.scale === 5);

// 5-8 · add-on packs
ok("5· one pack adds 10 (Agency Pro 30 → 40)", ws({ plan: "agency_pro", isAgency: true, createdAt: V3, addonPackCount: 1 }) === 40);
ok("6· packs stack deterministically (3 → +30 = 60)", ws({ plan: "agency_pro", isAgency: true, createdAt: V3, addonPackCount: 3 }) === 60 && ADDON_WORKSPACES_PER_PACK === 10);
ok("7· zero packs change nothing", ws({ plan: "agency_pro", isAgency: true, createdAt: V3, addonPackCount: 0 }) === 30);
ok("8· negative/malformed/fractional packs fail closed to 0", [-5, NaN, Infinity, 1.9, "3" as unknown as number, null].every((n) => {
  const r = resolveAgencyCapacity({ plan: "scale", isAgency: true, createdAt: V3, addonPackCount: n as number });
  return r.workspaceLimit === 50 && r.addonPackCount === 0 && r.addonWorkspaceLimit === 0;
}));

// 9-10 · Enterprise
ok("9· Enterprise explicit override + add-on", (() => { const r = resolveAgencyCapacity({ plan: "enterprise", isAgency: true, createdAt: V3, enterpriseWorkspaceOverride: 250, enterpriseStaffOverride: 12, addonPackCount: 2 }); return r.workspaceLimit === 270 && r.staffUserLimit === 12; })());
ok("10· Enterprise without override fails closed (null / negotiated)", (() => { const r = resolveAgencyCapacity({ plan: "enterprise", isAgency: true, createdAt: V3 }); return r.workspaceLimit === null && r.staffUserLimit === null; })());

// 11 · unknown tier
ok("11· unknown tier fails closed to 0", ws({ plan: "wizard", isAgency: false, createdAt: V3 }) === 0 && ws({ createdAt: V3 }) === 0);

// 12-13 · grandfathering
ok("12· grandfathered legacy Agency Pro keeps unlimited (null)", (() => { const r = resolveAgencyCapacity({ plan: "agency_pro", isAgency: true, createdAt: LEGACY }); return r.workspaceLimit === null && r.grandfathered === true && r.packagingVersion === "v1_legacy"; })());
ok("13· grandfathered v2 Scale keeps 100", (() => { const r = resolveAgencyCapacity({ plan: "scale", isAgency: true, createdAt: V2 }); return r.workspaceLimit === 100 && r.grandfathered === true && r.packagingVersion === "v2"; })());
ok("12b· grandfathered legacy Agency keeps 20", ws({ isAgency: true, createdAt: LEGACY }) === 20);
ok("13b· legacy Agency Pro unlimited base ignores add-on packs", ws({ plan: "agency_pro", isAgency: true, createdAt: LEGACY, addonPackCount: 5 }) === null);

// 14 · new accounts never receive the old 40/100
ok("14· new (v3) accounts do NOT get old 40/100", ws({ plan: "agency_pro", isAgency: true, createdAt: V3 }) !== 40 && ws({ plan: "scale", isAgency: true, createdAt: V3 }) !== 100);
ok("14b· missing createdAt → current v3 base (fail-closed to 15, never a legacy grandfather)", ws({ isAgency: true }) === 15 && resolveAgencyCapacity({ isAgency: true }).grandfathered === false);

// 15 · active callers use the canonical resolver
const ent = read("lib/entitlements.ts");
const route = read("app/api/agency/clients/route.ts");
ok("15· agencyClientLimit delegates to resolveAgencyCapacity (no stale hardcoded caps)",
  /resolveAgencyCapacity\(/.test(ent) && !/return legacy \? null : 40|user\.plan === "scale"\) return 100/.test(ent));
ok("15b· the only production caller imports agencyClientLimit", /import \{[^}]*agencyClientLimit[^}]*\} from "@\/lib\/entitlements"/.test(route) && /agencyClientLimit\(agency\)/.test(route));

// 16 · capability matrix cannot drift from canonical constants
const M = CAPABILITY_MATRIX;
const wl = (t: string) => (M as never as Record<string, { limits: Map<string, unknown> }>)[t].limits.get("CLIENT_WORKSPACE_LIMIT");
const tm = (t: string) => (M as never as Record<string, { limits: Map<string, unknown> }>)[t].limits.get("TEAM_MEMBER_LIMIT");
ok("16· matrix workspace limits import the canonical v3 base (no drift)", wl("agency") === WORKSPACE_BASE_V3.agency && wl("agency_pro") === WORKSPACE_BASE_V3.agency_pro && wl("scale") === WORKSPACE_BASE_V3.scale);
ok("16b· matrix staff limits import the canonical staff seats (no drift)", tm("agency") === STAFF_USER_LIMIT.agency && tm("agency_pro") === STAFF_USER_LIMIT.agency_pro && tm("scale") === STAFF_USER_LIMIT.scale);
ok("16c· matrix imports the canonical module (single source)", /from "@\/lib\/agencyCapacity"/.test(read("config/capabilityMatrix.ts")));

// 17 · client input cannot set its own capacity
const inputBlock = read("lib/agencyCapacity.ts").match(/interface AgencyCapacityInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
ok("17· resolver input is server-authoritative — no client-settable capacity/limit field",
  inputBlock.length > 0 && !/\bworkspaceLimit\b|\bcapacity\b|\bclientCap\b|requestedWorkspaces/i.test(inputBlock));
ok("17b· the route computes the limit from the agency's own server record, not the request body",
  /agencyClientLimit\(agency\)/.test(route) && !/agencyClientLimit\(\s*(body|req|input|payload)/.test(route));

// 18 · pure + deterministic
const cap = read("lib/agencyCapacity.ts");
ok("18· deterministic (same input ⇒ identical output)", JSON.stringify(resolveAgencyCapacity({ plan: "scale", isAgency: true, createdAt: V3, addonPackCount: 2 })) === JSON.stringify(resolveAgencyCapacity({ plan: "scale", isAgency: true, createdAt: V3, addonPackCount: 2 })));
ok("18b· resolver module is pure — no prisma / DB / network / env", !/@\/lib\/prisma|from "\.\/prisma"|\bfetch\(|process\.env/.test(cap));

// 19 · no protected flag activation
ok("19· resolver activates no protected flag", !/CAPABILITY_PLATFORM|TEAM_FOUNDATION|SESSION_FOUNDATION|KERNEL_DURABLE|MAIL_LIVE/.test(cap));

// 20 · no billing / Stripe behavior change
ok("20· resolver touches no Stripe/billing", !/stripe|checkout|webhook|unit_amount|PRICE_CENTS/i.test(cap));

// ── 2026-07-20: atomic enforcement + display/engine consistency ───────────────
// Two regressions pinned here:
//  1. POST /api/agency/clients counted and inserted in two separate round trips,
//     so two concurrent creations at 14/15 could both read 14, both pass, and land
//     the agency at 16. Count+insert must sit in ONE transaction that first
//     row-locks the agency, so the second creation observes the first.
//  2. The pricing page advertised 40/100 active clients while the resolver enforced
//     30/50 — a buyer would have been sold capacity the server would not honor.
{
  const routeSrc = read("app/api/agency/clients/route.ts");
  ok("R1· client creation runs inside a transaction", /prisma\.\$transaction\(/.test(routeSrc));
  ok("R2· the agency row is locked FOR UPDATE", /FOR UPDATE/.test(routeSrc));
  const lockAt = routeSrc.indexOf("FOR UPDATE");
  const countAt = routeSrc.indexOf("tx.user.count");
  const createAt = routeSrc.indexOf("tx.user.create");
  ok("R3· lock precedes the count", lockAt > -1 && countAt > -1 && lockAt < countAt);
  ok("R4· count precedes the insert, same transaction", countAt > -1 && createAt > -1 && countAt < createAt);
  ok("R5· no unguarded pre-transaction count remains",
     !/await prisma\.user\.count\(\{ where: \{ managedByAgencyId/.test(routeSrc));
  ok("R6· refusal is a 402 quoting the enforced limit", /status: 402/.test(routeSrc) && /e\.limit/.test(routeSrc));

  const tiersSrc = read("app/pricing/PricingTiers.tsx");
  ok("D1· matrix shows the enforced 15/30/50",
     /"Active client workspaces", "-", "-", "-", "15", "30", "50", "Custom"/.test(tiersSrc));
  ok("D2· no stale 40-client Agency Pro claim", !/Grow to 40 active clients/.test(tiersSrc));
  ok("D3· no stale 100-client Scale claim", !/up to 100 active clients/.test(tiersSrc));
  ok("D4· Agency Pro advertises 30", /Grow to 30 active clients/.test(tiersSrc));
  ok("D5· Scale advertises 50", /up to 50 active clients/.test(tiersSrc));
}

if (bad.length) console.error(bad.join("\n"));

console.log(`\nagency-capacity.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
