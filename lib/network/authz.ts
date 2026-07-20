// Operator Network authorization — PURE, fail-closed decision logic. No I/O, no
// Prisma. Every verb denies by default and opens only a proven-authorized path.
// This is the tenant-isolation foundation the network's activation is gated on:
// authorization here runs at RUNTIME server-side, and UI visibility is never the
// gate.
//
// Reuses the single canonical paid axis (canAccessCommunity -> isPremium) so the
// network can never diverge from the rest of the product on who is a member.
//
// TENANT KEY IS AN ID, NEVER A NAME. Agency membership is decided on account id /
// managedByAgencyId only — never on the free-text agencyName brand, which is
// spoofable. The verified membership edge must be resolved server-side by the
// caller (prisma.user.findFirst({ where: { id, managedByAgencyId } })) and passed
// in; this module never trusts a client-supplied agency claim.
import { canAccessCommunity } from "@/lib/community";

export type ChannelVisibility = "public" | "members" | "agency_private";

// A channel is a value object, not a Prisma model — so no schema change and no
// governance-guard amendment for the access foundation.
export interface Channel {
  key: string;
  visibility: ChannelVisibility;
  ownerAgencyId?: string | null; // set only for agency_private
}

// The minimal account shape the matrix needs. `disabled` is re-checked here as
// defense-in-depth even though currentAccount() already evicts disabled accounts.
export interface NetworkAccount {
  id: string;
  role?: string | null;
  isAgency?: boolean | null;
  managedByAgencyId?: string | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  disabled?: boolean | null;
}

function isMember(a: NetworkAccount | null): boolean {
  if (!a || a.disabled === true) return false;
  return canAccessCommunity(a);
}
function isAdmin(a: NetworkAccount | null): boolean {
  return !!a && a.disabled !== true && a.role === "ADMIN";
}

// Access to an agency-private channel. Fail-closed on every uncertain input.
export function canAccessAgencyChannel(a: NetworkAccount | null, c: Channel): boolean {
  if (!a) return false;
  if (c.visibility !== "agency_private") return false;
  const owner = c.ownerAgencyId?.trim();
  if (!owner) return false; // audience uncertain => deny
  if (isAdmin(a)) return true; // global admin scope
  if (a.disabled === true) return false;
  if (a.isAgency === true && a.id === owner) return true; // the owning agency
  // A verified managed client of the owning agency. (Managed clients have no
  // password and cannot sign in today, so this branch is inert — but correct.)
  if (a.managedByAgencyId != null && a.managedByAgencyId === owner) return true;
  return false;
}

export function canViewChannel(a: NetworkAccount | null, c: Channel): boolean {
  switch (c.visibility) {
    case "public": return true;
    case "members": return isMember(a);
    case "agency_private": return canAccessAgencyChannel(a, c);
    default: return false;
  }
}

export function canPostChannel(a: NetworkAccount | null, c: Channel): boolean {
  if (!a) return false; // anonymous never posts
  switch (c.visibility) {
    case "public": return isMember(a); // free/Explorer view but do not post
    case "members": return isMember(a);
    case "agency_private": return canAccessAgencyChannel(a, c) && isMember(a);
    default: return false;
  }
}

// Moderation scope. Global for ADMIN; the owning agency may moderate its own
// private channel. Note: isAdmin precedes the owner check, so an ADMIN can still
// clean up a malformed (empty-owner) agency_private channel via the queue even
// though no one can access its content — fail-closed access, fail-safe cleanup.
export function canModerate(a: NetworkAccount | null, c: Channel): boolean {
  if (!a || a.disabled === true) return false;
  if (isAdmin(a)) return true;
  if (c.visibility === "agency_private") {
    const owner = c.ownerAgencyId?.trim();
    return !!owner && a.isAgency === true && a.id === owner;
  }
  return false;
}
