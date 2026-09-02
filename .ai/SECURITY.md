# Security (canonical)

Verified controls only; anything unverified is labeled. Full history in git + `ARCHIVE/CLAUDE-md-2026-06-30-original.md`.

## Encryption at rest (VERIFIED — ADR-0002)
AES-256-GCM via `lib/docCrypto.ts`, key `DOCUMENT_ENCRYPTION_KEY`. Applied to:
- Identity `Document` bytes and `Attachment` bytes (support/community/letters uploads)
- `Report.rawText` (2026-06-18) · `Letter.body`, `Letter.responseText`, `Letter.responseAnalysis` (2026-06-30, G-11/G-13)
- Dual-read of legacy plaintext everywhere; one-time backfills: `/api/admin/encrypt-reports`, `/api/admin/encrypt-letters` (run status: NEEDS CONFIRMATION — see `CURRENT-STATE.md`).
**Rule:** any new file/PII feature reuses this pattern — encrypt at rest, serve only through an ownership/membership-checked route, no public URLs.

## File serving hardening (VERIFIED, re-reviewed clean 2026-06-30)
`/api/attachments/[id]` + `/api/documents/[id]/raw`: authorization (incl. community parent-existence) BEFORE decryption; `X-Content-Type-Options: nosniff`, sandbox CSP, `X-Frame-Options: DENY`; `validateFiles` sniffs magic bytes vs declared MIME (images+PDF, 10MB/file, 5/post); orphaned attachments swept on thread/reply delete.

## Prompt-injection defenses (VERIFIED — ADR-0005)
- **No secret/env var is ever interpolated into ANY AI prompt** — keys are SDK constructor args only. Every AI surface must keep this true: `lib/kai.ts`, `lib/aiParse.ts`, `lib/letter.ts`, `lib/round2.ts`, `lib/brief.ts`, `lib/briefIngest.ts`, `app/api/strategist/plan`, `app/api/identity/*`.
- Kai is the only AI surface fed untrusted multi-user input: absolute SECURITY & SCOPE block, forum content fenced in BEGIN/END markers labeled UNTRUSTED, `sanitizeForPrompt()` caps length + strips fence-spoofing. Guard: `scripts/kai-sanitize.test.ts`. Kai has no tools/DB/secrets → cannot exfiltrate.
- Brief ingest SSRF guards: full-body fetch restricted to feed hosts (consumerfinance.gov/ftc.gov); PDF fetch trusted-host-only, 15MB cap; YouTube parser host-allowlisted, rejects lookalike hosts and `javascript:`/`data:` schemes.
- AI markdown renders through `components/Markdown.tsx` (dependency-free, XSS-safe).

## Auth & access control (VERIFIED)
NextAuth JWT credentials; sessions resolve by user id. Admin authority is resolved from the current user id; the legacy human-triggerable schema migration API is removed and pinned absent by `scripts/admin-migrate-security.test.ts`. Email change requires current-password confirmation. Stripe webhook signature-verified; events deduped on `event.id`. Password reset: sha256-hashed single-use 1h tokens, rate-limited, anti-enumeration.

## Rate limiting (VERIFIED)
DB-backed `RateHit` limiter (`lib/rateLimit.ts`, **fails open**) on: register, ask-kai, strategist, letters generate, support, community reports, brief comments (15/hr), brief reactions (200/hr), letters/[id]/response (20/hr), forgot-password.

## Go-live posture
2026-06-17 audit GREEN across 6 dimensions; prod probes: public 200, protected APIs 401/403, admin 403, unsigned webhook 400. Re-probe pattern in `TESTING.md`.

## Not implemented / unverified
- No CSP on HTML pages beyond the attachment sandbox (Status: INFERRED — not audited).
- No 2FA. No formal pen test or security certification — never claim one.
