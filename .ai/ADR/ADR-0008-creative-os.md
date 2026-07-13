# ADR-0008: Creative OS — canonical character system + scored render gate

Status: **Accepted** (governance/docs only — founder-directed 2026-07-12; individual renders still follow the 🟡 approval flow)
Date: 2026-07-12
Decision owners: Founder + CMO/Creative-Director lens

## Context
Kai (the founder's Shiba Inu) becomes CreditVector's mascot and brand identity (ADR-0007 E6). Ad-hoc generation would produce identity drift, wasted credits (1,010-credit balance at decision time), and un-reviewable brand assets. The prior ad build (CAMP-001) already proved the hybrid discipline: real UI + composited real logos + AI only for what AI is good at.

## Decision
Install a Creative OS at `.ai/creative/` — Character Bible (canonical identity anchored to ground-truth photos), Cinematography/Motion bibles, composable Higgsfield prompt blocks, storyboard library, and a mandatory 25-point consistency-scoring gate. Rules: never redesign or regenerate Kai from scratch; every generation references canonical media + composed blocks; every render is scored against the reference photos before acceptance; accepted assets register in `ASSET-REGISTRY.md` with score and cost. Claude = Creative Director; Higgsfield = rendering studio; founder = final approval.

## Alternatives considered
Freestyle prompting per asset (rejected: drift + cost); training a Higgsfield Soul immediately (deferred: needs 5+ photos and founder ask; the block system works either way); commissioning human 3D artwork (open option — the bibles serve as the art direction brief in that case too).

## Consequences
Every future ad, landing animation, onboarding sequence, demo, and social asset composes from one system; consistency is auditable (scores in the registry); cost discipline is structural (preflight, test-before-batch, stills-first). Overhead: bible updates precede new shot/lighting types.

## Security / Compliance implications
Real photos of the founder's pet/home are never published without explicit consent (Character Bible usage law). Storyboards pass `/compliance-review` before render spend; all public copy honors the CROA bar.

## Migration or rollback plan
Docs-only; the gate applies to future generations. Rollback = archive `.ai/creative/` (existing assets keep their registry entries).

## Evidence
Reference photos received 2026-07-12 (4 images, in-chat; Higgsfield upload pending). Credit balance 1,010 verified via connector. CAMP-001 hybrid workflow + costs verified in AIOS `PROMPT-LIBRARY.md`/`AD-BUILD-KIT.md`.
