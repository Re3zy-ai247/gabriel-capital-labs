# A-PROVIDER-ABSTRACTION.md — CreditVector Fulfillment Platform Adapter Layer

Agent A · Architecture only · Formalizes an **existing** contract (`lib/mail/MailProvider.ts`) as the platform's adapter layer per Founder decision §1.1: "Operators never interact with LetterStream. LetterStream is infrastructure — **Provider Adapter #1** under the **CreditVector Fulfillment Platform**. Future adapters: LetterStream, Lob, PostGrid, Click2Mail (all five IDs already exist in `lib/mail/MailProvider.ts`)."

## 1. The existing contract (verbatim, path-cited)

`lib/mail/MailProvider.ts:102-114`:

```ts
export interface MailProvider {
  readonly id: MailProviderId;
  readonly name: string;
  validateAddress(address: MailAddress): Promise<AddressValidationResult>;
  estimateCost(spec: MailPieceSpec): Promise<CostEstimate>;
  createMailJob(input: CreateJobInput): Promise<CreateJobResult>;
  cancelMailJob(providerJobId: string): Promise<{ canceled: boolean; detail?: string }>;
  retrieveStatus(providerJobId: string): Promise<ProviderStatus>;
  retrieveTracking(providerJobId: string): Promise<TrackingInfo>;
  retrieveProof(providerJobId: string): Promise<ProofArtifact[]>;
  healthCheck(): Promise<HealthStatus>;
}
```

`MailProviderId = "letterstream" | "lob" | "postgrid" | "click2mail" | "postalmethods"` (`MailProvider.ts:8-9`); `DEFAULT_PROVIDER = "letterstream"` via `MAIL_PROVIDER` env, resolved once through a single registry function (`getMailProvider()`, `lib/mail/providers/index.ts:29-36`, "switching the platform's mail provider is a single config value; no business logic, UI, or Kai code changes"). **This document formalizes, it does not redesign**: every type below already exists.

Errors are provider-neutral by construction (`MailProviderErrorCode = "not_implemented" | "not_wired" | "network" | "rejected" | "not_found" | "auth"`, `MailProvider.ts:118-124`) — `MailService` "can branch without knowing which provider raised it" (comment, line 117).

## 2. LetterStream = Adapter #1 — current state, verbatim

`lib/mail/providers/LetterStreamProvider.ts`, per ADR-0011 ("Do NOT begin live API integration until the abstraction is complete"):

- **Dry-run (default, `MAIL_LIVE !== "true"`):** "pure, deterministic results — real address checks, real cost math from LetterStream's rate card, real status mapping — and NO network I/O" (comment, lines 6-8).
- **Live (`MAIL_LIVE === "true"`):** every network-touching method throws `MailProviderError("not_wired", ...)` before any HTTP call (`isLive()` read per-call, not a module constant, "stays honest under tests that toggle it", lines 22-26).
- **Rate card** (lines 50-57, USD cents): base 92¢ (1pg, B/W, first-class); +12¢/extra page; +15¢/page color; −4¢/sheet double-sided; +495¢ certified w/ return receipt; −20¢ standard class. Contained entirely inside this file — "nothing provider-specific escapes" (`MailProvider.ts:4-5`).
- **Other four providers** (`lib/mail/providers/StubProviders.ts`) are interface-conformant stubs — every method throws `not_implemented` (lines 16-18, `abstract class StubProvider`) — "nothing silently no-ops."

The four remaining `MailProviderId` values are **registered, typed, and routable today with zero code changes needed to add a real implementation** — replacing a stub's class body is the entire integration surface (comment, `StubProviders.ts:4-5`). This is the adapter layer already working as designed; nothing here proposes changing that shape.

## 3. Contract surface — per method, with the honest-contract gap called out

### 3.1 `estimateCost` — no gap

Already provider-neutral (`CostEstimate { providerCostCents, currency, breakdown }`, `MailProvider.ts:40-44`) and already composed correctly with platform pricing (`MailPricing.computePrice`, `lib/mail/MailPricing.ts:1-8`: "provider cost → + platform fee → + markup → − plan/agency discount → − coupon"; "certified/mail-class/page costs live in the PROVIDER estimate... pricing never re-adds them", line 18-19 — no double-charging).

