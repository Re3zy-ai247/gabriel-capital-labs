# A-POLICY-ENGINE.md — Fulfillment Policy Engine

Agent A · Architecture only · **PROPOSED** module, zero lines written · Founder decision §1.5: "a deterministic subsystem owning: delivery policy, certified-mail enforcement, return-receipt policy, provider eligibility, wallet-authorization requirements, retry rules, idempotency, duplicate prevention, provider routing. **Kai never decides these.**"

## 1. Precedent — this is not a new idiom, it is the fourth instance of one

The repository already has three pure, deterministic decision modules with the exact shape the Fulfillment Policy Engine needs. This spec follows them, not a new pattern:

| Precedent | Path | What it proves |
|---|---|---|
| "zero AI, zero network" deterministic projection | `lib/mailCenter.ts:1-9` | a whole customer-facing surface can be pure, DB-read-only, no AI, no network |
| Versioned policy, env-overridable, fail-safe fallback | `lib/campaign/CampaignPolicy.ts:11-58` | `resolveCampaignPolicy()`: JSON env override, invariant-checked, falls back to the default on ANY malformed override rather than throwing; `version` stamped into every frozen snapshot so a policy change is a visible audit fact, never a silent behavior change |
| Category-labeled verdicts | `lib/campaign/CampaignPolicy.ts:60-103` | `assessCampaignSize()` returns a `verdict` + `messages[]`, each message explicitly labeled non-legal ("This is CreditVector's guidance, not a legal limit") — the same category discipline `CampaignModel.ts:99-111`'s `WarningCategory` (`law \| policy \| recommendation`) formalizes |
| "Pure orchestration... no AI, no predictions" | `lib/execution/ExecutionEngine.ts:1-16` | `assembleExecution` "is pure (no DB) so the whole thing is unit-testable and 100% reproducible"; consumes only what other engines already produced, invents nothing |
| Deterministic recommendation with a `basis` receipt | `lib/kaiHome.ts` (`pickRecommendation`, ~line 63; every branch sets `basis: string`, e.g. line 80, 92, 122, 133, 146) | "the receipt — which rule fired, in plain English" — every decision traces to a named rule, never a vibe |
| Fail-closed on unknowns | `lib/stripe.ts:201-217` (`planForPrice`) | "an unrecognized price returns null rather than [a guessed tier]... FAILS CLOSED" |
| 3-state idempotent claim | `lib/billing.ts:139-197` (`claimStripeEvent`) | `claimed \| completed \| in_flight` — see `A-STATE-MACHINE.md` §8 for the mail-transition mapping |

The Fulfillment Policy Engine is `CampaignPolicy.ts` + `pickRecommendation`'s `basis` law + `planForPrice`'s fail-closed law, applied to fulfillment decisions instead of campaign sizing / next-action / billing.

## 2. Typed inputs (PROPOSED)

```ts
// PROPOSED — lib/fulfillment/PolicyEngine.ts (illustrative path; not created)
interface PolicyInput {
  package: {
    packageId: string;
    round: number;
    letterCount: number;
    recipientTypes: ("bureau" | "furnisher" | "collector")[]; // from Letter.recipientType, prisma/schema.prisma:252
  };
  addresses: {
    sender: MailAddress | null;      // lib/mailExecution.ts:54-64, senderMailAddress() — null when incomplete
    recipients: MailAddress[];       // one per letter; bureauMailAddress/furnisherMailAddress, lib/mailExecution.ts:34-49
  };
  wallet: {
    // Boundary only — Agent C owns the shape. Named here so the engine's
    // "wallet-authorization requirement" decision (§3) has something typed to
    // consult. Never confused with the OTHER four instruments (ADR-0038 PGE-4:
    // Reputation/XP, Business Health, Affiliate commissions, Promotional
    // credits are separate, non-convertible ledgers — a wallet check here reads
    // ONLY the cash/fulfillment-funding instrument).
    hasSufficientAuthorization: boolean | null; // null = wallet not yet consulted
  };
  providerHealth: Record<MailProviderId, HealthStatus>; // lib/mail/MailProvider.ts:93-97, per-provider healthCheck()
  plan: { tier: PlanTier; isAgency: boolean };            // lib/mail/MailPricing.ts:11
  priorAttempts: {
    mailId: string;
    stage: FulfillmentStage;                              // A-STATE-MACHINE.md §4
    reasonCode?: "address_invalid" | "provider_rejected" | "network" | "returned_undeliverable" | "payment_void"; // A-STATE-MACHINE.md §6
    at: string;
  }[];
}
```

Every field is either already-computed data (never a live network/AI call inside the engine) or a boundary type owned by another subsystem (wallet, provider health) that the engine only *reads*.

## 3. Typed decisions (PROPOSED)

