// Kernel host — Capability Resolution / the plan→capability map (Sprint 2, migration #2).
// The Capability Engine (ADR-0022) realized: it maps the existing entitlement model to the
// kernel's preloaded EntitlementSnapshot (built ONCE per request — R3). This is the single
// source the kernel reads to answer "what CAN this actor do?". It grows one capability at a
// time as subsystems migrate; today it declares the first migrated capability.
import type { CapabilityKey, EntitlementSnapshot, Permission } from "@/lib/os/kernel";

const DRAFT = "credit.letter.draft" as CapabilityKey;
const ANALYZE = "credit.response.analyze" as CapabilityKey;
const OBSOLESCENCE = "credit.obsolescence.window" as CapabilityKey;
const INSIGHT = "credit.tradeline.insight" as CapabilityKey;
const COMPOSE = "credit.campaign.compose" as CapabilityKey;
// Platform (not credit) — GIOS-generic notification decision (Migration #10). Granted to every
// app/actor: it is Layer-2 mechanism any application inherits, deterministic → free.
const NOTIFY_PLAN = "notify.plan.compose" as CapabilityKey;

// `premium` mirrors lib/entitlements.isPremium. Letter drafting is available to every
// authenticated user (today's behavior; the monthly free-letter LIMIT is a downstream policy
// that migrates to a PEP provider later). Response Intelligence is a paid capability today
// (AI tools are a Professional feature) — so it's flagged live but granted only to premium.
export function entitlementSnapshot(opts: { premium: boolean }): EntitlementSnapshot {
  const caps = new Set<CapabilityKey>([DRAFT, OBSOLESCENCE, INSIGHT, COMPOSE, NOTIFY_PLAN]); // deterministic → all users
  const perms = new Set<Permission>(["letters:generate", "obsolescence:check", "tradeline:read", "campaign:compose", "notify:plan"]);
  if (opts.premium) { caps.add(ANALYZE); perms.add("responses:analyze"); }     // AI tools → paid
  return {
    grantedCapabilities: caps,
    flags: new Map<CapabilityKey, boolean>([[DRAFT, true], [ANALYZE, true], [OBSOLESCENCE, true], [INSIGHT, true], [COMPOSE, true], [NOTIFY_PLAN, true]]),
    grantedPermissions: perms,
  };
}
