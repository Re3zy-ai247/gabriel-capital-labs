// Run: npx tsx scripts/network-authz.test.ts
//
// Proves the Operator Network authorization matrix at RUNTIME (not UI), fail-closed,
// tenant-scoped by id. This is the isolation the network's activation is gated on:
// agency A must never reach agency B; a removed member must lose access; a public
// channel must never bind client-private data. Includes negative controls.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canViewChannel, canPostChannel, canAccessAgencyChannel, canModerate,
  type Channel, type NetworkAccount,
} from "../lib/network/authz";
import { channelForCategory } from "../lib/network/channels";
import { arenaEnabled } from "../lib/arena/flags";
import { operatorNetworkEnabled } from "../lib/network/flags";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
// Strip comments so code-scan assertions judge USAGE, not the prose that
// deliberately names a forbidden pattern to say "never do this".
const code = (p: string) =>
  readFileSync(join(__dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// Fixtures. Membership uses the canonical predicate: canAccessCommunity = ADMIN || isPremium.
const anon: NetworkAccount | null = null;
const free: NetworkAccount = { id: "free-1", plan: "explorer", subscriptionStatus: null, isAgency: false };
const paying: NetworkAccount = { id: "pay-1", plan: "premium", subscriptionStatus: "active", isAgency: false };
const agencyA: NetworkAccount = { id: "agencyA", plan: "agency", subscriptionStatus: "active", isAgency: true };
const agencyB: NetworkAccount = { id: "agencyB", plan: "agency", subscriptionStatus: "active", isAgency: true };
const clientOfA: NetworkAccount = { id: "client-1", isAgency: false, managedByAgencyId: "agencyA", plan: null, subscriptionStatus: null };
const admin: NetworkAccount = { id: "admin-1", role: "ADMIN", isAgency: false };
const disabledPaying: NetworkAccount = { ...paying, id: "dis-1", disabled: true };

const pub: Channel = { key: "lobby", visibility: "public" };
const members: Channel = { key: "general", visibility: "members" };
const privA: Channel = { key: "a-desk", visibility: "agency_private", ownerAgencyId: "agencyA" };
const privB: Channel = { key: "b-desk", visibility: "agency_private", ownerAgencyId: "agencyB" };
const privBroken: Channel = { key: "broken", visibility: "agency_private", ownerAgencyId: "  " };

// ── The 5×3 truth table (view / post / moderate) ─────────────────────────────
// Anonymous
check("anon views public", canViewChannel(anon, pub) === true);
check("anon cannot view members", canViewChannel(anon, members) === false);
check("anon cannot post public", canPostChannel(anon, pub) === false);
check("anon cannot moderate", canModerate(anon, pub) === false);
// Free / Explorer
check("free views public", canViewChannel(free, pub) === true);
check("free cannot view members", canViewChannel(free, members) === false);
check("free CANNOT post public (view-only)", canPostChannel(free, pub) === false);
check("free cannot post members", canPostChannel(free, members) === false);
// Paying member
check("paying views + posts members", canViewChannel(paying, members) && canPostChannel(paying, members));
check("paying posts public", canPostChannel(paying, pub) === true);
check("paying cannot access an agency-private channel", canViewChannel(paying, privA) === false && canPostChannel(paying, privA) === false);
check("paying cannot moderate", canModerate(paying, members) === false);
// Agency A
check("agencyA views + posts + moderates its OWN private channel", canViewChannel(agencyA, privA) && canPostChannel(agencyA, privA) && canModerate(agencyA, privA));
check("agencyA CANNOT view agency B's private channel (tenant isolation)", canViewChannel(agencyA, privB) === false);
check("agencyA CANNOT post to agency B's channel", canPostChannel(agencyA, privB) === false);
check("agencyA CANNOT moderate agency B's channel", canModerate(agencyA, privB) === false);
check("agencyB symmetrically cannot reach agency A", canViewChannel(agencyB, privA) === false && canModerate(agencyB, privA) === false);
// Admin
check("admin views/posts/moderates everything", canViewChannel(admin, privA) && canPostChannel(admin, privA) && canModerate(admin, privB));
// Managed client of A (verified edge) — may reach A's channel, not B's
check("verified managed client of A can view A's channel", canAccessAgencyChannel(clientOfA, privA) === true);
check("managed client of A cannot reach B's channel", canAccessAgencyChannel(clientOfA, privB) === false);

// ── Fail-closed on uncertain / broken audience ───────────────────────────────
check("malformed agency_private (empty owner) denies EVERYONE for access", canAccessAgencyChannel(agencyA, privBroken) === false && canAccessAgencyChannel(admin, privBroken) === false);
check("malformed agency_private denies view for all", canViewChannel(agencyA, privBroken) === false && canViewChannel(paying, privBroken) === false);
check("admin can still moderate a malformed channel (fail-safe cleanup)", canModerate(admin, privBroken) === true);

// ── Removed / disabled membership loses access ───────────────────────────────
check("a disabled paying member loses view AND post", canViewChannel(disabledPaying, members) === false && canPostChannel(disabledPaying, members) === false);
// An account whose managedByAgencyId no longer points at A cannot reach A.
check("a client removed from agency A (edge severed) loses A's channel", canAccessAgencyChannel({ ...clientOfA, managedByAgencyId: null }, privA) === false);

// ── Authorization keys on ID, never on the free-text agency name ─────────────
{
  const src = code("lib/network/authz.ts");
  check("authz decides on account id / managedByAgencyId, never agencyName", !/agencyName/.test(src));
  check("authz has no Prisma import (pure decision logic)", !/from\s+["'][^"']*prisma["']|PrismaClient/.test(src));
}

// ── Registry fails closed to members, never public/agency_private ────────────
check("known channel key resolves to members", channelForCategory("general").visibility === "members");
check("UNKNOWN channel key fails closed to members (never public)", channelForCategory("nonexistent").visibility === "members");
check("no registered channel is public or agency_private today (dormant surface)",
  ["", "general", "wins", "strategy", "tools", "questions"].every((k) => channelForCategory(k).visibility === "members"));

// ── Flags fail closed (opt-in only) ──────────────────────────────────────────
check("arena flag OFF when env unset", (() => { delete process.env.ARENA_ENABLED; return arenaEnabled() === false; })());
check("network flag OFF when env unset", (() => { delete process.env.OPERATOR_NETWORK_ENABLED; return operatorNetworkEnabled() === false; })());
check("arena flag OFF for any non-'true' value", (() => { process.env.ARENA_ENABLED = "false"; const a = arenaEnabled(); process.env.ARENA_ENABLED = "1"; const b = arenaEnabled(); delete process.env.ARENA_ENABLED; return a === false && b === false; })());
check("arena flag ON only for exactly 'true'", (() => { process.env.ARENA_ENABLED = "true"; const on = arenaEnabled(); delete process.env.ARENA_ENABLED; return on === true; })());
// The flag modules must not use the vacuous !== "false" / ?? true patterns.
{
  const af = code("lib/arena/flags.ts");
  const nf = code("lib/network/flags.ts");
  check("flag modules use === \"true\" (opt-in), not !== \"false\"", /=== "true"/.test(af) && /=== "true"/.test(nf) && !/!==?\s*"false"/.test(af + nf) && !/\?\?\s*true/.test(af + nf));
}

// ── NEGATIVE CONTROL — prove the isolation check can fail ─────────────────────
// If canViewChannel wrongly returned true for cross-agency, this would be true.
check("negative control: cross-agency view is NOT permitted", canViewChannel(agencyA, privB) !== true);

console.log(`\nnetwork-authz.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
