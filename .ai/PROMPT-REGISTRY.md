# Prompt Registry (canonical)

**Principle: production AI prompts live in code — the code is canonical.** This registry maps them so sessions reuse instead of re-inventing. Only approved/reusable prompts belong here, not temporary experiments.

| ID | Purpose | Canonical location | Status | Notes / known failure modes |
|---|---|---|---|---|
| KAI-SYS | Kai community AI system prompt | `lib/kai.ts` | APPROVED (CROA-reviewed) | Contains the absolute SECURITY & SCOPE block + UNTRUSTED fencing. **Never edit without keeping the fence + untrusted framing**; guard `scripts/kai-sanitize.test.ts` |
| BRIEF-SYS | Brief article summarizer | `BRIEF_SYSTEM` in `lib/brief.ts` | APPROVED (compliance-bound) | Substantive 3–6 paras, never a meta-stub, empty summary if no substance; output re-scrubbed via `applyCompliance` on every write |
| LETTER-SYS | Dispute-letter LLM refine | `buildSystemPrompt` in `lib/letter.ts` | APPROVED | Refines the deterministic grounded draft only (ADR-0004); rule 3 forbids fabricated cross-bureau claims; final text always scrubbed |
| PARSE-SYS | Credit-report AI extraction (incl. `creditorKind`, furnisher contacts) | `lib/aiParse.ts` | APPROVED | Guard `scripts/classify.test.ts`; regex fallback in `lib/parse.ts` |
| ROUND2-SYS | Bureau-response analysis + round-2 letters | `lib/round2.ts` | APPROVED | Reads encrypted fields — decrypt before prompt assembly |
| STRAT-SYS | Strategist plan | `app/api/strategist/plan` | APPROVED | Renders via `components/Markdown.tsx` |

## Invariants for ALL prompts (Constitution Art. V)
- No env var, secret, internal ID, or other users' data ever interpolated into prompt text.
- Any prompt taking user content keeps untrusted fencing + `sanitizeForPrompt`-style caps.
- Compliance-sensitive outputs pass through `applyCompliance`.

## Paid media generation
Any paid visual generation (Higgsfield, Abacus, etc.) must first check `ASSET-REGISTRY.md` + this file, follow the composite-real-logo rules there, run one test clip before batches, and get owner approval for high-cost runs. Record reusable winning prompts here with: ID · purpose · version · tool · inputs · output requirements · cost · failure modes · last successful use.
