// Run: npx tsx scripts/identity-runtime.test.ts
//
// The Operator Identity runtime (Sprint 9): service orchestration, repository, auth
// boundary, profile-media boundary. Proves the Phase-6 properties without a live DB:
// fail-closed dormancy is EXECUTED (every service door returns disabled with the flag
// off, before any query); authorization / isolation / idempotency / audit are proven by
// the pure boundary logic + structural code-scans of the service and repository.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePrincipal, isAdmin, type IdentityPrincipal } from "../lib/identity/principal";
import { profileMediaEnabled, OPERATOR_PROFILE_MEDIA_SCOPE, PROFILE_MEDIA_PREREQUISITES } from "../lib/identity/profileMedia";
import { permissionsForRole } from "../lib/identity/rbac";
import * as svc from "../lib/identity/service";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const service = read("lib/identity/service.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const repository = read("lib/identity/repository.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ── Auth boundary (pure) ─────────────────────────────────────────────────────
check("resolvePrincipal: null account -> null", resolvePrincipal(null) === null);
check("resolvePrincipal: disabled account -> null (fail-closed)", resolvePrincipal({ id: "a1", role: "ADMIN", disabled: true }) === null);
check("resolvePrincipal: valid account -> principal (id = account id)", resolvePrincipal({ id: "a1", role: "USER" })?.id === "a1");
check("isAdmin true only for ADMIN", isAdmin({ id: "a", role: "ADMIN", isAgency: false, disabled: false }) && !isAdmin({ id: "b", role: "USER", isAgency: false, disabled: false }));
check("isAdmin false for a disabled 'admin'", !isAdmin({ id: "a", role: "ADMIN", isAgency: false, disabled: true }));

// ── Profile-media boundary: reserved, hard-off, not built ────────────────────
check("profile media is HARD-DISABLED (fail-closed, not built)", profileMediaEnabled() === false);
check("operator_profile scope reserved on the attachments boundary", OPERATOR_PROFILE_MEDIA_SCOPE === "operator_profile");
check("profile-media prerequisites documented (incl. CSAM/NCMEC + CROA screening)",
  PROFILE_MEDIA_PREREQUISITES.length >= 8 && PROFILE_MEDIA_PREREQUISITES.some((p) => /CSAM|NCMEC/.test(p)) && PROFILE_MEDIA_PREREQUISITES.some((p) => /CROA/.test(p)));

// ── RBAC extension is present + PEP-consumable (not a parallel engine) ────────
check("RBAC map exposes OWNER permissions", permissionsForRole("OWNER").size > permissionsForRole("MEMBER").size);
check("service authorizes by ownership (ownsOrAdmin), NOT a parallel permission engine",
  /ownsOrAdmin\(/.test(service) && !/permissionsForRole\(/.test(service));

// ── Service structure: fail-closed gate FIRST in every door ──────────────────
{
  // Slice 1: the operator lifecycle door moved to lib/identity/lifecycle.ts, which runs
  // its OWN flag-first gate (pinned by identity-lifecycle.test.ts §11). service.ts
  // re-exports it, so it is no longer an `export async function` here.
  const doors = ["registerOwnOperator", "createOrganization", "addMember", "changeMemberRole", "removeMember", "getOperator", "listMembersOfOrganization", "listMyMemberships"];
  // Every exported service function begins by calling gate(...) before any repo/DB call.
  for (const d of doors) {
    const body = service.slice(service.indexOf(`export async function ${d}`));
    const head = body.slice(0, 240);
    check(`${d}: gate() runs first (flag + principal, fail-closed)`, /const g = gate\(/.test(head));
  }
  check("gate() checks the flag AND the principal", /operatorIdentityEnabled\(\)/.test(service) && /principal\.disabled/.test(service));
}

// ── Authorization is BY ID, never by client-supplied name/slug ───────────────
check("org authz loads the org by id and checks ownerAccountId", /findOrganizationById\(/.test(service) && /org\.ownerAccountId/.test(service));
check("service never authorizes on a client-supplied org name/slug", !/authoriz[\s\S]{0,80}(\.name|\.slug)/.test(service));
check("service never reads request/query input", !/searchParams|req\.query|request\.nextUrl|headers\(\)/.test(service));

// ── Auditability: every mutation records a durable identity event ────────────
// Slice 1: the lifecycle mutation records its evidence through the transactional
// draft+append path (§11), not recordIdentityEvent, so service.ts now holds the
// five non-lifecycle emitters and delegates the sixth.
check("non-lifecycle mutations record identity events (5 recordIdentityEvent calls)", (service.match(/recordIdentityEvent\(/g) || []).length === 5);
check("the lifecycle door is delegated, not reimplemented", /export \{ transitionOperator \} from "\.\/lifecycle"/.test(service));
check("state transition stamps the event with the row's updatedAt (oscillation-safe)", /updatedAt\.getTime\(\)/.test(service));

// ── Reads enforce isolation (self / owned-org / admin) ───────────────────────
check("getOperator: self OR admin only", /operator\.accountId === g\.principal\.id/.test(service));
check("listMyMemberships: scoped to the principal's own operator", /findOperatorByAccount\(g\.principal\.id\)/.test(service));

// ── Repository: idempotent + race-safe writes; no self-heal ──────────────────
check("registerOperator is find-or-create (idempotent, P2002-safe)", /findUnique\(\{ where: \{ accountId \} \}\)/.test(repository) && /isUniqueViolation\(e\)/.test(repository));
check("addMembership is find-or-create on the unique (org,operator) key", /findMembership\(/.test(repository) && /organizationId_operatorId/.test(repository));
check("operator transition is a GUARDED updateMany(where {id, state: from})", /updateMany\(\{\s*where: \{ id: operatorId, state: from \}/.test(repository));
check("membership role change is a GUARDED, STATE-guarded updateMany (cannot land on a non-ACTIVE membership)", /where: \{ organizationId, operatorId, role: from, state: "ACTIVE" \}/.test(repository));
check("guarded transitions require exactly one row moved (count !== 1 => conflict)", /res\.count !== 1/.test(repository));
check("repository issues NO CREATE TABLE (migration-first, not self-heal)", !/CREATE TABLE/i.test(repository));
check("repository never reads request/query input", !/searchParams|req\.query|request\./.test(repository));

// ── EXECUTED fail-closed dormancy: every door is a no-op with the flag off ────
(async () => {
  const p: IdentityPrincipal = { id: "a1", role: "ADMIN", isAgency: false, disabled: false };
  const results = await Promise.all([
    svc.registerOwnOperator(p),
    svc.transitionOperator(p, { operatorId: "op1", to: "ACTIVE", authority: "PLATFORM_IDENTITY_REVIEW", basis: "PLATFORM_REVIEW_APPROVED", commandId: "c1", effectiveAt: 1 }),
    svc.createOrganization(p, { name: "Acme Credit" }),
    svc.addMember(p, { organizationId: "o1", operatorId: "op1", role: "MEMBER" }),
    svc.changeMemberRole(p, { organizationId: "o1", operatorId: "op1", role: "ADMIN" }),
    svc.removeMember(p, { organizationId: "o1", operatorId: "op1" }),
    svc.getOperator(p, "op1"),
    svc.listMembersOfOrganization(p, "o1"),
    svc.listMyMemberships(p),
  ]);
  check("ALL 9 service doors are fail-closed disabled when OPERATOR_IDENTITY_ENABLED is unset (no DB touch)",
    results.every((r: { ok: boolean }) => r.ok === false && (r as any).code === "disabled"));
  // Even a null principal returns disabled (flag checked first), never a crash.
  const nullp = await svc.createOrganization(null, { name: "X" });
  check("null principal + flag off -> disabled (no throw)", nullp.ok === false && (nullp as any).code === "disabled");

  console.log(`\nidentity-runtime.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
