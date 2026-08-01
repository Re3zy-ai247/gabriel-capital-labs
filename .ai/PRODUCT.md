# Product (canonical)

**CreditVector™** by Gabriel Capital Labs — an **AI-powered Financial Reputation Platform** (positioning ruled by founder, ADR-0009): consumer-credit **intelligence, education, and software**, never "a credit repair app." Mission: reduce uncertainty, educate users, enable better financial decisions. Self-service first. North Star: "Bloomberg Terminal for consumer credit." Kai is the primary customer-experience layer; Claude Opus 4.8 is the current intelligence runtime. Educational tool; not legal advice; no outcome guaranteed.

## Users & plans (VERIFIED — `lib/entitlements.ts`)
| Plan | Entitlement |
|---|---|
| Free | 3 letters/mo, no AI features |
| Premium | Unlimited + AI (Kai, strategist, AI parse/refine) |
| Agency / Agency Pro | Full + `isAgency` client workspaces (cap 20 clients) |
Letter-pack credits purchasable via Stripe (idempotent webhook grants).

## Major workflows
1. **Report → dispute:** upload credit report (PDF) → AI parse (`aiParse`, regex fallback) → tradelines with per-bureau presence, creditor classification, honest scoring → strategist plan → dispute letter builder (deterministic grounded draft + optional LLM refine, compliance-scrubbed, furnisher address pre-fill) → print/PDF → track responses → response analysis + round 2.
2. **Community + Kai:** forum with post-moderation (reports queue), Kai AI answers (credit-only scope).
3. **Brief:** consumer-credit news feed — automated official-source ingestion (CFPB/FTC RSS → AI draft), human publish gate, engagement (likes/bookmarks/shares/comments), weekly email digest (canonical legal-footer source isolated; production integration and received delivery unverified).
4. **Support:** ticket center (all plans) with encrypted attachments.
5. **Identity:** encrypted identity-document vault.
6. **Agency:** multi-client workspaces for credit professionals.
7. **Admin:** overview/churn, product health, marketing, automation dashboards; Brief editorial desk; moderation queues; billing sync.

## Product boundaries (Existing product rule)
- Education/software positioning — never a credit-repair service (CROA bar: `COMPLIANCE.md`).
- Honest metrics only: unmeasured admin metrics say "not yet instrumented," never faked.
- Users control consequential actions (letter generation, mailing, publishing).

## Brand
Single source of truth `lib/brand.ts`. Logo = the owner's real 3D shield raster (`ASSET-REGISTRY.md` — never substitute a vector recreation). Voice: premium fintech, plain-English, no hype claims.
