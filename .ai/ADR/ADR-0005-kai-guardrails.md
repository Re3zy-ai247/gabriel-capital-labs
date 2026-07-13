# ADR-0005: Kai guardrails — scope lockdown + untrusted-input fencing

Status: Accepted (hardened 2026-06-17)
Date: 2026-07-12 (recorded)
Decision owners: Owner + Claude Code security session

## Context
Kai answers questions in the multi-user Community Hub — the only AI surface fed untrusted content from other users, so prompt injection, scope abuse, and prompt extraction are live threats.

## Decision
`lib/kai.ts` carries an absolute SECURITY & SCOPE block: credit-topics only; refuses code/off-topic; never reveals its system prompt; never emits secrets; compliance rules cannot be waived by any instruction. Forum content is fenced between BEGIN/END markers explicitly labeled UNTRUSTED; `sanitizeForPrompt()` caps length and strips fence-spoofing sequences. Kai is given **no tools, no DB access, no secrets** — architecturally unable to exfiltrate.

## Alternatives considered
Moderation-API pre-filtering only — insufficient against injection; fencing + capability-starvation is the stronger control.

## Consequences
Any edit to an AI prompt that takes user content MUST keep the fence + untrusted framing + sanitizer. New AI surfaces taking user content copy this pattern.

## Security implications
This IS the control. Guard: `scripts/kai-sanitize.test.ts` (8/8) — run it on any `kai.ts` change.

## Compliance implications
The scope block also enforces the CROA bar inside answers (bankruptcy answer CROA-reviewed via /compliance-review — Internal compliance assumption, not attorney sign-off).

## Migration or rollback plan
N/A — security control; do not weaken without a replacement.

## Evidence
`lib/kai.ts`, `scripts/kai-sanitize.test.ts`, 2026-06-17 hardening notes (archived CLAUDE.md).