### 3.2 `validateAddress` — ⚠️ a fabricated fact in shipped code

`LetterStreamProvider.ts:63-80`:

```ts
async validateAddress(address: MailAddress): Promise<AddressValidationResult> {
  const issues: string[] = [];
  if (!address.line1?.trim()) issues.push("Street address is required.");
  if (!address.city?.trim()) issues.push("City is required.");
  if (!/^[A-Za-z]{2}$/.test(address.state ?? "")) issues.push("State must be a 2-letter code.");
  if (!/^\d{5}(-\d{4})?$/.test(address.zip ?? "")) issues.push("ZIP must be 5 or 9 digits.");
  ...
  return {
    valid: issues.length === 0,
    deliverable: issues.length === 0 ? true : undefined,   // ← line 76: FABRICATED
    ...
  };
}
```

`deliverable: true` is asserted whenever the ZIP **regex** passes — a structural shape check, never a real USPS/CASS deliverability determination. `AddressValidationResult.deliverable` is documented as "USPS-deliverable per the provider" (`MailProvider.ts:26`) — the current code does not honor that contract; it reports certainty it does not have.

**Honest contract, PROPOSED — FOUNDER-GATE (new dependency/vendor integration):**

| Field | Honest meaning |
|---|---|
| `valid: boolean` | keep as-is — structural validity (non-empty, correctly-shaped fields) is a legitimate, honestly-labeled fact |
| `deliverable: boolean \| undefined` | **PROPOSED:** `undefined` whenever no live CASS/USPS check has run (i.e., always `undefined` in dry-run and in any mode until a real check is wired) — never inferred from the ZIP regex. `undefined` means "not determined," not "assume yes." |
| `normalized` | unchanged — only meaningful once a real CASS pass has actually standardized the address |

Activating a live CASS/USPS-verification check is **FOUNDER-GATE**: it is either a new LetterStream API call (once `MAIL_LIVE` activation itself is gated, §6) or a distinct new vendor dependency (USPS Web Tools / a CASS-certified third party) if address verification should exist independent of the mailing provider. Not decided here — flagged for the Founder.

### 3.3 `createMailJob` (submit) — no structural gap, gated by `MAIL_LIVE`

`CreateJobInput`/`CreateJobResult` (`MailProvider.ts:46-66`) are already provider-neutral; the piece is dispatched "EXACTLY as priced and paid — the spec is read from the immutable manifest, never fabricated" (`MailService.ts:165-167`). Nothing to formalize beyond what §6 covers.

### 3.4 `cancelMailJob` — no gap

Already checked against the state machine *before* calling the provider (`MailService.cancel()`, `lib/mail/MailService.ts:222-239`: "never ask a provider to cancel a piece the state machine won't let us cancel").

### 3.5 `retrieveStatus` / webhook ingestion — the contract exists, the ingestion route does not

`retrieveStatus`/`retrieveTracking` are pull-model methods (`MailProvider.ts:110-111`); `MailService.syncTracking()` (`lib/mail/MailService.ts:193-220`) already walks the manifest forward one legal step at a time from a pulled `TrackingInfo`. **No push-model (webhook) ingestion route exists today** — this is new surface, specified in §5.

### 3.6 `retrieveProof` (evidence retrieval) — contract exists, storage is undecided

`ProofArtifact { kind: "proof_of_mailing" | "return_receipt" | "delivery_scan" | "tracking_page"; url?: string; retrievedAt: string }` (`MailProvider.ts:87-91`) already anticipates the electronic return receipt Founder decision §1.3 requires — `"return_receipt"` is already a named kind. What is undecided is **where the artifact lives once fetched**. See §4.

## 4. Evidence retrieval → package evidence — artifact storage, FOUNDER-GATE

Two live options, argued against the one precedent the repository already has for storing sensitive binary artifacts server-side:

