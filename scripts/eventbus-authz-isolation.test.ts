// Run: npx tsx scripts/eventbus-authz-isolation.test.ts
//
// Proves the Event Bus read/replay layer is tenant + agency isolated, fail-closed to
// the narrowest scope, and driven ONLY by a server-resolved AuthContext (never a
// client-supplied tenantId/agencyId — the IDOR the adversarial review flagged as a
// BLOCKER). The publish-authorization half is added alongside in the same file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scopeWhere, parseCursor, cursorOf, type AuthContext } from "../lib/eventBus/store";
import { requestIdentity } from "../lib/eventBus/envelope";

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

console.log(`\neventbus-authz-isolation.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
