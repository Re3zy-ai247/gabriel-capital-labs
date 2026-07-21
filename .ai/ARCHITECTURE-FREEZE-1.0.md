# CreditVector — Architecture Freeze 1.0

**Whole-platform, repository-grounded, adversarially-verified review before the Gate D production schema baseline.** Authored 2026-07-21 against `main` @ `6c76454` (Sprint 9 + Sprint 10 merged, dormant). This is a **review artifact**, not a new source of truth: where it assesses an owned subject it cross-references the owning canon (`GIOS-PLATFORM.md`, `PLATFORM-OWNERSHIP-MAP.md`, `VECTOR-XP.md`, `OPERATOR-IDENTITY.md`, the ADRs) rather than restating it.

---

## 0. Decisions (up front)

| Decision | Verdict |
|---|---|
| **Platform v1 freeze** | **B — FREEZE AFTER LISTED CORRECTIONS.** The architecture is fundamentally sound: no foundational model requires redesign. A bounded, enumerated set of corrections (documentation now; a sequenced pre-activation implementation list) must land within the frozen ownership/dependency model — no sideways feature expansion before them. |
| **Gate D (production migration)** | **APPROVE AFTER LISTED PRECONDITIONS.** The migration chain is additive, dependency-correct, and dormant-safe. The one execution blocker the review found — a missing `migrate resolve --applied 0_init` baseline step — has been **fixed in the runbook this session**. Remaining preconditions are operational (backup, direct connection, the §6.3 state probe + §6.4 baseline, CREATE-privilege check, owner authorization). |

**How the review was produced.** 11 principal-architect reviewer agents (one per phase) read the actual repository and returned evidence-grounded findings; every BLOCKER/HIGH/MEDIUM finding was then handed to an independent **adversarial verifier** instructed to refute it against the code (refute-by-default). 67 agents, 0 errors. **The severities in this report are the post-verification severities**, not the reviewers' initial claims.

