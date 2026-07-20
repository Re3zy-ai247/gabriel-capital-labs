// Tenant-aware authorization for community attachments. Reuses the proven Operator
// Network access matrix (lib/network/authz.ts, 36/36) so attachment access and
// channel access can never diverge on who may see a private thread.
//
// WHY THIS EXISTS. The attachment route previously authorized community attachments
// on canAccessCommunity + parent-exists alone. That is correct TODAY — every thread
// is a members surface, and no agency-private thread exists. But the moment an
// agency-private thread carries an attachment, that check would serve client-private
// evidence (bureau letters, IDs) to ANY paying member. The adversarial review named
// this: add the audience predicate BEFORE the private-audience column ships. This is
// that predicate, landed first, so the isolation is enforced by construction the
// instant the column exists.
import { canViewChannel, type Channel, type NetworkAccount } from "@/lib/network/authz";

// The thread fields the audience decision needs. `audienceAgencyId` is not a column
// yet; it is read defensively (undefined => null => members surface, i.e. exactly
// today's behavior). When the migration adds the column, threads scoped to an agency
// become agency_private automatically and this predicate isolates them — no route
// change required.
// Accepts any thread row and reads the (future) audience field defensively — an
// index signature so a thread type that does not yet declare the column still type-
// checks, and the value is simply null until the migration adds it.
interface ThreadAudience {
  audienceAgencyId?: string | null;
  [key: string]: unknown;
}

export function canViewCommunityAttachment(
  account: NetworkAccount | null,
  thread: ThreadAudience,
): boolean {
  const raw = thread.audienceAgencyId;
  // Only a genuinely ABSENT audience (column missing => undefined, or explicitly
  // null) is a members thread. A PRESENT-but-malformed value (blank string) is a
  // broken private audience and must fail closed, NOT silently open to all members.
  // canViewChannel/canAccessAgencyChannel denies a blank owner, so routing a blank
  // string through agency_private is the fail-closed path.
  const channel: Channel =
    raw === undefined || raw === null
      ? { key: "thread", visibility: "members", ownerAgencyId: null }
      : { key: "thread", visibility: "agency_private", ownerAgencyId: typeof raw === "string" ? raw : "" };
  return canViewChannel(account, channel);
}
