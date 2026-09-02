// Run: npx tsx scripts/attachment-authz.test.ts
//
// Proves the community attachment surface is tenant-isolated and fail-closed, and
// that the route authorizes on the audience-aware predicate — not canAccessCommunity
// alone. The predicate is landed BEFORE the agency-private-audience column, so the
// isolation is enforced by construction the instant that column ships.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canViewCommunityAttachment } from "../lib/community/attachmentAuthz";
import type { NetworkAccount } from "../lib/network/authz";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}

const paying: NetworkAccount = { id: "pay-1", plan: "premium", subscriptionStatus: "active", isAgency: false };
const agencyA: NetworkAccount = { id: "agencyA", plan: "agency", subscriptionStatus: "active", isAgency: true };
const agencyB: NetworkAccount = { id: "agencyB", plan: "agency", subscriptionStatus: "active", isAgency: true };
const clientOfA: NetworkAccount = { id: "c-1", isAgency: false, managedByAgencyId: "agencyA" };
const admin: NetworkAccount = { id: "adm", role: "ADMIN" };
const free: NetworkAccount = { id: "free-1", plan: "explorer", subscriptionStatus: null };
const disabled: NetworkAccount = { ...paying, id: "dis", disabled: true };

// A members thread (no audience column / null) — today's every thread.
const membersThread = { id: "T1" };
// A future agency-private thread owned by agency A.
const privateThreadA = { id: "T2", audienceAgencyId: "agencyA" };
const privateThreadB = { id: "T3", audienceAgencyId: "agencyB" };
const malformedPrivate = { id: "T4", audienceAgencyId: "   " };

// ── RC1-S6a (Founder D-8): a members thread follows the COMMUNITY SWITCH ─────
// The members surface used to open on payment. It now opens on COMMUNITY_ENABLED
// and nothing else, so with the switch off (the shipped default) community
// attachments are unreachable for everyone alike — fail-closed and consistent
// with reads being off. Nothing is deleted: deleteThreadAndAttachments still
// sweeps an attachment when its thread is removed.
check("a members-thread attachment follows the community switch (absent = off)",
  canViewCommunityAttachment(paying, membersThread) === false &&
  canViewCommunityAttachment(free, membersThread) === false);
check("…and paying buys no advantage over not paying",
  canViewCommunityAttachment(paying, membersThread) === canViewCommunityAttachment(free, membersThread));
check("with the switch ON, any signed-in account may view — no tier", (() => {
  process.env.COMMUNITY_ENABLED = "true";
  const both = canViewCommunityAttachment(free, membersThread) === true &&
    canViewCommunityAttachment(paying, membersThread) === true;
  delete process.env.COMMUNITY_ENABLED;
  return both;
})());
check("anonymous cannot view", canViewCommunityAttachment(null, membersThread) === false);
check("disabled member cannot view", canViewCommunityAttachment(disabled, membersThread) === false);

// ── The latent defect is closed: private-thread attachments are tenant-scoped ─
check("agency A views its OWN private-thread attachment", canViewCommunityAttachment(agencyA, privateThreadA) === true);
check("agency A CANNOT view agency B's private-thread attachment (the defect, closed)", canViewCommunityAttachment(agencyA, privateThreadB) === false);
check("agency B symmetrically cannot view agency A's", canViewCommunityAttachment(agencyB, privateThreadA) === false);
check("a plain paying member cannot view ANY private-thread attachment", canViewCommunityAttachment(paying, privateThreadA) === false && canViewCommunityAttachment(paying, privateThreadB) === false);
check("a verified managed client of A can view A's private-thread attachment", canViewCommunityAttachment(clientOfA, privateThreadA) === true);
check("a client severed from A loses access", canViewCommunityAttachment({ ...clientOfA, managedByAgencyId: null }, privateThreadA) === false);
check("admin can view any private-thread attachment (deliberate, scoped)", canViewCommunityAttachment(admin, privateThreadB) === true);

// ── Fail-closed on malformed audience ────────────────────────────────────────
check("malformed private audience (blank owner) denies everyone", canViewCommunityAttachment(agencyA, malformedPrivate) === false && canViewCommunityAttachment(paying, malformedPrivate) === false);

// ── The route wires the predicate (not canAccessCommunity alone) ─────────────
{
  const route = readFileSync(join(__dirname, "..", "app/api/attachments/[id]/route.ts"), "utf8");
  check("attachment route calls canViewCommunityAttachment for both community scopes",
    (route.match(/canViewCommunityAttachment\(/g) ?? []).length >= 2);
  // RC1-S6a: the community switch must NOT reach evidence that has nothing to do
  // with the community. Support-ticket attachments authorize on ticket ownership
  // alone, and the route handles exactly three scopes — so no dispute/letter
  // evidence is behind the switch.
  check("support-ticket attachments are unaffected by the community switch",
    /att\.scope === "support_message"/.test(route) &&
    /msg\.ticket\?\.userId === account\.id/.test(route) &&
    !/canViewCommunityAttachment/.test(
      route.slice(route.indexOf('att.scope === "support_message"'), route.indexOf('att.scope === "community_thread"'))
    ));
  check("…and the route authorizes exactly three scopes, none of them letters/disputes",
    (route.match(/att\.scope === "/g) ?? []).length === 3 && !/scope === "letter|scope === "dispute/.test(route));
  check("attachment route no longer authorizes community attachments on canAccessCommunity alone",
    !/canAccessCommunity/.test(route));
  check("a reply attachment resolves its parent thread's audience (no reply-scope bypass)",
    /reply\.threadId/.test(route) && /communityThread\.findUnique/.test(route));
  check("sensitive attachment bytes stay no-store", /"Cache-Control":\s*"no-store, private"/.test(route));
}

// ── NEGATIVE CONTROL — prove the isolation check can fail ─────────────────────
check("negative control: cross-agency private attachment is NOT viewable", canViewCommunityAttachment(agencyA, privateThreadB) !== true);

console.log(`\nattachment-authz.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
