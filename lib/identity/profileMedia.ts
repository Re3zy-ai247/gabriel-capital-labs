// Operator Identity — profile-media boundary (Sprint 9). DEFINITION ONLY; NOT BUILT.
//
// Every operator will eventually have a professional profile with media (OPERATOR-
// IDENTITY.md §5b). Two hard rules are fixed NOW so a future implementer cannot drift:
//
//   1. REUSE, don't duplicate. Profile image bytes must NOT live in an identity row.
//      They belong in the EXISTING lib/attachments.ts boundary (the Attachment table
//      keyed by scope+refId, magic-byte validation, size limits, encrypted at rest,
//      served only through an authorizing route). Profile media is simply a new
//      `operator_profile` SCOPE on that boundary — there is NO new media subsystem.
//
//   2. FAIL-CLOSED until the required controls exist. The profile surface is counsel-
//      gated (§6: CROA §1679b / FTC §5) and default-private; the current attachments
//      route has none of the controls below. So profile media is HARD-DISABLED here.
//
// This module ships the scope reservation + the prerequisite register only. Building
// the upload/serve path is a separate, owner- and counsel-gated slice.

export const OPERATOR_PROFILE_MEDIA_SCOPE = "operator_profile";

// The controls that MUST exist before any operator profile media ships. None is built.
export const PROFILE_MEDIA_PREREQUISITES: readonly string[] = [
  "server-authorized uploads",
  "image re-encoding (the current boundary validates magic bytes but does not re-encode)",
  "EXIF / geolocation metadata stripping (server-side, not client-trusted)",
  "dimension limits",
  "malware scanning where supported",
  "CSAM detection + NCMEC reporting obligation",
  "impersonation / brand-claim screening (a photo or name spoofing a real person/brand)",
  "per-field visibility enforcement at the serving route (public / org-only / private) before releasing bytes",
  "CROA fail-closed screening of every free-text profile field before render",
  "consumer-consent gating: managed-client profile/reputation non-public by default",
  "replacement / deletion, upload rate limits, moderation + reporting, auditability, default-avatar",
];

// Fail-closed. Profile media is NOT servable in the foundation. Flipping this on
// requires the prerequisites above plus a CCO/counsel pass and a privacy-policy amendment.
export function profileMediaEnabled(): boolean {
  return false;
}
