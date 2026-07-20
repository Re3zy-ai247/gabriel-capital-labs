// Run: npx tsx scripts/eventbus-authz-isolation.test.ts
//
// Proves the Event Bus read/replay layer is tenant + agency isolated, fail-closed to
// the narrowest scope, and driven ONLY by a server-resolved AuthContext (never a
// client-supplied tenantId/agencyId — the IDOR the adversarial review flagged as a
// BLOCKER). The publish-authorization half is added alongside in the same file.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { scopeWhere, parseCursor, cursorOf, type AuthContext } from "../lib/eventBus/store";
import { requestIdentity, systemIdentity, type PublishIdentity } from "../lib/eventBus/envelope";
import { authorizePublish } from "../lib/eventBus/publish";
import { getContract } from "../lib/eventBus/contracts";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const code = (p: string) =>
  readFileSync(join(__dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── scopeWhere: fail-closed narrowest-first ──────────────────────────────────
const admin: AuthContext = { tenantId: "adm", agencyId: null, isAgency: false, isAdmin: true };
const agencyA: AuthContext = { tenantId: "A", agencyId: "A", isAgency: true, isAdmin: false };
const solo: AuthContext = { tenantId: "u1", agencyId: null, isAgency: false, isAdmin: false };
const managedClient: AuthContext = { tenantId: "c1", agencyId: "A", isAgency: false, isAdmin: false };

check("admin scope is platform-wide ({})", eq(scopeWhere(admin), {}));
check("agency scope = own tenant OR agency-scoped events", eq(scopeWhere(agencyA), { OR: [{ tenantId: "A" }, { agencyId: "A" }] }));
check("solo user scope = own tenant only", eq(scopeWhere(solo), { tenantId: "u1" }));
// THE isolation point: a managed client (isAgency=false) with a managing agencyId must
// NOT get the agency-wide stream — only its own tenant.
check("managed client scope = own tenant only, NOT the agency stream", eq(scopeWhere(managedClient), { tenantId: "c1" }));
check("managed client scope does NOT include agencyId filter", !JSON.stringify(scopeWhere(managedClient)).includes("agencyId"));

// ── Cursor determinism ───────────────────────────────────────────────────────
check("parseCursor round-trips a well-formed cursor", eq(parseCursor("1700000000000:evt_abc"), { createdAt: new Date(1700000000000), id: "evt_abc" }));
check("parseCursor rejects malformed (no colon)", parseCursor("garbage") === null);
check("parseCursor rejects empty", parseCursor("") === null);
check("cursorOf composes createdAtMs:id", cursorOf({ id: "evt_x", createdAt: new Date(5).toISOString() } as any) === "5:evt_x");

// ── Code-scan: reads take a server-resolved AuthContext, never client strings ─
{
  const store = code("lib/eventBus/store.ts");
  check("readSince takes an AuthContext (ctx), not a loose tenantId", /readSince\(\s*\n?\s*ctx: AuthContext/.test(store) || /export async function readSince\(\s*ctx: AuthContext/.test(store));
  check("replayEvents takes an AuthContext", /replayEvents\(\s*\n?\s*ctx: AuthContext/.test(store) || /export async function replayEvents\(\s*ctx: AuthContext/.test(store));
  check("redactEvent takes an AuthContext", /redactEvent\(ctx: AuthContext/.test(store));
  check("store never reads req/searchParams/query for scope", !/searchParams|req\.query|request\.nextUrl/.test(store));
  check("every read applies scopeWhere(ctx)", (store.match(/scopeWhere\(ctx\)/g) || []).length >= 3);
}

// ── requestIdentity: actor=principal, tenant=data-owner, agency by id ────────
{
  // Agency A operating client C: actor is A (principal), tenant is C (data owner).
  const id = requestIdentity({ id: "A", role: "USER", isAgency: true }, { id: "C", managedByAgencyId: "A" }, new Set());
  check("agency-with-client-open: actor = agency id (principal)", id.actorId === "A");
  check("agency-with-client-open: tenant = client id (data owner)", id.tenantId === "C");
  check("agency-with-client-open: agencyId = the agency id", id.agencyId === "A");
  check("agency-with-client-open: isAgency true", id.isAgency === true);

  // Solo user: no agency anywhere.
  const soloId = requestIdentity({ id: "u1", role: "USER", isAgency: false }, { id: "u1", managedByAgencyId: null }, new Set());
  check("solo user: agencyId is null", soloId.agencyId === null);
  check("solo user: actor === tenant === self", soloId.actorId === "u1" && soloId.tenantId === "u1");

  // Managed client acting directly (no agency session): agencyId = its managing agency, but isAgency false.
  const mc = requestIdentity({ id: "c1", role: "USER", isAgency: false }, { id: "c1", managedByAgencyId: "A" }, new Set());
  check("managed client: agencyId = managing agency, isAgency false", mc.agencyId === "A" && mc.isAgency === false);

  // NEVER `account.id ?? managedByAgencyId`: a non-agency actor's agencyId comes from the data owner, not the actor id.
  check("non-agency actor never stamps its own id as agencyId", mc.agencyId !== "c1");
}

// ── authorizePublish: the publish PEP (scope + required permission), fail-closed ─
const idOf = (o: Partial<PublishIdentity>): PublishIdentity => ({
  actorId: "a", tenantId: "t", agencyId: null, isAdmin: false, isAgency: false, grantedPermissions: new Set(), trusted: false, ...o,
});
const c = (type: string) => getContract(type, 1)!;

// self-scope: any authenticated identity WITH the required permission
check("self event allowed with the required permission", authorizePublish(c("LETTER_GENERATED"), idOf({ grantedPermissions: new Set(["letters:generate"]) })).ok === true);
check("self event DENIED without the required permission", authorizePublish(c("LETTER_GENERATED"), idOf({ grantedPermissions: new Set() })).ok === false);
check("self event (no perm required) allowed for a plain authenticated identity", authorizePublish(c("ACCOUNT_UPDATED"), idOf({})).ok === true);
// agency-scope: requires an agency account
check("agency event DENIED for a non-agency identity", authorizePublish(c("CLIENT_CREATED"), idOf({ isAgency: false })).ok === false);
check("agency event allowed for an agency identity", authorizePublish(c("CLIENT_CREATED"), idOf({ isAgency: true })).ok === true);
// platform-scope: requires admin
check("platform event DENIED for a non-admin", authorizePublish(c("SYSTEM_EVENT"), idOf({ isAdmin: false })).ok === false);
check("platform event allowed for an admin", authorizePublish(c("SYSTEM_EVENT"), idOf({ isAdmin: true })).ok === true);
check("NOTIFICATION_CREATED DENIED for admin WITHOUT notify:plan", authorizePublish(c("NOTIFICATION_CREATED"), idOf({ isAdmin: true, grantedPermissions: new Set() })).ok === false);
check("NOTIFICATION_CREATED allowed for admin WITH notify:plan", authorizePublish(c("NOTIFICATION_CREATED"), idOf({ isAdmin: true, grantedPermissions: new Set(["notify:plan"]) })).ok === true);
// trusted system identity satisfies scope by construction but is still tenant-bound
check("trusted system identity may publish a platform event", authorizePublish(c("SYSTEM_EVENT"), systemIdentity("t1")).ok === true);
check("unresolved identity (no tenant) is denied", authorizePublish(c("SYSTEM_EVENT"), idOf({ tenantId: "" , trusted: false, isAdmin: true })).ok === false);

// NEGATIVE CONTROL
check("negative control: a non-agency, non-admin, unpermissioned identity cannot publish an agency or platform event",
  authorizePublish(c("CLIENT_CREATED"), idOf({})).ok === false && authorizePublish(c("KAI_INSIGHT_CREATED"), idOf({})).ok === false);

// ── Read endpoint: admin-only, flag-gated, server-resolved ctx (no IDOR) ─────
{
  const route = code("app/api/event-bus/read/route.ts");
  check("read route is flag-gated (eventBusEnabled)", /eventBusEnabled\(\)/.test(route));
  check("read route requires admin (requireAdmin)", /requireAdmin\(\)/.test(route));
  check("read route builds ctx with isAdmin from the session, NOT from query", /isAdmin:\s*true/.test(route) && /admin\.id/.test(route));
  check("read route never reads tenantId/agencyId from the query string", !/searchParams\.get\(["'](tenant|agency)/i.test(route));
  check("read route validates ?type against the known set", /EVENT_TYPES[\s\S]*includes/.test(route));
  // Structural: only read + redact endpoints exist under app/api/event-bus — NO public
  // publish endpoint (publishing is internal-only).
  const busApiDir = join(__dirname, "..", "app/api/event-bus");
  const subdirs = readdirSync(busApiDir);
  check("no public publish endpoint (internal publication only)", !subdirs.includes("publish") && subdirs.includes("read"));

  // Redact (data-subject erasure) endpoint is admin-only, flag-gated, server-resolved ctx.
  const redact = code("app/api/event-bus/redact/route.ts");
  check("redact route is flag-gated + admin-only", /eventBusEnabled\(\)/.test(redact) && /requireAdmin\(\)/.test(redact));
  check("redact route resolves ctx server-side (isAdmin from session), not from body", /isAdmin:\s*true/.test(redact) && /admin\.id/.test(redact));
  check("redact route calls redactEvent (erasure path is wired)", /redactEvent\(/.test(redact));
}

console.log(`\neventbus-authz-isolation.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
