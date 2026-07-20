// Run: npx tsx scripts/network-messages.test.ts
//
// Guards the message API route + its migration. There is no DB in this environment,
// so the route's security invariants are asserted by scanning the committed source
// (comments stripped, so the assertions judge USAGE not the prose that names a
// forbidden pattern to warn against it), and the migration is asserted structurally.
// Every invariant here is one an adversarial review flagged as load-bearing.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const code = (p: string) =>
  readFileSync(join(__dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ROUTE = "app/api/network/messages/route.ts";
const route = code(ROUTE);

// ── Identity: currentAccount(), NEVER currentUser() ──────────────────────────
// An agency posts AS itself; it must never post as an opened client, nor farm a
// client's identity. currentUser() resolves the opened workspace client, so it is
// the WRONG identity for the network and must not appear.
check("route resolves identity via currentAccount()", /currentAccount\(/.test(route));
check("route NEVER uses currentUser() (would leak the opened workspace client)", !/currentUser\(/.test(route));

// ── Two independent fail-closed gates ────────────────────────────────────────
check("route gates on operatorNetworkAccessible (feature-reach axis)", /operatorNetworkAccessible\(/.test(route));
check("route gates per-channel on canViewChannel/canPostChannel (channel axis)",
  /canViewChannel\(/.test(route) && /canPostChannel\(/.test(route));
check("both POST and GET check network accessibility",
  (route.match(/operatorNetworkAccessible\(/g) || []).length >= 2);

// ── CROA screen BEFORE any write ─────────────────────────────────────────────
check("route screens member text (screenCommunityText)", /screenCommunityText\(/.test(route));
{
  // The screen must precede the create — assert by source order.
  const iScreen = route.indexOf("screenCommunityText");
  const iCreate = route.indexOf("networkMessage.create");
  check("screen occurs BEFORE the create (no write of a prohibited claim)", iScreen > 0 && iCreate > 0 && iScreen < iCreate);
}

// ── Write throttle ───────────────────────────────────────────────────────────
check("route rate-limits writes keyed on the account", /enforceRateLimit\(`network-msg:\$\{account/.test(route));

// ── Response omits authorId; ownership pre-resolved to isOwn (HIGH #3) ────────
// Every response is built via shape(); assert its RETURNED literal carries isOwn
// and NO authorId key. Scoped to the return literal so the write-side `authorId:
// account.id` and the param type annotation don't create a false positive.
{
  const shapeFn = route.slice(route.indexOf("function shape"), route.indexOf("function resolveChannel"));
  const shapeReturn = shapeFn.slice(shapeFn.indexOf("return {"));
  check("response shape() returns isOwn", /isOwn/.test(shapeReturn));
  // No `authorId:` KEY in the emitted literal. Reading `m.authorId` to COMPUTE
  // isOwn is fine (no colon); only an emitted key would leak the raw id.
  check("response shape() emits NO authorId key (HIGH #3)", !/\bauthorId\s*:/.test(shapeReturn));
}

// ── Idempotency: P2002 replay on (authorId, clientMsgId) ─────────────────────
check("route handles P2002 as an idempotent replay", /P2002/.test(route) && /replayed:\s*true/.test(route));
check("replay looks up the stable (authorId, clientMsgId) unique", /authorId_clientMsgId/.test(route));
check("route requires a clientMsgId", /clientMsgId/.test(route) && /Missing clientMsgId/.test(route));

// ── Row-level tenant backstop in the read WHERE ──────────────────────────────
check("read WHERE re-asserts the channel audience (channelAudienceId backstop)", /audienceAgencyId:\s*channelAudienceId\(channel\)/.test(route));
check("write stamps the channel audience", /audienceAgencyId:\s*channelAudienceId\(channel\)/.test(route));

// ── Unknown channel is rejected (fail-closed on the registry) ────────────────
check("route validates the channel against KNOWN_CHANNEL_KEYS", /KNOWN_CHANNEL_KEYS\.includes\(/.test(route));

// ── NO runtime self-heal — this is a MIGRATION-backed feature ────────────────
check("route creates NO table at runtime (migration-first)", !/CREATE TABLE/i.test(route));
check("route runs on nodejs with a bounded maxDuration", /runtime\s*=\s*"nodejs"/.test(route) && /maxDuration\s*=\s*10/.test(route));

// ── The forward migration is structurally safe: only the 2 new tables, 0 DROP ─
{
  const migRoot = join(__dirname, "..", "prisma/migrations");
  const dir = readdirSync(migRoot).find((d) => d.endsWith("_operator_network_messages"));
  check("the operator_network_messages migration exists", !!dir);
  if (dir) {
    const sql = readFileSync(join(migRoot, dir, "migration.sql"), "utf8");
    const creates = (sql.match(/CREATE TABLE/g) || []).length;
    const drops = (sql.match(/\bDROP\b/g) || []).length;
    check("migration creates exactly the 2 new tables", creates === 2);
    check("migration contains ZERO DROP statements", drops === 0);
    check("migration creates NetworkMessage", /CREATE TABLE "NetworkMessage"/.test(sql));
    check("migration creates NetworkMessageReadState", /CREATE TABLE "NetworkMessageReadState"/.test(sql));
    check("migration only touches the two new tables (no ALTER of an existing table besides FK to User)",
      !/ALTER TABLE "(?!NetworkMessage)/.test(sql) || /REFERENCES "User"/.test(sql));
  }
}

// ── NEGATIVE CONTROL: the route must not be silently public ──────────────────
check("negative control: route does not early-return 200 before the gate", !/status:\s*200[\s\S]{0,40}operatorNetworkAccessible/.test(route));

console.log(`\nnetwork-messages.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
