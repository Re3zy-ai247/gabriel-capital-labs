# Platform Services — Phase II (execution plan)

**Status: EXECUTION WORKSPACE (2026-07-21). Not a redesign.** Opened after Gate C (v0.8.0). The architecture is FROZEN (`CURRENT-STATE.md` freeze list); this doc only sequences its *implementation*. One concept → one home: where a service is already specified, that doc is authoritative and this file just points to it.

## Engineering law (binding)
**Every sprint must increase production capability.** Production software is the deliverable, not architecture. No new ADR unless implementation reveals a genuine architectural discovery. No speculative implementation; reuse before build; one bounded context at a time; one measurable milestone at a time; small reviewable commits; migration-first.

## Dependency-ordered sequence (do NOT reorder, do NOT redesign)
1. **Operator Identity** ← current target
2. Organizations
3. RBAC
4. Profiles
5. Identity Events
6. Reputation Runtime
7. Milestones
8. Entitlements
9. Claims
10. Performance Intelligence Runtime
11. Arena Runtime
12. Marketplace Runtime
13. Operator Network Runtime
14. Knowledge Graph
15. Kai Runtime

Identity precedes everything. **Do not implement Reputation, Arena, Marketplace, Campus, or Performance Intelligence until Identity is production-complete.**

## Slice 1 — Operator Identity (scope only; canonical rules live in [`OPERATOR-IDENTITY.md`](OPERATOR-IDENTITY.md))
Deliver, incrementally and each behind a fail-closed flag:
- durable operator identity (server-authoritative id; never client-derived)
- organization membership + agency membership (by **id**, never name — repo convention)
- roles + RBAC (deny-by-default; server-side enforcement; no client-supplied authority)
- profile ownership + profile visibility (default private; consent-gated exposure)
- professional operator portfolio + profile media (**reuse `lib/attachments.ts` + `lib/docCrypto.ts`** — do not build a new store)
- consent + auditability
- identity events on the Event Fabric (versioned, refs-only contracts per ADR-0036; publish→validate→authorize→persist→fanout; replay-compatible)

## Execution discipline (per slice)
- **Migration-first** (CLAUDE.md gotcha #1): every new table/column/index/enum/relation ships as a reviewed Prisma migration with preflight + forward-validation + rollback; **never in the build**; preview-validate on the isolated preview DB. Production apply is **owner-gated (Gate D)**; feature activation is **owner-gated (Gate F)**.
- Fail-closed flag from commit 1; dormant in prod until owner flips it.
- Own-data-only defaults; cross-user/public surfaces stay refused pending fraud + CCO/counsel (CROA §1679b / FTC §5) — see `RELEASE-REVIEW-sprint7-8.md` DW-D register.
- Guard test per slice; `tsc` 0 + build ✓ + guard suite before any push. Five-review gate (`.ai/SOP/ship-a-feature.md`) for user-facing/money-touching changes.
- Small reviewable commits; update `CURRENT-STATE.md`; report Changed · Validated · Remaining risks · Next.

## Standing prerequisites carried from v0.8.0 (owner-gated; not this doc's to close)
- Gate D production migration baseline (`RELEASE-REVIEW-sprint7-8.md` DW-C1) before any flag flip.
- DW-D14 demo-cohort exposure resolved before `OPERATOR_NETWORK_ENABLED`.
- Policy values (XP weights, verified-client/referral/fraud definitions, public-profile fields, marketplace legal terms) remain PROPOSED — do not encode them without owner + fraud + CCO/counsel sign-off.

## References (authoritative — do not duplicate)
`OPERATOR-IDENTITY.md` · `VECTOR-XP.md` · `PERFORMANCE-INTELLIGENCE.md` · `CREDITVECTOR-ECONOMY.md` · `ROADMAP.md` · `GIOS-PLATFORM.md` (ADR-0034) · `ADR/ADR-0035…0038` · `RELEASE-REVIEW-sprint7-8.md`.