| Option | Precedent it follows | Cost |
|---|---|---|
| **(a) Pointer-only** — keep `ProofArtifact.url`, a "provider-hosted, access-controlled link; never public" (`MailProvider.ts:86`) | today's stated design intent | artifact availability depends on the provider's own retention window; if LetterStream (or a future provider) deletes/expires the URL, the evidence is gone — a real risk for a Founder-decision-mandated "Immutable Timeline" (§1.3) |
| **(b) Download + store** — fetch the artifact once, encrypt at rest, keep our own durable copy | `Document`/`Attachment`'s existing AES-256-GCM pattern (`lib/docCrypto.ts:36-48`, `encryptDocument`/`decryptDocument`; key from `DOCUMENT_ENCRYPTION_KEY`, 32-byte hex, `docCrypto.ts:11-21`) | a genuinely new decision: which key hierarchy, what retention/erasure rule, and — per `ADR-0028 §1.5`'s own admission — "`docCrypto` is single-key today, the hierarchy is net-new" if per-tenant crypto-shredding is ever wanted for erasure (the same tension `A-DOMAIN-MODEL.md` §6 flags for package erasure) |

**Not decided here — FOUNDER-GATE.** If (b) is chosen, the natural reuse (per `A-DOMAIN-MODEL.md` §2.4) is `Attachment` (`prisma/schema.prisma:374-388`) with an additive `scope = "dispute_package_evidence"` string value — no schema change, since `scope`/`refId` are already plain strings, not an enum. If (a) is chosen, `ProofArtifact.url` needs a documented minimum retention SLA per provider before Founder decision §1.3's "Immutable Timeline" can be honestly claimed, since a pointer to a vendor-expirable URL is not immutable by CreditVector's own hand.

## 5. Webhook security

No provider webhook route exists today (§3.5) — this is new surface, specified against two precedents already proven elsewhere in the codebase:

### 5.1 Signature verification — reuse the Stripe precedent

`app/api/stripe/webhook/route.ts:69-78` already does exactly this for a different vendor:

```ts
const sig = req.headers.get("stripe-signature");
if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
try { event = stripe.webhooks.constructEvent(body, sig, webhookSecret); }
catch (e) { reportError(...); return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
```

**PROPOSED:** a provider webhook route follows the identical shape — read the raw body (never parsed before verification, same "Stripe needs the raw, unparsed body" comment at `webhook/route.ts:17`), verify against a provider-specific secret (a new env var, FOUNDER-GATE — not `STRIPE_WEBHOOK_SECRET`), reject with 400 on any failure **before** touching the database. Each provider's signature scheme is contained inside that provider's adapter file (`providers/LetterStreamProvider.ts` equivalent), never leaked into the shared route — mirrors "LetterStream-specific vocabulary... is contained HERE" (`LetterStreamProvider.ts:13`).

### 5.2 Idempotent ingestion — reuse the Event Bus precedent, not a new mechanism

`lib/eventBus/envelope.ts:145-148` (`deriveEventId`):

```ts
export function deriveEventId(tenantId: string, type: string, source: string, dedupeKey: string): string {
  const h = createHash("sha256").update(`${tenantId}|${type}|${source}|${dedupeKey}`).digest("hex");
  return `evt_${h.slice(0, 32)}`;
}
```

**PROPOSED:** an inbound provider webhook computes a deterministic id the same way — `` sha256(provider|providerJobId|rawEventType|rawEventTimestampOrSeq) `` — and the ingestion route inserts via `ON CONFLICT DO NOTHING`, exactly `appendEvent()`'s pattern (`lib/eventBus/store.ts:87-107`, "a retried publish collides on the PK and returns the ORIGINAL row (`replayed:true`) — never a duplicate, never a second fanout"). This composes directly with `A-STATE-MACHINE.md` §8's claim-before-effect rule: the webhook's deterministic id is the natural **claim key material** feeding `` `${mailId}:${toStage}` `` once the payload is mapped to a canonical stage (§6 below) — a redelivered webhook produces the same claim key and hits `completed`, never re-applying `applyTransition`.

### 5.3 PII discipline on the ingested payload

