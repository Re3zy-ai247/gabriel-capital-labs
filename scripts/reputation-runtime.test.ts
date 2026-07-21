// Run: npx tsx scripts/reputation-runtime.test.ts
//
// The Operator Reputation runtime (Sprint 10): EXECUTED fail-closed dormancy, the
// append-only guarantee (no update/delete path anywhere), ownership boundaries
// (identity consumed read-only and never mutated; Arena/UI untouched), event facts
// (refs-only, no fanout, forgery-denied), and idempotent write structure. DB-less.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as svc from "../lib/reputation/service";
import { recordReputationEvent, xpGrantedEvent, rankChangedEvent, milestoneReachedEvent, REPUTATION_EVENT_TYPES } from "../lib/reputation/events";
import { validateEvent } from "../lib/eventBus/validate";
import { getContract } from "../lib/eventBus/contracts";
import { authorizePublish } from "../lib/eventBus/publish";
import { systemIdentity, type PublishIdentity } from "../lib/eventBus/envelope";
import type { IdentityPrincipal } from "../lib/identity/principal";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const repository = strip(read("lib/reputation/repository.ts"));
const service = strip(read("lib/reputation/service.ts"));
const allRep = readdirSync(join(root, "lib/reputation")).map((f) => strip(read(`lib/reputation/${f}`))).join("\n");

// ── APPEND-ONLY by construction: no update/delete path anywhere ──────────────
check("repository exposes NO update (no .update/.updateMany/.upsert)", !/\.(update|updateMany|upsert)\(/.test(repository));
check("repository exposes NO delete", !/\.(delete|deleteMany)\(/.test(repository));
check("NOTHING in lib/reputation updates or deletes xpAward/reputationMilestone", !/(xpAward|reputationMilestone)\.(update|updateMany|upsert|delete|deleteMany)/.test(allRep));
check("writes are find-or-create on the unique keys (P2002-safe)", /subjectId_operatorId_awardKind/.test(repository) && /operatorId_milestoneKey/.test(repository) && /isUniqueViolation/.test(repository));
check("reads use the canonical fold order [createdAt asc, id asc]", /orderBy: \[\{ createdAt: "asc" \}, \{ id: "asc" \}\]/.test(repository));

// ── Ownership boundaries ─────────────────────────────────────────────────────
check("identity is consumed READ-ONLY (findOperatorById only; no identity service/mutation import)",
  /from "@\/lib\/identity\/repository"/.test(service) && !/registerOperator|transitionOperator|addMembership|changeMembershipRole|createOrganization/.test(service));
check("reputation never touches prisma.user / operatorIdentity writes", !/prisma\.user\.|operatorIdentity\.(create|update|delete)/.test(allRep));
check("no billing/marketplace/kai/network/UI imports", !/from "@\/lib\/(stripe|billing|kai|network|community)/.test(allRep) && !/from "@\/app\//.test(allRep));
check("no arena EXPERIENCE import (only the pure policy/project modules)",
  !/from "@\/lib\/arena\/(read|ownProgress|cohort|flags)"/.test(allRep) && /from "@\/lib\/arena\/policy"/.test(allRep) && /from "@\/lib\/arena\/project"/.test(allRep));
check("xp is NEVER an input (no xp field on RecordAwardInput — policy-resolved only)", !/RecordAwardInput[\s\S]{0,400}xp\s*[:?]/.test(service));
check("no HTTP surface (no route imports lib/reputation)", (() => {
  const hits: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(join(root, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name) && /lib\/reputation|@\/lib\/reputation/.test(read(p))) hits.push(p); } };
  walk("app"); return hits.length === 0;
})());

// ── Events: refs-only builders, deterministic dedupe, forgery denied ─────────
{
  const op = { operatorId: "op1", accountId: "acc1" };
  const samples = [
    xpGrantedEvent(op, { id: "aw1", classId: "A", xp: 20 }, 20, "system"),
    rankChangedEvent(op, "recruit", "contender", "system"),
    milestoneReachedEvent(op, "xp.100", "system"),
  ];
  check("every builder payload passes its contract (refs-only)", samples.every((s) => validateEvent(s.type, 1, s.payload).ok === true));
  check("dedupe keys are stable natural keys", samples[0].dedupeKey === "award:aw1" && samples[2].dedupeKey === "milestone:op1:xp.100");
  check("tenant = the operator's ACCOUNT id", samples.every((s) => s.tenantId === "acc1"));
  const idOf = (o: Partial<PublishIdentity>): PublishIdentity => ({ actorId: "a", tenantId: "t", agencyId: null, isAdmin: false, isAgency: false, grantedPermissions: new Set(), trusted: false, ...o });
  for (const t of REPUTATION_EVENT_TYPES) {
    const c = getContract(t, 1)!;
    check(`${t}: trusted system emitter allowed`, authorizePublish(c, systemIdentity("acc1")).ok === true);
    check(`${t}: ordinary identity DENIED (no forgery)`, authorizePublish(c, idOf({})).ok === false);
  }
  check("events module has NO fanout (no deliver/registry import)", !/from "@\/lib\/eventBus\/registry"|\bdeliver\(/.test(strip(read("lib/reputation/events.ts"))));
}

// ── EXECUTED fail-closed dormancy: every door disabled with the flag off ─────
(async () => {
  const p: IdentityPrincipal = { id: "acc1", role: "ADMIN", isAgency: false, disabled: false };
  const results = await Promise.all([
    svc.recordAward({ operatorId: "op1", subjectId: "outcome:l1", awardKind: "outcome", classId: "A" }),
    svc.reverseAward(p, "aw1"),
    svc.evaluateAndLatchMilestones("op1"),
    svc.getStanding(p, "op1"),
    svc.replayStanding("op1"),
  ]);
  check("ALL 5 service doors fail-closed disabled when OPERATOR_REPUTATION_ENABLED unset (no DB touch)",
    results.every((r) => r.ok === false && (r as { code?: string }).code === "disabled"));
  const ev = await recordReputationEvent(xpGrantedEvent({ operatorId: "op1", accountId: "acc1" }, { id: "aw1", classId: "A", xp: 20 }, 20, "system"));
  check("event recorder is fail-closed disabled too", ev.ok === false && (ev as { code?: string }).code === "disabled");

  console.log(`\nreputation-runtime.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