**Headline result.** After adversarial verification, **zero BLOCKER and zero HIGH architecture findings survived at their original severity.** The three loudest initial findings were **refuted against the code**:
- Security "BLOCKER — frozen schema cannot execute its own erasure strategy" → **REFUTED to INFO**: erasure is crypto-shred/tombstone *in place* (the repo's established pattern — `eventBus/store.ts`, `sessionStore.ts`); the append-only ledger's `RESTRICT` FK is the *intended* guard against silent cascade erasure, documented verbatim in `schema.prisma:769-772`. No schema change needed.
- Collaboration "HIGH — agency-private attachment leak" → **REFUTED to INFO**: the audience predicate is already landed (`lib/community/attachmentAuthz.ts` → `canViewChannel` → `canAccessAgencyChannel`, fail-closed); the route authorizes on it, not on `canAccessCommunity` (0 grep hits). The network-attachment path the finding worried about does not exist yet.
- Knowledge "MEDIUM — Kai doesn't consume its reasoning trace" → **DROPPED**: rested on a fabricated "Principle 18" that appears nowhere in the repo; the live trace *is* rendered (`app/api/intelligence/route.ts`, `app/dashboard/page.tsx`).

The single highest surviving item is the **Gate D runbook baseline omission (BLOCKER→HIGH), fixed this session in documentation.** Everything else is MEDIUM or below.

---

## 1. Verified repository & production truth

| Fact | Verified value |
|---|---|
| `main` HEAD | `6c76454` (docs: Gate D) — local == `origin/main`, clean tree (untracked: `.agents/`, `.claude/skills/`, `skills-lock.json` — tooling only) |
| History | `e233ca4` → `f690373` (Sprint 9 Operator Identity) → `cf0d95a` (Sprint 10 Operator Reputation) → `6c76454` (Gate D docs) |
| Build command (`vercel.json`) | `prisma generate && next build` — **no DB mutation in build** (the destructive `db push` was removed 2026-07-20) |
| Production deploy | `cf0d95a` code live & healthy; `/ /pricing /login /community` → 200; `/arena` → 307 (flag-gated); `/operator` `/reputation` → 404 |
| Feature flags | All five fail-closed (`=== "true"`) and **absent from prod env** → OFF: `OPERATOR_IDENTITY_ENABLED`, `OPERATOR_REPUTATION_ENABLED`, `OPERATOR_NETWORK_ENABLED`, `EVENT_BUS_ENABLED`, `ARENA_ENABLED` |
| HTTP surface | `lib/identity` + `lib/reputation` have **zero** app-route importers. `lib/network` + `lib/eventBus` have dormant flag-gated routes |
| Migrations in repo | 6: `0_init` → `operator_network_messages` → `event_bus` → `event_bus_agency_index` → `operator_identity` → `operator_reputation` — **0 destructive statements across all six** |
| Production migration state | **No `_prisma_migrations` history in production.** The `migrate resolve --applied 0_init` baseline was performed on the **isolated PREVIEW DB only** (CURRENT-STATE Sprint 7/8). The v0.8.0 tables exist physically, unrecorded. |
| Schema | 34 Prisma models, 11 enums. `prisma validate` OK. |

---

## 2. Canonical documents treated as authoritative

`GIOS-PLATFORM.md` (frozen platform constitution, ADR-0034) · `PLATFORM-OWNERSHIP-MAP.md` (one-owner registry) · `CONSTITUTION.md` · `VECTOR-XP.md` (Reputation architecture) · `OPERATOR-IDENTITY.md` · `PERFORMANCE-INTELLIGENCE.md` · `CREDITVECTOR-ECONOMY.md` / `ADR-0037` / `ADR-0038` (economy law) · `ADR-0035` / `ADR-0036` (Event Fabric) · `CURRENT-STATE.md` (live snapshot) · the Sprint 9/10 release records · the Gate D runbook. Repository code + migrations + production behaviour override all of them on conflict.

---

## 3. Contradiction register (Phase 1)

Precedence used: **production > repository code > schema > migration > doc.** All items post-verification.

| # | Contradiction | Sources | Sev | Resolution |
|---|---|---|---|---|
| C1 | Live-snapshot carries stale/overlapping production SHAs (`cf0d95a` top banner vs `291899b` vs repeated `f1e26b0` "production unchanged" history) and reads as a chronological log | `CURRENT-STATE.md:3,5,12–24` vs git (`6c76454`) | MED | Top banner corrected this session to `6c76454` + freeze status; the `f1e26b0`/`291899b` lines are explicitly-superseded history (newest-wins is stated). Deeper prune deferred (not a freeze blocker). |
| C2 | `app/identity` + `app/api/identity` (credit-report discrepancy feature) collide by name with `lib/identity` (Operator Identity); undocumented | code vs docs | LOW | Documented in this report (§5, §6) + ownership-map note. Operator Identity will need a distinct route namespace (e.g. `/operator`) at activation. |
| C3 | A `sourceEventId` idempotency key is referenced where the schema + VECTOR-XP §6 use `UNIQUE(subjectId, operatorId, awardKind)` | `CURRENT-STATE.md:18` / older doc vs `schema.prisma` XpAward | LOW | Schema is authoritative (version-free subject was the Sprint-10 adversarial fix). Doc line is stale; superseded by VECTOR-XP §6. |
| C4 | `ARCHITECTURE.md` reports a stale model count and frames self-heal as the path for new tables | `ARCHITECTURE.md` vs `CLAUDE.md` gotcha #1 (migration-first) | LOW | Migration-first is authoritative. Flagged for a doc correction (see §16, code-adjacent — not made this session). |
| C5 | ADR sequence gap (0029, 0030 absent) only partially explained | `.ai/ADR/` | LOW | Informational; confirm the two numbers were never issued vs archived. |
| C6 | `OPERATOR-IDENTITY.md` header status lags its body (PROPOSED vs FOUNDATION BUILT) | doc header vs body vs code (built, dormant) | LOW | Code is authoritative (built, dormant). Header correction flagged (§16). |

No contradiction rises to a freeze or Gate D blocker.

---

## 4. Platform topology & status map (Phase 2)

Every capability classified from code evidence (not doc mentions). Full list:

| Capability | Status | Evidence |
|---|---|---|
| Authentication | ACTIVE | `lib/auth.ts` NextAuth credentials + rate-limit |
| Session / principal | ACTIVE | `lib/session.ts` `currentAccount()`/`currentUser()` |
| Operator Identity | DORMANT_IMPLEMENTED | `lib/identity/*` + `OperatorIdentity`; flag OFF; **0 HTTP surface** |
| Organizations | DORMANT_IMPLEMENTED | `Organization` model + `lib/identity/repository` |
| Membership | DORMANT_IMPLEMENTED | `OrganizationMembership` + service membership ops |
| Org RBAC map | DORMANT_IMPLEMENTED | `lib/identity/rbac.ts` — a *map*, enforces nothing itself |
| RBAC (live) | LEGACY_ACTIVE | binary `User.role {USER,ADMIN}` + `requireAdmin` |
| Policy Enforcement Point | RESERVED_SEAM | `lib/os/kernel/pep.ts` `authorize()` — invoked by **no** app route (live enforcement is scattered) |
| Profiles (public) | PROPOSED | no surface; only reserved media scope |
| Attachment/media boundary | ACTIVE | `lib/attachments.ts` + `Attachment` + `/api/attachments/[id]` (magic-byte, encrypted) |
| Operator profile media | RESERVED_SEAM | `lib/identity/profileMedia.ts` `=>false`; 11-item prerequisite register (principle 2 upheld) |
| Event Fabric | DORMANT_IMPLEMENTED | `lib/eventBus/*` + `EventEnvelope`; flag OFF; **0 live producers** |
| Audit | ACTIVE | `AdminAuditLog` + admin audit route |
| Operator Reputation | DORMANT_IMPLEMENTED | `lib/reputation/*` + `XpAward`(append-only, RESTRICT FK) + `ReputationMilestone`; **0 HTTP surface** |
| Performance Intelligence | PROPOSED | **doc-only** (`PERFORMANCE-INTELLIGENCE.md`); no lib, no model |
| Arena | DORMANT_IMPLEMENTED | `lib/arena/*` + `/arena`; flag OFF + cohort gate; own-progress only |
| Marketplace | PROPOSED | no lib, no model — appears only in scoring refusals + docs |
| Operator Network | DORMANT_IMPLEMENTED | `lib/network/*` + `NetworkMessage` + `/network`, `/api/network/messages`; flag OFF |
| Community (legacy social) | LEGACY_ACTIVE | `lib/community` + `/community`; LIVE; branded "Operator Network" in module registry (name collision) |
| Rooms | PROPOSED | `app/gxl/[room]` noindex specimen prototype only |
| Meetings | ABSENT | no lib/model/route |
| Scheduling | ABSENT | only cron jobs (unrelated) |
| Notifications | PARTIAL | Web Push ACTIVE + Email (Resend) ACTIVE; unified notify effect dormant |
| Campus / Academy | ACTIVE | `lib/academy.ts` deterministic path + `/academy` (CROA-safe) |
| Certifications | ABSENT | no lib/model/route |
| Knowledge Capture | ACTIVE | `lib/knowledge` + `/api/knowledge` |
| Knowledge Graph | ACTIVE | `lib/intelligence/graph.ts` per-user pure deterministic credit graph (not cross-operator) |
| Kai | ACTIVE | `lib/kai.ts` + `lib/intelligence`; reasons over facts/projections |
| Billing / Stripe | ACTIVE | `lib/stripe` + webhook → subscription sync |
| Analytics (admin) | ACTIVE | `lib/analytics/aggregate.ts` over `ProductEvent` |
| Advanced Analytics (customer) | DORMANT_IMPLEMENTED | `MODULE_ANALYTICS` OFF |
| Mission Control | ACTIVE | `lib/missionControl.ts` + `lib/missionEngine` |
| GIOS runtime boundary | PARTIAL | Host layer ACTIVE (tier resolution consumed by entitlements/stripe); Kernel PEP/registry NOT the live path |
| Credit-report Identity/Discrepancy | LEGACY_ACTIVE | `/identity` + `/api/identity/{discrepancies,letter}` — **namespace collision** with Operator Identity |

**Topology verdict:** the durable Operator platform (Identity, Organizations, Reputation, Event Fabric) is *implemented and dormant* — capability-latent, awaiting Gate D + activation. Two confirmed observations: **(a)** the GIOS kernel PEP is documented as the universal gate but is invoked by no route (CONFIRMED MEDIUM — it is a reserved seam, live authorization is scattered across `session`/`entitlements`/`requireAdmin`); **(b)** the "identity" and "Operator Network" names each denote two different things (a live feature and a dormant service) — a naming-hygiene correction, not an architecture defect.

---

## 5. Ownership & authority audit (Phase 3)

The `PLATFORM-OWNERSHIP-MAP.md` is **substantially accurate** — every raised ownership conflict was downgraded to LOW or classified a documented transition under adversarial verification. No ACTIVE dual-owner exists.

| Ownership question | Classification | Note |
|---|---|---|
| Event-contract payload semantics | **LOW** (not a violation) | The map says "each context owns its contracts"; the schemas physically colocate in `lib/eventBus/contracts.ts` as a *registry* the emitting context authors — a documented convention, not centralized meaning-ownership. Worth an explicit note in the map. |
| Org RBAC map ↔ kernel PEP | **LOW** | Documented-not-implemented: the map says the PEP consumes `rbac.ts`; the PEP has zero reference to it. The map slightly overstates a live wire; `rbac.ts` correctly enforces nothing on its own. |
| Scoring-policy source of truth | **LOW** | Stale *comment* in `lib/reputation/policy.ts` header still names Arena; `scoring.ts` is the real owner (Sprint-10 move). Code behavior is correct; only a comment is stale (→ §16). |
| Durable membership vs shadow `TeamMember` | DOCUMENTED_TRANSITION | `lib/identity` is sole canonical owner; `lib/os/platform/teams.ts`/`teamStore.ts` is dead, zero consumers, self-heals shadow tables — **removal is a tracked follow-up**. |
| Agency-client (`managedByAgencyId` vs `OrganizationMembership`) | DOCUMENTED_TRANSITION | Exactly one ACTIVE owner (the live `User.isAgency`); `OrganizationMembership` is the Gate-F-gated successor. |
| Role taxonomies (`UserRole`/`OrgRole`/`TeamRole`) | NOT_A_CONFLICT | Legitimately scope-separated. |
| XP write authority | NOT_A_CONFLICT | `XpAward` written only within `lib/reputation/*`. No marketplace/billing/Arena write path exists. |
| Arena owning XP truth | NOT_A_CONFLICT | `lib/arena/project.ts` is pure/read-only; writes nothing. |
| Two standing engines (Arena fold vs Reputation fold) | INFO | Both dormant, both sourcing `scoring.ts` weights — no divergent value; the transition is documented (Arena re-points to Reputation projections at activation). |
| Network tenant authorization | NOT_A_CONFLICT | `lib/network/authz.ts:10` "TENANT KEY IS AN ID, NEVER A NAME" — ID-based, fail-closed. |
| `/identity` route namespace | LOW | Credit-report feature owns `/identity` + `/api/identity`; Operator Identity needs a distinct namespace at activation. |

**Ownership verdict:** the one-owner-per-capability invariant holds. Corrections are a stale comment, one over-stated map line, and the naming collision — all documentation-level.

---

## 6. Identity & multi-tenancy (Phase 4)

The Identity foundation is a **generic, correctly-shaped** base: `Organization.kind ∈ {AGENCY,ENTERPRISE,EDUCATOR,VENDOR,INTERNAL}` (adding a kind is an additive `ALTER TYPE`), unique slug, owner-by-id (`RESTRICT`), membership with `OrgRole`. It supports individual operators, agencies, enterprises, educators, vendors, internal teams, and multi-org membership **structurally**. Surviving gaps (all MEDIUM or below post-verification — none forces redesign, all are additive future work):

- **Managed-client → Organization cutover has no implemented bridge** (MEDIUM, was BLOCKER). The `managedByAgencyId → OrganizationMembership` reconciliation is documented (Gate-F) but unwritten. Downgraded because the live agency model *works*; the successor is dormant and the migration is additive — this is a scheduled activation step, not a broken foundation.
- **Organization lifecycle (suspend/archive) and ownership transfer/succession are unreachable/unmodeled** (MEDIUM ×2). `OrganizationState` exists but no transition path; owner `RESTRICT` means an owner account cannot be deleted until transfer exists. Both are additive service methods within the frozen schema.
- **No professional-profile projection model; `handle` is a defined-but-unclaimable column; membership `SUSPENDED` unreachable** (LOW). All additive.
- **Identity deletion is cascade-only** with no consent record / erasure-vs-deletion distinction (LOW) — see §12 (the erasure strategy itself is sound; the *distinction* is unbuilt).

**Identity verdict:** foundation sound and generic; the multi-tenant future is reachable additively. The cutover bridge and org-lifecycle methods are the top pre-activation implementation items.

---

## 7. Reputation / XP / economy (Phase 5)

The append-only ledger (`XpAward`, `UNIQUE(subjectId, operatorId, awardKind)`, RESTRICT FK, deterministic fold floored at 0) correctly realizes the ratified invariants: XP is server-authoritative (no XP input exists), append-only, corrections are compensating records, and the canonical policy lives in `lib/reputation/scoring.ts` (Arena re-exports). REFUSED_V1 (no leaderboards/streaks/star-ratings) is code-enforced. Surviving items:

- **The wired Arena reconcile-on-read path can silently decrease standing on outcome regression** (MEDIUM, was HIGH; principle 6). This is the *v1 Arena* mutable projection (`lib/arena/project.ts`), dormant, and it is exactly what the Reputation append-only ledger replaces. **Retiring the Arena mutable-XP path in favor of the ledger must precede `OPERATOR_REPUTATION_ENABLED`** — a listed correction, within the frozen model.
- **Mandated fraud/fairness governance is ratified-but-unbuilt** (MEDIUM, was HIGH) and **scale/volume bias is structurally present with fairness floors absent** (MEDIUM, was HIGH). These are policy-layer obligations (fairness floors, evidence sequencing, referral/verified-client definitions) that are owner-gated by design; the ledger *shape* supports them additively. Not a schema defect.
- **Admin reversal is in-service irreversible; XP evidence is self-attested; `PROHIBITED_XP_SOURCES` is decorative** (LOW). Mitigated today by the absence of any producer/payoff; each is an activation-time hardening item.

**Reputation verdict:** the truth substrate is sound and append-only. The economy's *middle legs* (Entitlement, Reward Claim) and *fairness governance* are unbuilt but additive; the Arena mutable-XP retirement is the concrete pre-activation correction.

---

## 8. Event / replay / projection (Phase 6)

The Event Fabric (`EventEnvelope`, deterministic id = `sha256(tenant|type|source|dedupeKey)`, refs-only + structural PII guard, versioned contracts, idempotent append, no fanout) is a **facts-only transport**, correctly scoped. Surviving items:

- **No monotonic sequence column** (MEDIUM, was HIGH). Ordering is `[createdAt, id]`; within a millisecond, total order is by cuid, not causal. For future strict cross-aggregate replay this matters — but a `BIGSERIAL` sequence is an **additive** column, not a redesign. Recommend adding it before high-volume consumers exist.
- **Replay-driven projection rebuild and late-subscriber redelivery are documented, not implemented** (LOW). The `reconcile.ts` publisher proves the *pattern* executably for Reputation; general redelivery is future work.
- **`NOTIFICATION_CREATED` is a command/intent on a facts bus** (LOW). A known, contained wart (it feeds the existing notify path); keep new contracts facts-only.
- **Erasure is admin-platform-only** — no per-subject account-deletion cascade into the event log yet (LOW; see §12).

**Event verdict:** sound facts-only spine; the sequence column is the one additive hardening worth doing near the freeze.

---

## 9. Collaboration readiness (Phase 7)

The seams support the collaboration future **without redesigning Identity/Event Fabric/Organizations/Reputation** — confirmed after the headline "attachment leak" HIGH was refuted (the audience predicate is already landed and fail-closed). Reality:

- **No Room bounded context yet** (INFO, was HIGH): `channelKey` is a value-object over frozen community keys. Rooms (public/private/org/classroom/consultation/recorded/ephemeral) are a clean **new context** to add — the visibility/audience primitives (`canViewChannel`, `audienceAgencyId`) already exist as the seam.
- **Network tenant key is bound to the legacy agency-account model** (LOW, was HIGH): it consumes the live agency identity, not `OrganizationMembership` — consistent with the documented Identity transition, not a parallel owner.
- **`NetworkMessage` publishes nothing to the Event Fabric; collaboration identity is the auth `User`, not `OperatorIdentity`** (LOW ×2). Both are additive wiring at activation (the fact seam + the identity consumption).

**Collaboration verdict:** Rooms/Meetings/Network are addable as new contexts over existing seams; nothing forces a foundational redesign.

---

## 10. Knowledge / Kai / GIOS boundary (Phase 8)

The domain-truth boundary is **correctly built** (INFO/positive): `lib/intelligence/graph.ts` is a link-only, tenant-scoped, deterministic projection where every node keeps a citable ref — Kai reasons over facts/projections and owns no domain truth. Surviving items:

- **Two independent credit-graph models** (MEDIUM, CONFIRMED): a real duplication to consolidate to one Intelligence owner — bounded, additive, does not touch the frozen schema.
- **The Kai Kernel (GIOS L1) and the L2 Reasoning/Memory contracts have zero production callers** (LOW, was HIGH): the frozen "kernel" is unexercised reference code today. This is expected for a dormant runtime layer and does not block the CreditVector schema freeze; it does mean GIOS's own ABI-freeze precondition (real consumers) is not yet met.
- **The dormant kernel persistence still uses self-heal DDL (Law 7)** the owner reversed a day later (LOW) — a corrected-false claim to reconcile in the frozen constitution, not live behavior.

**GIOS/CreditVector integration boundary (formal):** GIOS provides **runtime capability** (scheduler, PEP, capability registry, plugin model, provider-independence) and **owns no CreditVector domain meaning**. CreditVector is "Plugin #1" (ADR-0026). CreditVector may later **inherit GIOS laws by reference** (the host layer already does — tier resolution) **without merging repositories or rewriting bounded contexts**. The boundary holds today because the kernel is not the live enforcement path; the future obligation is to wire the PEP as the gate *incrementally*, per-capability, never as a big-bang domain absorption. No extraction, no repo merge.

---

## 11. Security / privacy / compliance (Phase 9)

The security posture holds after the "erasure BLOCKER" was refuted. Surviving items, all MEDIUM or below and mostly activation-gated:

- **Admin impersonation streams decrypted PII with no per-access audit / maker-checker** (MEDIUM, was HIGH). Real hardening item for the live admin path — add per-access audit + maker-checker before broadening impersonation.
- **A `SETUP_SECRET` bypass remains in bootstrap/migrate** (MEDIUM, was HIGH) that the docs claim is gone — reconcile doc-to-code and confirm the bypass is disabled in production.
- **Live account deletion is a hard cascade with no erasure reconciliation to the durable event/reputation substrate** (LOW) — connects to the §6 per-subject erasure gap; additive.
- **Abuse mitigation fails OPEN on a single DB fault; no maker-checker on live privileged actions; CROA scrubber is a regex backstop** (LOW/INFO). Known postures; each is a counsel/hardening gate, not a schema issue.

**Counsel gates (not legal conclusions):** public professional profiles + photos, any cross-user reputation/outcome display, marketplace seller/affiliate terms, educator/certification claims, and CROA/FCRA/FTC-sensitive surfaces all remain owner + counsel gated. The privacy policy still lacks "operator"/"community" coverage — a live gap to close before any cross-user surface activates.

**Security verdict:** no foundational security redesign; two MEDIUM live-path hardening items (impersonation audit, SETUP_SECRET) worth addressing independent of Gate D, plus the standing counsel gates.

---

## 12. Gate D adversarial review (Phase 10)

**Classification: APPROVE AFTER LISTED PRECONDITIONS.** 18 of 22 runbook checks passed as-written; the 4 gaps are fixed this session. Additive/dependency/dormant-safety all verified against the migration SQL.

| Check | Result |
|---|---|
| Additive / 0-destructive across all 6 migrations | OK (0 DROP/ALTER COLUMN/DELETE/TRUNCATE) |
| Migration order & FK-target existence | OK (reputation FK→OperatorIdentity→User→0_init, dependency-proven) |
| Table/index/FK counts | OK (identity 3 tbl/9 idx/4 FK; reputation 2 tbl/4 idx/2 FK) |
| Enum creation (5 new) | OK (do not exist in prod) |
| Index/constraint lock impact | OK (all on new empty dormant tables) |
| Direct-connection / Accelerate / shadow-db / advisory-lock / txn boundaries | OK |
| Dormant-code compatibility after schema exists | OK (flags OFF, 0 HTTP surface) |
| Rollback & post-migration verification | OK (backup-restore authoritative; empty-table drop fallback) |
| **`0_init` baseline (resolve vs deploy)** | **GAP → FIXED**: `migrate deploy` alone fails on the un-baselined `0_init`; §6.4 `migrate resolve --applied` is now mandatory |
| **`_prisma_migrations` state framing** | **GAP → FIXED**: §4 corrected — prod has no history; the resolve-baseline was preview-only |
| **CREATE-privilege precondition** | **GAP → FIXED**: added P8 (`has_database_privilege … 'CREATE'`) |
| **`migrate status` interpretation of un-baselined chain** | **GAP → FIXED**: §6.3 probe + §7 expected-output guidance |

Remaining **preconditions** (operational, owner-executed): fresh backup (P3); direct connection (P5); the §6.3 read-only state probe; the §6.4 baseline reconcile derived from it (0_init always; network/event_bus conditionally); P8 privilege check; explicit owner authorization. Because the actual production `_prisma_migrations`/table state can only be read at execution time, Gate D cannot be certified "execute now" from the repository alone — hence *after listed preconditions*, not *for execution*.

---

## 13. Five-year capability seam matrix (Phase 11)

| Capability | Seam verdict | Owner / predecessor |
|---|---|---|
| Professional profiles + photos | NEEDS_NEW_CONTEXT_NO_REDESIGN | `lib/identity` projection + `lib/attachments` (`operator_profile` scope); after Identity activation + the 12-item media control register |
| SOP/KPI & business health | REQUIRES_FOUNDATION_FIRST | Performance Intelligence Service — **doc-only, zero code**; needs Event Fabric activation first |
| Arena competitions | REQUIRES_FOUNDATION_FIRST | `lib/arena` experience over `lib/reputation` truth; cross-user competition is REFUSED_V1 (counsel-gated) |
| XP-based unlock eligibility | NEEDS_NEW_CONTEXT_NO_REDESIGN | Reputation milestones (built) → **Entitlement Service (absent)** |
| Marketplace | REQUIRES_FOUNDATION_FIRST | absent; needs Identity + Reputation + the Entitlement/Reward-Claim join; consumes identity, never mutates XP |
| Affiliates | REQUIRES_FOUNDATION_FIRST | absent; a separate CASH instrument (own ledger), never XP |
| Campus (Academy) | NEEDS_NEW_CONTEXT_NO_REDESIGN | `lib/academy` exists; needs durable completion evidence (a DB row) to feed reputation |
| Certifications | NEEDS_NEW_CONTEXT_NO_REDESIGN | issuance record → Identity; meaning/scoring → Reputation; absent today |
| Public/private Rooms | NEEDS_NEW_CONTEXT_NO_REDESIGN | `lib/network` visibility value-objects + `audienceAgencyId` are the seam |
| Video Meetings | NEEDS_NEW_CONTEXT_NO_REDESIGN | none yet; a third-party RTC provider behind a `lib/` boundary |
| External guests | NEEDS_NEW_CONTEXT_NO_REDESIGN | Identity; tension: `OperatorIdentity` is 1:1 account-bound — a non-account guest needs a first-class model |
| Scheduling | SUPPORTED_BY_SEAM | GIOS "exactly one Scheduler" (Law 14) over crons |
| Knowledge Capture | NEEDS_NEW_CONTEXT_NO_REDESIGN | `lib/knowledge` present; additive capture surface |
| Knowledge Graph | SUPPORTED_BY_SEAM | `lib/intelligence/graph.ts` (shipped, pure, cited refs) |
| Kai | SUPPORTED_BY_SEAM | `lib/kai` + `lib/intelligence`; must stay a reasoner, never a truth writer |
| Multi-agent execution | NEEDS_NEW_CONTEXT_NO_REDESIGN | `lib/execution` + `lib/missionEngine`; over Event Fabric + deferred-effect model |
| Mobile apps | NEEDS_NEW_CONTEXT_NO_REDESIGN | renderer over server truth; PWA path live |
| Public API | REQUIRES_FOUNDATION_FIRST | **absent — no machine principal** (no ApiKey/token model; principal = session only) |
| SDK | REQUIRES_FOUNDATION_FIRST | downstream of the public API + versioned public contracts |
| Plugins | SUPPORTED_BY_SEAM | GIOS plugin model + capability registry; CV is Plugin #1 |
| Third-party providers | SUPPORTED_BY_SEAM | provider-independence (Law 23); Anthropic/Stripe/Resend already behind `lib/` |
| Enterprise federation | REQUIRES_FOUNDATION_FIRST | `Organization.kind ENTERPRISE` reserves the type, but auth is NextAuth JWT only — **no external IdP/SSO seam** |
| White-label organizations | NEEDS_NEW_CONTEXT_NO_REDESIGN | generic `Organization` (kind + slug + owner-by-id) |

**Two missing foundational primitives surface repeatedly** — but neither forces redesign of what's frozen, both are additive:
1. **A non-session (machine / federated) principal** — the gate for Public API, SDK, and Enterprise federation. Every route today authenticates via NextAuth session JWT.
2. **The economy's middle legs — Entitlement + Reward-Claim records** — the gate for XP-based unlocks, Marketplace, and Affiliates. Only Milestone is built.

Both are **new additive models/contexts** that plug into the frozen Identity/Reputation/Event-Fabric spine. They are the strongest candidates for "define the seam now so later work doesn't drift," but they do not block the freeze.

---

## 14. Frozen platform dependency order

The dependency spine to build within (no capability may invert an arrow):

```
Authentication (User/session)
      └─> Operator Identity ──> Organizations ──> Membership
                 │                     │
                 └──> Event Fabric (facts-only transport) <── all domains emit here
                                       │
                 Reputation (XP truth, append-only) ──> Arena (experience) / Marketplace-trust
                 Performance Intelligence (SOP/KPI/health — SEPARATE from Reputation)
                 Entitlement ──> Reward Claim ──> Marketplace / unlocks
                 Knowledge Capture ──> Knowledge Graph ──> Kai (reasons only, never writes truth)
                 Rooms/Meetings/Network (new contexts over Identity + Event Fabric + audience seams)
                 [Machine principal] ──> Public API ──> SDK / Plugins / Enterprise federation
GIOS runtime (scheduler, PEP, registry, plugin model, provider-independence) — capability under, never domain-owner over.
```

Invariants (permanent): Identity precedes Reputation precedes Arena/Marketplace-trust; Event Fabric transports, domains own meaning; projections never become truth; Kai never owns truth; GIOS never owns CreditVector domain meaning; one authoritative owner per context; lifetime XP append-only and never spent; Marketplace never mutates XP.

---

## 15. Corrections

**Made this session (documentation-only, on branch `docs/architecture-freeze-1.0`):**
1. **Gate D runbook hardened** — mandatory `0_init` baseline reconcile (§6.3 probe + §6.4 `migrate resolve --applied` + §6.5 re-inspect/deploy), P7/P8 preconditions, §4 framing, abort conditions. *(the one execution blocker)*
2. **This report** — contradiction register, topology, ownership audit, per-domain assessments, Gate D review, five-year seam matrix, frozen dependency order.
3. **`CURRENT-STATE.md` top banner** — corrected to `6c76454` + freeze status + pointer here.
4. **`INDEX.md`** — routes to this report.
5. **`PLATFORM-OWNERSHIP-MAP.md`** — namespace-collision disclosure + event-contract-registry clarification + PEP-not-yet-wired note.

**Requiring implementation (NOT made — code/schema-adjacent; documented and stopped per the review charter):**
- Stale code comment in `lib/reputation/policy.ts` header naming Arena as scoring source (behavior already correct).
- `ARCHITECTURE.md` model count + self-heal-as-new-table framing; `OPERATOR-IDENTITY.md` header status.
- Sprint-9 release doc undercounts `operator_identity` FKs (says 3, actual 4 — the runbook is already correct).
- Remove the dead `lib/os/platform/teams.ts` / `teamStore.ts` shadow membership store.
- Consolidate the two credit-graph models to one Intelligence owner.
- Add a monotonic sequence column to `EventEnvelope` (additive) before high-volume consumers.
- Security hardening: per-access audit + maker-checker on admin impersonation; confirm the `SETUP_SECRET` bypass is disabled in prod.

**Pre-activation implementation obligations (build within the frozen model, in dependency order):**
managed-client → `OrganizationMembership` bridge · Organization suspend/archive/transfer methods · retire the Arena mutable-XP path in favor of the Reputation ledger · fairness governance (floors/sequencing/referral definitions) · Entitlement + Reward-Claim records · Performance Intelligence context · a machine/federated principal · professional-profile projection + media controls.

---

## 16. Recommended next slice + deferred capabilities

**Recommended next implementation slice after Gate D:** **Operator Identity activation readiness** — the `managedByAgencyId → OrganizationMembership` reconciliation migration + Organization lifecycle (suspend/archive/transfer) methods, behind `OPERATOR_IDENTITY_ENABLED`. It unblocks every downstream context (Reputation producers, Rooms, profiles) and resolves the highest-cluster gap (Identity multi-tenancy) without touching the frozen schema. Pair it with defining the **Entitlement/Reward-Claim** and **machine-principal** seams on paper (ADR-level) so later Marketplace/API work cannot drift.

**Explicitly deferred (owner/counsel-gated, do not build before their predecessor):** Arena competitions, Marketplace, Affiliates, public profiles + photos, Rooms/Meetings/video, Campus certifications, Public API/SDK, Enterprise federation, cross-user reputation/outcome surfaces.

---

## 17. Explicit confirmations

No runtime code changed · no Prisma schema changed · no migration file changed or executed · no feature flag enabled · no new service implemented · no XP values created · no milestone definitions created · no Arena/Rooms/Meetings/Marketplace UI built · no GIOS integration executed · no repository merged · no force-push · Sprint 11 not started. All changes this session are documentation on the `docs/architecture-freeze-1.0` branch. Production remains behaviorally unchanged and dormant.