Whatever of the provider's raw webhook body is persisted (for audit) must pass the same structural PII guard the Event Bus already enforces (`lib/eventBus/validate.ts:22-48`, `assertNoPII` — key-denylist + value-pattern scan). A provider webhook payload legitimately contains a mailing address (the recipient's) — this is why `AuditEntry.detail` (`lib/mail/MailAudit.ts:25`, "never secrets, never raw PII dumps") stays a short, human-written note rather than the raw payload; the raw payload, if retained at all for provider-dispute purposes, lives beside the manifest under its own access control, never inside the append-only `auditTrail` that timeline/Kai consumers read.

## 6. Provider-neutral status taxonomy → `FulfillmentStage`

`ProviderStatus.status` is already typed as `MailStatus` (`MailProvider.ts:73`) — providers map their own vocabulary in their own file, and "this enum is the only status vocabulary the rest of the platform... ever sees" (`MailStatus.ts:6-7`). LetterStream's current dry-run mapping (`LS_STATUS`, `providers/LetterStreamProvider.ts:30-42`):

| LetterStream raw | → `MailStatus` | → `FulfillmentStage` (`A-STATE-MACHINE.md` §4) |
|---|---|---|
| `received` / `queued` | `PROVIDER_ACCEPTED` | `ACCEPTED` |
| `printed` | `PRINTED` | `PRINTING` |
| `mailed` | `CARRIER_ACCEPTED` | `MAILED` *(collapses `USPS_ACCEPTED` — LetterStream's dry-run vocabulary does not distinguish them, §A-STATE-MACHINE.md §5.2)* |
| `in-transit` / `in_transit` | `IN_TRANSIT` | sub-state within `USPS_ACCEPTED`→`DELIVERED` |
| `delivered` | `DELIVERED` | `DELIVERED` |
| `returned` | `RETURNED` | `RETURNED_TO_SENDER` |
| `canceled`/`cancelled` | `CANCELED` | `CANCELED` |
| `error` | `FAILED` | `PROVIDER_ERROR` (reason code TBD from the raw payload, `A-STATE-MACHINE.md` §6) |
| *(unmapped raw string)* | `PROVIDER_ACCEPTED` (fallback, `mapLetterStreamStatus`, line 45) | **⚠️ not fail-closed** — an unrecognized LetterStream status today silently defaults to `PROVIDER_ACCEPTED` rather than refusing or flagging. This is a real gap against the Policy Engine's fail-closed law (`A-POLICY-ENGINE.md` §4.1); **PROPOSED:** an unmapped raw status should produce a distinct `UNKNOWN_PROVIDER_STATUS` `FulfillmentStage`-adjacent alarm (surfaced to the operator/ops, never silently treated as forward progress) rather than falling through to `PROVIDER_ACCEPTED`. |

Any future adapter (Lob/PostGrid/Click2Mail/PostalMethods) owns an identical private mapping table inside its own file — never a shared cross-provider `if` chain, per `MailProvider.ts:4-5`'s existing law.

## 7. Sandbox/live discipline — preserved exactly, not touched

Two independent, orthogonal flags, both fail-closed, **neither changed by this document**:

| Flag | Read | Default | Effect |
|---|---|---|---|
| `MAIL_LIVE` | per-call, not cached (`isLive()`, `LetterStreamProvider.ts:24-26`) | unset → dry-run | live mode throws `not_wired` before any network call — "even live every method throws... before any network call" (brief §2.1) |
| `MAIL_PROVIDER` | `getMailProvider()` (`providers/index.ts:29-36`) | unset → `letterstream` | an unknown value "falls back to the default rather than crashing the platform" |

Activating live mail integration is explicitly named future, separately gated work: ADR-0011 — "Live integration is a separate, gated future sprint (flip `MAIL_LIVE`, wire the LetterStream HTTP calls, pass CSO + CCO review) — never in this change." **This document's every proposal (honest `validateAddress`, webhook ingestion, evidence storage) is designed to slot in AFTER that gate, not to open it.** Nothing here requires `MAIL_LIVE` to change from its current default.

## 8. Adapter conformance test contract (PROPOSED)

Precedent: `scripts/mail.test.ts`, cited by ADR-0011 as already covering "state machine, composed pricing, append-only audit, tracking normalization, single-config provider switch, LetterStream dry-run, and the end-to-end approval-gate + identity-immutability" (38 assertions). **PROPOSED**, additive to that suite (not a replacement): every `MailProviderId` that is not a bare stub must pass an identical conformance battery before it may be selected via `MAIL_PROVIDER`:

| Conformance check | Asserts |
|---|---|
| Interface completeness | every `MailProvider` method is implemented (not inherited from `StubProvider`) |
| Dry-run/live symmetry | `isLive() === false` produces deterministic, network-free results for every method; `isLive() === true` either performs a real call or throws `not_wired` — never a silent no-op |
| Status mapping totality | every raw status string the adapter's own fixtures enumerate maps to a known `MailStatus`; no fallback to a "forward progress" status for an unrecognized raw value (closes the gap named in §6) |
| Rate card containment | no test outside the adapter's own file asserts a specific dollar amount from that provider — pricing tests exercise `MailPricing` against a provider-agnostic `CostEstimate` fixture, never a hardcoded vendor rate |
| Error code fidelity | every thrown `MailProviderError` uses one of the six defined `MailProviderErrorCode` values, never a bare `Error` |
| No vendor leakage | the adapter's public method return values never place the provider's own status string, error message, or vendor name into a field that reaches an operator-facing route without translation (§9) |

## 9. Never let vendor names/statuses leak to operator-facing surfaces (Founder §1.1)

Audited today:

| Surface | Vendor exposure? | Finding |
|---|---|---|
| `app/mail/page.tsx:107` | none | renders `"CreditVector Mail · {MAIL_STATUS_LABEL[status]}"` — the platform's own name and the canonical label, never `"letterstream"` or a raw provider string |
| `app/mail/send/[letterId]/page.tsx` (Receipt component) | none | renders manifest id, recipient, print spec, mail status label, audit count — the JSON response's `manifest.provider` field (`app/api/mail/[mailId]/route.ts:11-14`) is fetched but **not rendered** anywhere in the component |
| `MailReceipt.provider` | ⚠️ **present in the API response, not in rendered copy** | `lib/mail/MailReceipt.ts:11` types `provider: string; // provider id, shown for transparency` and `buildReceipt()` (line 28) sets it to the raw `m.provider` (e.g. `"letterstream"`). No current UI renders this field, but any client with devtools open sees it in the `GET /api/mail/[mailId]` and receipt JSON. **PROPOSED:** a provider-neutral response DTO (stripping `provider` or replacing it with a fixed `"CreditVector Fulfillment"` string) should sit between `MailManifest`/`MailReceipt` and any API route response, so Founder decision §1.1 is enforced at the response boundary, not left to "no current page happens to render it." |
| `MAIL_STATUS_LABEL` (`MailStatus.ts:88-105`) | none | "Human, outcome-neutral labels" — already provider-neutral by construction |
| Audit trail `detail` strings | ⚠️ minor | `LetterStreamProvider`'s dry-run `createMailJob` embeds `` `Accepted by ${this.provider.name}` `` via `MailService.dispatch()` (`MailService.ts:186`, `detail: \`Accepted by ${this.provider.name}\``) — `this.provider.name` is `"LetterStream"` (`LetterStreamProvider.ts:61`). This string lands in the append-only `auditTrail`, which **is** shown to the operator (`app/mail/send/[letterId]/page.tsx`'s Receipt renders `manifest.auditTrail`, though today's `dispatch()` path has zero callers so this specific entry has never actually been produced in production — see `A-STATE-MACHINE.md` §1). **PROPOSED:** the audit `detail` for a `PROVIDER_ACCEPTED` transition should read `"Accepted for fulfillment"` (or similar platform-neutral phrasing), never the adapter's own `name`, once `dispatch()` gains a caller. |

Net finding: the *architecture* already keeps vendor identity out of the canonical types (`MailStatus`, `MAIL_STATUS_LABEL`) that reach the UI — the two leaks found are both **narrow, concrete, and only latent** (one unrendered API field, one audit-string template that has never fired in production). Both are flagged for Agent E rather than fixed here (no product code changes per the brief's hard boundaries).
