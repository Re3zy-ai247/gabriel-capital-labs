// Operator Identity — ENROLLMENT PERSISTENCE PORT (Implementation Slice 2).
//
// WHY THIS IS AN INTERFACE AND NOT A TABLE.
//
// Enrollment needs durable, queryable pre-membership state: find a record, re-evaluate
// its expiry and revocation AT REDEMPTION (§15.9), and append immutable consent episodes
// (§5.5, ICAP-1 A-2). No such table exists — `prisma/schema.prisma` declares no
// Enrollment, Invitation, Acceptance, or Consent model.
//
// Creating one requires a 7th migration directory. `scripts/gate-d-preflight-core.ts`
// pins the migration-directory set to exactly six and `loadGateDManifest` THROWS on any
// difference, with CI running that check on every push to every branch. Constitution
// §13.3 requires an owner-approved versioned manifest-extension mechanism BEFORE a
// seventh migration can land, and that governance is Implementation Slice 7 — presently
// unauthorized. §13.1 is migration-first, so the schema cannot be smuggled in behind the
// runtime either.
//
// The ratified implementation plan already resolved this: Slices 1-6 "may land only
// dormant command contracts, pure policy, and tests that use existing schema. Any code
// that depends on new persistence stops at an interface until Slice 7 supplies the
// reviewed migration first." Slice 2's exit gate is "contracts and pure decision policy
// are complete; persistence remains unreachable until migration/evidence readiness."
//
// So: this is the port. The only adapter is fail-closed unavailable. When Slice 7 lands
// the reviewed migration, a Prisma adapter implements this interface and
// `loadEnrollmentStore()` returns it — no decision logic changes, because none of it
// lives here.
import type { EnrollmentEntry, EnrollmentState } from "./enrollment";

/** The durable pre-membership record (§2.8). Read-only to the decision layer. */
export interface EnrollmentRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly subjectAccountId: string;
  readonly entry: EnrollmentEntry;
  readonly state: EnrollmentState;
  readonly expiresAt: number;
  /** Opaque reference to the invitation artifact. NEVER the secret itself. */
  readonly invitationRef: string | null;
}

export interface EnrollmentStore {
  readonly available: boolean;
  load(enrollmentId: string): Promise<EnrollmentRecord | null>;
  /** Guarded CAS transition, mirroring the operator lifecycle's count-based guard. */
  transition(enrollmentId: string, from: EnrollmentState, to: EnrollmentState): Promise<{ count: number }>;
}

// The only adapter that exists. Every method rejects rather than returning an empty
// result, so an absent store can never be mistaken for "no such enrollment" — that
// distinction is what keeps §1.11 (ambiguity grants no authority) true here.
export const UNAVAILABLE_ENROLLMENT_STORE: EnrollmentStore = {
  available: false,
  async load() { throw new Error("enrollment store unavailable"); },
  async transition() { throw new Error("enrollment store unavailable"); },
};

export function loadEnrollmentStore(): EnrollmentStore {
  return UNAVAILABLE_ENROLLMENT_STORE;
}
