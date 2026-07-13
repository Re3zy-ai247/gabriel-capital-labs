# ADR-0004: Deterministic grounded letter first; LLM only refines

Status: Accepted (original build; recorded retroactively 2026-07-12)
Date: 2026-07-12 (recorded)
Decision owners: Original rebuild (QA-driven)

## Context
QA of the predecessor app found letter generation could 500/hard-fail when the LLM misbehaved, and LLM-authored letters fabricated cross-bureau claims.

## Decision
`app/api/letters/generate/route.ts` renders a grounded, compliance-safe letter **deterministically first** (`lib/letter.ts` `renderTemplateLetter`, cross-bureau statements gated on `hasCrossBureauKnowledge` from the per-bureau presence model). The LLM only *refines* that draft; on missing key or API error the grounded draft ships. `lib/compliance.ts` scrubs the final text in every path.

## Alternatives considered
LLM-primary generation — rejected: hard-fail risk + fabrication risk in a legally sensitive artifact.

## Consequences
Letters can never hard-fail and never depend on the model for factual grounding. Any letter-pipeline change must preserve: deterministic fallback, cross-bureau gating, final scrub.

## Security implications
None beyond standard prompt hygiene (no secrets in prompts).

## Compliance implications
Core CROA/FCRA control: correct statutes (§611/§623/§605, FDCPA §809; §609 paired with §611), no fabricated claims, guarantee language scrubbed.

## Migration or rollback plan
N/A — foundational.

## Evidence
`app/api/letters/generate/route.ts`, `lib/letter.ts`, `lib/bureauData.ts`, `lib/statutes.ts`, `lib/strategies.ts`, README "What makes this build 10/10" items 1–4, `ARCHIVE/qa-fix-traceability-2026-06.md`.
