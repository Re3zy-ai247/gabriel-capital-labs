# ADR-0011: CreditVector Mail — provider-abstract mailing platform

Status: Accepted (architecture; live integration deferred)
Date: 2026-07-13
Decision owners: Founder directive (Sprint VIII)

## Context
Mailing dispute letters is core to the product, but a direct integration with any
one mailing vendor (LetterStream) would hardcode a vendor into business logic and
make switching costly. The founder directive: CreditVector *owns* the mailing
experience; providers are interchangeable infrastructure; every mailed piece
becomes a durable, append-only entry in the customer's Case Timeline (a
process record of what was mailed and when). Build the abstraction first; implement LetterStream as
Provider #1; do NOT begin live API integration until the abstraction is complete.

## Decision
A new module `lib/mail/` with a provider-agnostic core and a pluggable provider
layer:
- **`MailProvider`** — the abstract interface every provider implements
  (validate/estimate/create/cancel/track/status/proof/health). Callers depend
  only on these neutral types; provider vocabulary (status strings, rate cards)
  is contained inside each provider.
- **`MailStatus`** — one canonical lifecycle state machine
  (GENERATED→…→DELIVERED→RESPONSE_RECEIVED→CLOSED, plus CANCELED/FAILED/RETURNED)
  with guarded transitions.
- **`MailService`** — the single orchestration surface. Enforces the two
  invariants: (1) **Kai never sends** — Kai recommends, a *user* approves, and
  `dispatch` refuses unless the piece is PAID (only reachable via a user APPROVED
  transition); (2) the **manifest identity is write-once + the audit trail append-only** (store-enforced).
- **`MailPricing`** — composed, never hardcoded (provider cost → platform fee →
  markup → plan/agency discount → coupon), policy supplied as data.
- **`MailManifest` / `MailAudit`** — the record + append-only process log;
  identity fields write-once AND the audit trail append-only, both enforced in
  `MailStore.saveProgress` (assertAppendOnly), not merely by convention.
- **Provider registry** — switching providers is one config value
  (`MAIL_PROVIDER`); no business/UI/Kai change.
- **LetterStreamProvider** = Provider #1, running dry-run (real validation/cost/
  status logic, **no network**); Lob/PostGrid/Click2Mail/PostalMethods are
  interface-conformant stubs. Live network calls are gated behind `MAIL_LIVE` and
  currently throw `not_wired` rather than silently no-op.

## Alternatives considered
- **Direct LetterStream SDK in the letter routes** — rejected: hardcodes a vendor,
  no clean switch, no append-only process ledger.
- **Emit live API calls now** — rejected per directive: abstraction must be
  complete and reviewed before any vendor traffic.
- **Store manifests as freeform JSON blobs** — rejected: the audit trail needs
  structure + append-only guarantees to serve as evidence.

## Consequences
- Mailing is now a permanent platform capability with a stable internal contract.
- The existing dispute flow, Kai, and UI are UNCHANGED this sprint — the module is
  built but not yet wired into the "Mark mailed" flow (a later wiring sprint) so
  nothing user-facing shifts.
- `MailManifest` is a self-heal table (ADR-0001). `KaiEventType` gains `mail.status`
  (additive; unknown-type consumers ignore it).

## Security implications
- No secrets in any prompt or log; provider credentials will be SDK/config args
  only when live integration lands (a future CSO-reviewed change).
- `MailStore.saveProgress` never lists identity columns in its UPDATE and calls
  assertAppendOnly on the trail (with an optimistic audit-length guard) — the
  record cannot be rewritten or an entry silently dropped through the normal path.
- PDF bytes are never logged; provider-hosted proof URLs are access-controlled.

## Compliance implications
- Status labels are outcome-neutral facts ("Delivered", never a dispute result) —
  the CROA bar holds; Kai recommends and explains process/timeline, never outcomes.
- The append-only audit trail is the process-record asset — it records what
  happened, and asserts nothing about what a bureau will do. It is not marketed as
  court-grade or consumer-facing evidence without a CCO sign-off.

## Migration or rollback plan
- Additive and inert until wired: no route calls `MailService` yet, so shipping is
  zero-risk. Rollback = delete `lib/mail/` (nothing depends on it).
- Live integration is a separate, gated future sprint (flip `MAIL_LIVE`, wire the
  LetterStream HTTP calls, pass CSO + CCO review) — never in this change.

## Evidence
- Guard `scripts/mail.test.ts` (38 assertions): state machine, composed pricing,
  append-only audit, tracking normalization, single-config provider switch,
  LetterStream dry-run, and the end-to-end approval-gate + identity-immutability.
- Rule of Two: everything lives in CreditVector; the clean seams (provider
  interface, injectable store/clock/sink) are extraction *preparation* only —
  nothing is extracted to GIOS until a committed product #2 (ADR-0009 / G-PLAT-2).
