# ADR-0002: AES-256-GCM field-level encryption at rest with dual-read

Status: Accepted (rolled out 2026-06-17 → 2026-06-30; recorded retroactively 2026-07-12)
Date: 2026-07-12 (recorded)
Decision owners: Owner + Claude Code sessions

## Context
The platform stores highly sensitive consumer data: credit-report raw text, dispute-letter bodies, bureau responses, identity documents, and uploaded attachments. A single symmetric key (`DOCUMENT_ENCRYPTION_KEY`) already protected documents; security reviews (G-03 follow-ups, G-11/G-13) surfaced remaining plaintext-at-rest gaps.

## Decision
One shared scheme in `lib/docCrypto.ts`: AES-256-GCM, key from `DOCUMENT_ENCRYPTION_KEY`; text fields serialize IV+tag+ciphertext into a single string (`encryptText`/`decryptText`). Encrypt at every write; decrypt at every read; **dual-read of legacy plaintext** so no schema change or downtime is needed; one-time admin backfill routes (`/api/admin/encrypt-reports`, `/api/admin/encrypt-letters`) encrypt pre-existing rows idempotently. Covered: `Document`, `Attachment` bytes; `Report.rawText`; `Letter.body`/`responseText`/`responseAnalysis`.

## Alternatives considered
Database-level TDE (not available/verifiable through Accelerate) · per-field keys (operational complexity without a threat-model win at this stage).

## Consequences
Any new PII field/file feature MUST reuse this scheme + auth'd-stream serving. Reads must decrypt before use (incl. prompt assembly in `round2`, print/PDF server component). Key loss = data loss; key rotation is not implemented (NEEDS CONFIRMATION if ever required).

## Security implications
Clients always receive plaintext over authenticated routes only; bytes never public.

## Compliance implications
Supports data-protection posture; never claim a certification from it.

## Migration or rollback plan
Dual-read makes rollout/rollback safe; backfills idempotent.

## Evidence
`lib/docCrypto.ts` (ALGO `aes-256-gcm`), `lib/attachments.ts`, letter routes (`decryptedLetter` helper), CLAUDE.md 06-18/06-30 status (archived), crypto round-trip/tamper tests run 2026-06-18.
