# Roadmap (canonical, product-level)

> **Sequencing now lives in `ROADMAP-V2.md`** (the ranked Top-100, Executive Review 2026-07-12). This file remains the shipped-history + near-term item tracker; V2 is the prioritization truth.

Company-level backlog is OWNED elsewhere: `~/Documents/Gabriel-Capital-Labs-AIOS/BACKLOG.md` (managed by `/gcl`). This file tracks repo-level product direction only — do not duplicate the AIOS backlog here.

## Shipped (do not re-plan)
Core dispute engine · Community + Kai · Support · Attachments/identity vault · Agency · Stripe live · Brief Phases 1–3 complete (publish flow, engagement, comments, RSS+PDF automation, YouTube embeds) · weekly digest BUILT · admin dashboard suite (AIOS Phase 4) · Web Push · password reset · at-rest encryption sweep.

## Near-term (unblocked or owner-gated) — details in `CURRENT-STATE.md` / `TASKS.md`
1. Digest go-live verification (Founder legal identity resolved in source; separately authorized deployment + received admin test still required; `List-Unsubscribe` already shipped).
2. Encryption backfills confirmation.
3. G-14: real Stripe MRR (or honest "estimated" label) + de-dupe overview/stats.
4. **Operator Identity Service** — the next platform-service implementation target (architecture done: [`OPERATOR-IDENTITY.md`]). PROPOSED; owner-gated. Prereqs before code: migration-first identity schema, durable identity event contracts, CCO/counsel pass on public-profile/handle/consent, RBAC-beyond-USER/ADMIN reconciled with the PEP. Cross-user surfaces stay under the CROA §1679b / FTC §5 counsel STOP.
5. **Event Fabric activation (owner-gated, Sprint 8):** prod `migrate deploy` of the 2 additive migrations + `EVENT_BUS_ENABLED=true` + wiring real producers/subscribers. Dormant until then.

## Platform Services Era — LOCKED scope, dependency-ordered (owner-gated; architecture = ADR-0037 + ADR-0038 + `CREDITVECTOR-ECONOMY.md` + `VECTOR-XP.md` + `PERFORMANCE-INTELLIGENCE.md` + `OPERATOR-IDENTITY.md`)
The next broad development era (Sprint identifiers retained where operationally useful). Mandatory future delivery, **dependency-ordered — no arbitrary sprint numbers** (Release ≻ Identity ≻ Reputation · Evidence ≻ rewards · Performance-truth ≻ recommendations · Milestones ≻ entitlements ≻ marketplace unlocks · Improvement measured before rewarded). Every step is owner-gated + requires fraud/compliance/privacy/legal review before any weight or public surface goes live.
1. **Release & merge review** of the accumulated Sprint 7/8 work (branch `review/sprint7-8-constitutional`; see [`RELEASE-REVIEW-sprint7-8.md`]).
2. **Owner-gated production migration baseline** — `migrate resolve --applied 0_init` → `migrate deploy` (4 additive migrations; 0 DROP).
3. **Runtime release verification** (post-migration; flags stay OFF).
4. **Operator Identity Service foundation** — professional profile schema, roles/membership, durable identity event contracts. (Prereq for all below — OG-3.)
5. **Professional Operator Profile** — field set + visibility model (`OPERATOR-IDENTITY.md §5b`).
6. **Profile Media integration** — extend `lib/attachments.ts` with an `operator_profile` scope + missing controls (re-encode, EXIF strip, CSAM/NCMEC, impersonation screen, moderation, default avatar, visibility-enforced serving).
7. **Operator Reputation / Vector XP core** — migration-first append-only award ledger, idempotency `UNIQUE(subjectId, operatorId, awardKind)` (stable business entity — VECTOR-XP §5.1), versioned policy, anti-Sybil/collusion + velocity caps, fraud holds, improvement lens.
8. **Milestones** (latched module in the Reputation Service).
9. **Entitlements** (distinct service; resolves through the PEP).
10. **Reward Claims** (module in the Entitlement Service; one-time consumption).
11. **Performance Intelligence Service** — SOP/KPI/Health/Maturity + improvement-measurement integrity + evidence-cited Kai recommendations (CROA-scrubbed).
12. **Mission Control projections** (business-health surface).
13. **Arena progression expansion** — progression UI + evidence-based competitions/cohorts (`CREDITVECTOR-ECONOMY.md §5`).
14. **Campus integration** — education → authoritative educational evidence (no arbitrary XP).
15. **Marketplace integration** — entitlement-gated access; **never mutates XP**; CROA/CCO-screened inventory.
16. **Operator Network integration** — evidence-backed contribution events.
17. **Future economic incentives & affiliate systems** — SEPARATE instruments/ledgers (ADR-0038 PGE-4); reserved, not built; legal/accounting/tax gates.
- **Cross-cutting gates (every step):** anti-exploitation controls, fraud/abuse review, privacy review, compliance/legal review, the CROA §1679b / FTC §5 counsel STOP on any public cross-user surface, and **no policy value (weight/cap/window/qualification/threshold) goes live without owner sign-off** (ADR-0038 §6).

## Offered-but-unbuilt (Brief)
- Stat/data cards (visuals for articles).
- Admin image-upload (public-domain/.gov or licensed only).

## Small debt
Favicon/OG regen from de-shadowed mark · `.env.example` drift fix · untrack `tsconfig.tsbuildinfo`.

## Counsel-gated (cannot ship without sign-off — `COMPLIANCE.md`)
First auto-drafted Brief publish · CROA positioning statement changes.
