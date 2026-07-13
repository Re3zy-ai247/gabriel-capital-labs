# Gabriel Product SDK — what every future product inherits

Status: BLUEPRINT (packages are extraction targets, not built artifacts; Rule of Two governs — `GABRIEL-INTELLIGENCE.md`). Each package lists its **source of truth today** (living CreditVector code/docs) so extraction is a harvest, not an invention.

## The inheritance packages
| Package | Contents | Source of truth today |
|---|---|---|
| `@gabriel/governance` | The `.ai/` starter kit: Constitution, INDEX/CURRENT-STATE pattern, ADR system, exec lenses, token-efficiency protocol, Founder's Standard gate. **The first thing any new product gets — day one, before code** | this repo's `.ai/` (proven) |
| `@gabriel/kai` | Character bible binding, the 8 states + behavioral state machine, Kai Home/timeline/panel/conversation-shell components, notification voice templates | `creative/` + KAI-EXPERIENCE + KAI-PRODUCT-DESIGN |
| `@gabriel/trust` | **The Trust Engine:** provenance chips, confidence badges, compliance-scrubber interface (domain rules pluggable), disclaimer system, honest-metrics primitives ("not yet instrumented"), the kill-list linter of dark patterns | `lib/compliance.ts` pattern + FOUNDER-STANDARD + Delight/Wow trust fabric |
| `@gabriel/knowledge` | Retrieval Kernel client, knowledge-pack schema, Verified Corpus client (domain-partitioned), citation rendering | ADR-0006 stores + statute-card design |
| `@gabriel/events` | Event Bus producers/consumers, derived-event rules engine, recommendation ledger | ADR-0007 KaiEvent/KaiRecommendation |
| `@gabriel/community` | Moderated community kit: threads/replies, report queues, compliance screening, verified-answer badging, promotion loop | `lib/community.ts` + brief-comment moderation |
| `@gabriel/billing` | Stripe patterns: hosted checkout, webhook idempotency ledger, entitlements module, credit ledger + packs, dignified cancel flow | `lib/stripe.ts`/`billing.ts`/`entitlements.ts` + CREDIT-ECONOMY |
| `@gabriel/auth` | Credentials auth, session-by-id, rate limiting, encrypted-at-rest field pattern, authz-before-decrypt streaming | `lib/auth.ts`/`docCrypto.ts`/`rateLimit.ts` (security-reviewed lineage) |
| `@gabriel/analytics` | Honest metrics catalog pattern (BI-XXX ids), AiUsage metering, admin dashboard primitives | business-intelligence/ + admin APIs |
| `@gabriel/creative` (template pack, not code) | Creative OS instance: bibles inherited company-level, prompt blocks, scoring rubric, storyboard/media-OS templates | `creative/` |
| `@gabriel/marketing` (template pack) | Media OS programming-grid template, channel rules, repurposing law, campaign registry schema | `creative/MEDIA-OS.md` + marketing/ |

## Product Intelligence Framework — the seven inheritances (enforced, not aspirational)
Every GCL product inherits these BY DEFAULT; opting out requires a founder ADR:
| Inheritance | Enforced by |
|---|---|
| **Trust** | Article XI + Founder's Standard gate shipped in `@gabriel/governance`; `@gabriel/trust` primitives make receipts cheaper than claims |
| **Transparency** | Provenance/confidence components are the default answer UI; honest-metrics primitives refuse invented numbers |
| **Education** | Knowledge-pack + citation rendering ship in the SDK; "teach one transferable thing per interaction" is a KAI-PRODUCT-DESIGN §7 law |
| **Calm interaction** | Motion Bible physics + notification caps + anti-overwhelm rules ship as the SDK's default UX constants |
| **AI efficiency** | Retrieval Kernel is the ONLY sanctioned path to a model; Cost Governor metering is non-removable |
| **Community** | `@gabriel/community` with compliance screening on by default |
| **Verified knowledge** | Verified Corpus client + the verification pipeline (unverified → staff → expert) as the standard content lifecycle |

## New-product bootstrap (the day-one checklist, deterministic)
1. `@gabriel/governance` installed → product CLAUDE.md + INDEX + CURRENT-STATE from template · 2. Domain constitution amendments (this product's compliance bar — counsel-reviewed) · 3. Kai license checklist (`GABRIEL-INTELLIGENCE.md` §2) · 4. Trust Engine wired with domain scrubber rules · 5. Retrieval Kernel bindings declared (what fills each layer here) · 6. Billing/auth from packages · 7. Media OS instance + launch storyboards · 8. Founder's Standard applies from the first PR.
Target (Year 2–3 exit): steps 1–8 in under two weeks; the product team's remaining job is the DOMAIN — data, law, workflows — which is exactly as it should be.