```ts
interface PolicyDecision {
  delivery: {
    // Founder §1.3: certified + tracking + electronic return receipt + delivery
    // evidence + immutable timeline, ALWAYS. This is not computed — it is a
    // constant the engine returns unconditionally. See §6 conflict callout.
    certified: true;
    trackingRequired: true;
    returnReceiptRequired: true;
    basis: "founder_decision_1_3";
  };
  providerRouting: {
    eligible: MailProviderId[];      // filtered by providerHealth + not_implemented/not_wired status
    chosen: MailProviderId | null;   // deterministic tie-break, see §3.1
    basis: string;                   // "which rule fired" — pickRecommendation idiom
  };
  walletAuthorization: {
    required: true;                  // always required to leave WALLET_AUTHORIZED (A-STATE-MACHINE.md §5.1)
    amountCents: number;             // from the rate model (MailPricing.computePrice, lib/mail/MailPricing.ts:69-109) — the engine calls this, never invents a number
    basis: string;
  };
  retrySchedule: {
    allowed: boolean;
    nextAttemptAt: string | null;    // ISO, bounded exponential — see §3.2
    attemptsRemaining: number;
    basis: string;
  };
  duplicatePrevention: {
    verdict: "clean" | "duplicate_detected" | "in_flight";  // 3-state claim result, A-STATE-MACHINE.md §8
    claimKey: string;                 // `${mailId}:${toStage}` — stable business subject, never a per-emission id
    basis: string;
  };
  refusal: { refused: boolean; reason: string | null; };    // fail-closed exit — see §4
}
```

### 3.1 Provider eligibility + routing, deterministic tie-break

1. Filter to providers whose `MailProvider.healthCheck()` (`lib/mail/MailProvider.ts:113`) reports `healthy: true` **and** whose id is not currently `not_implemented` (the four stubs, `lib/mail/providers/StubProviders.ts:16-18`, always throw and are never eligible until a real implementation replaces the stub body).
2. Among eligible providers, tie-break by a fixed, published priority list (config, not inferred) — today that list has exactly one entry (`DEFAULT_PROVIDER = "letterstream"`, `lib/mail/providers/index.ts:20`), so routing is a no-op until a second live provider exists. The engine's job is to make this an explicit, auditable rule (`basis: "sole eligible provider: letterstream"`) rather than the implicit single-branch registry lookup it is today (`getMailProvider()`, `lib/mail/providers/index.ts:29-36`).
3. **Fail-closed:** zero eligible providers → `refusal.refused = true`, `reason: "no eligible provider"` — never silently falls back to a provider that is `not_wired`/`not_implemented` (both already throw `MailProviderError`, `lib/mail/MailProvider.ts:118-124`; the engine's job is to never let the flow reach that throw in the first place when it is foreseeable ahead of time).

### 3.2 Retry schedule

Bounded, exponential, keyed on the manifest's own idempotency identity (`MailManifest.mailId`, `lib/mail/MailManifest.ts:15`) — never unbounded, per the Room Constitution's forbidden-patterns law (brief §2.6, "no fabricated telemetry/progress"): a piece stuck after the schedule is exhausted must read as stuck, not as silently-still-trying. Reuses the `priorAttempts` input (§2) rather than a separate retry-count column — the count is derived from the audit trail (`AuditEntry[]` filtered by `reasonCode`, `A-STATE-MACHINE.md` §6), never stored twice.

### 3.3 Duplicate-prevention verdicts

Consumes, does not implement, the 3-state claim mechanism specified in `A-STATE-MACHINE.md` §8 (`claimed | completed | in_flight`, modeled on `claimStripeEvent()`, `lib/billing.ts:174-197`). The engine's contribution is the **claim key discipline**: always a stable business subject (`` `${mailId}:${toStage}` ``), never a per-emission id — the same law ADR-0028 states and `XpAward.@@unique([subjectId, operatorId, awardKind])` (`prisma/schema.prisma:784`) already enforces for reputation. A policy engine that keyed duplicate-prevention on, say, a webhook delivery id instead of the manifest+stage would double-process every redelivery — the exact bug ADR-0028 §3 names ("a naive framing... is fatal").

## 4. Laws

1. **Fail-closed on unknowns** — mirrors `planForPrice()` (`lib/stripe.ts:201-217`, "FAILS CLOSED: a price we do not recognize... returns null, never a guessed tier"). An unrecognized provider status, an unmapped reason code, a wallet state the engine doesn't understand → `refusal.refused = true`, never a best-guess `chosen`/`allowed`. No branch of this engine may return a decision by falling through to a default that *looks* permissive.
2. **No policy decision ever originates from Kai or client input.** Every field in `PolicyInput` (§2) is either server-resolved data or another subsystem's already-computed state — never a request body value, never a Kai-generated suggestion. This mirrors `PublishIdentity`'s construction rule in the Event Bus ("resolved SERVER-SIDE... never client input", `lib/eventBus/envelope.ts:89-91`) and `MailService.approve()`'s "a user — never Kai — approves" law (`lib/mail/MailService.ts:125`), extended from "who approves" to "who decides policy."
3. **Every decision carries a `basis`.** Same idiom as `pickRecommendation` (`lib/kaiHome.ts`, "the receipt — which rule fired, in plain English") and `CampaignPolicy.assessCampaignSize()`'s category-labeled `messages[]`. A decision with no `basis` is not a valid `PolicyDecision` — this should be enforced at the type level (`basis: string`, non-optional, on every decision sub-object in §3), not left to convention.
4. **Certified mail is not a policy computation — it is a constant.** Founder §1.3 leaves no conditional path ("Dispute Packages always use..."). The engine returns `delivery.certified: true` unconditionally; there is no input combination that produces `false`. See §6 for why this law is *already violated* in shipped code.
5. **The engine never calls a provider or the network.** All provider-facing calls (`estimateCost`, `createMailJob`, `validateAddress`) remain `MailService`'s job (`lib/mail/MailService.ts`); the Policy Engine only *decides whether MailService should*, using already-fetched `providerHealth` (§2) — same separation `lib/mailCenter.ts` draws between deciding what to show and `MailService` doing the showing.
6. **No policy decision is Kai-narrated inline.** The engine returns typed decisions with a machine `basis`; turning that into operator-facing prose is Kai's job (Agent D), strictly downstream, never the reverse (Kai's narration must never *become* an input the engine consults — that would let Kai indirectly decide policy through its own explanation).

