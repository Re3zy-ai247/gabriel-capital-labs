# Roadmap (canonical, product-level)

> **Sequencing now lives in `ROADMAP-V2.md`** (the ranked Top-100, Executive Review 2026-07-12). This file remains the shipped-history + near-term item tracker; V2 is the prioritization truth.

Company-level backlog is OWNED elsewhere: `~/Documents/Gabriel-Capital-Labs-AIOS/BACKLOG.md` (managed by `/gcl`). This file tracks repo-level product direction only — do not duplicate the AIOS backlog here.

## Shipped (do not re-plan)
Core dispute engine · Community + Kai · Support · Attachments/identity vault · Agency · Stripe live · Brief Phases 1–3 complete (publish flow, engagement, comments, RSS+PDF automation, YouTube embeds) · weekly digest BUILT · admin dashboard suite (AIOS Phase 4) · Web Push · password reset · at-rest encryption sweep.

## Near-term (unblocked or owner-gated) — details in `CURRENT-STATE.md` / `TASKS.md`
1. Digest go-live (`COMPANY_POSTAL_ADDRESS` + test + `List-Unsubscribe` header).
2. Encryption backfills confirmation.
3. G-14: real Stripe MRR (or honest "estimated" label) + de-dupe overview/stats.
4. **Operator Identity Service** — the next platform-service implementation target (architecture done: [`OPERATOR-IDENTITY.md`]). PROPOSED; owner-gated. Prereqs before code: migration-first identity schema, durable identity event contracts, CCO/counsel pass on public-profile/handle/consent, RBAC-beyond-USER/ADMIN reconciled with the PEP. Cross-user surfaces stay under the CROA §1679b / FTC §5 counsel STOP.
5. **Event Fabric activation (owner-gated, Sprint 8):** prod `migrate deploy` of the 2 additive migrations + `EVENT_BUS_ENABLED=true` + wiring real producers/subscribers. Dormant until then.

## Offered-but-unbuilt (Brief)
- Stat/data cards (visuals for articles).
- Admin image-upload (public-domain/.gov or licensed only).

## Small debt
Favicon/OG regen from de-shadowed mark · `.env.example` drift fix · untrack `tsconfig.tsbuildinfo`.

## Counsel-gated (cannot ship without sign-off — `COMPLIANCE.md`)
First auto-drafted Brief publish · CROA positioning statement changes.