## 5. Where it runs

**Server-side only**, invoked from route handlers, never from a client component (the same `"use client"` / prisma-import split `CLAUDE.md`'s gotcha #2 already enforces platform-wide). Consulting routes, present and future:

| Route | Today | With the Policy Engine |
|---|---|---|
| `POST /api/mail/prepare` | hardcodes `certified: false` (`app/api/mail/prepare/route.ts:46`) — see §6 | consults `delivery` decision for the spec, `providerRouting` for provider selection |
| `POST /api/mail/[mailId]/approve` | no policy consulted | no change needed — approval is a user action, not a policy decision |
| `POST /api/mail/[mailId]/confirm` | calls `markPaid`/`queueForProvider` unconditionally once `APPROVED`/`PAID` (`app/api/mail/[mailId]/confirm/route.ts:53-56`) | consults `walletAuthorization` (amount + required) before `markPaid`, `duplicatePrevention` before `queueForProvider` |
| future `POST /api/mail/[mailId]/dispatch` (today: zero callers, `MailService.dispatch()`) | N/A | consults `providerRouting`, `retrySchedule` on failure |
| future provider webhook ingestion route | does not exist yet | consults `duplicatePrevention` (claim-before-effect, `A-STATE-MACHINE.md` §8) before applying any transition |

## 6. ⚠️ Conflict callout — the engine's first law is already violated in shipped code

`app/api/mail/prepare/route.ts:46`:

```ts
const spec: MailPieceSpec = {
  pages: estimatePages(body), color: false, doubleSided: true, mailClass: "first_class", certified: false,
};
```

This directly contradicts Founder decision §1.3. It is reported here because the Policy Engine (§4 law 4) is precisely the subsystem meant to make this impossible to get wrong again — once `prepare/route.ts` consults `PolicyEngine.decide(...).delivery.certified` instead of hardcoding a literal, the value can never again silently diverge from the Founder's decision. **This document does not fix the code** (architecture-only, no product changes per the brief's hard boundaries §5) — it is reported for Agent E and the Founder to act on.

## 7. Guard strategy

Two layers, mirroring the two guard types the repository already runs (`scripts/runtime/` precedent + `lib/mail/`'s own test evidence):

1. **Static** — `npm run typecheck` (every `PolicyInput`/`PolicyDecision` field typed, no `any`); the fail-closed law (§4.1) is partly enforceable at the type level by making `chosen`/`amountCents`/`nextAttemptAt` etc. nullable and forcing every call site to handle the null/refused branch explicitly (no silent `!` non-null assertions).
2. **Executing** — a guard script in the shape of `scripts/mail.test.ts` (cited by ADR-0011 as "38 assertions: state machine, composed pricing, append-only audit... single-config provider switch, LetterStream dry-run, and the end-to-end approval-gate + identity-immutability"). **PROPOSED** `scripts/fulfillmentPolicy.test.ts` asserting, at minimum: certified is always `true` regardless of input (law 4); an unrecognized provider health/status never produces a `chosen` provider (law 1); every decision object has a non-empty `basis` (law 3); a `PolicyInput` built from client-suppliable fields never appears in a `PolicyDecision` unchanged (law 2 — i.e., no pass-through fields); the retry schedule is monotonically bounded (never returns `attemptsRemaining > ` the configured ceiling); the duplicate-prevention claim key is always `` `${mailId}:${toStage}` ``, never a bare event id.

Both layers run **before** any route wiring — the engine is unit-testable with zero DB and zero network, same discipline as `MailService`'s and `CampaignService`'s injectable `store`/`clock`/`sink` (`lib/mail/MailService.ts:73-78`, `lib/campaign/CampaignService.ts:58-63`).
