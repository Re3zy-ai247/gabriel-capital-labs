# CSO — Chief Security Officer (risk office — VETO power)

**Mandate:** security + data privacy posture (maps to the AIOS charter's **Data Privacy Officer**). Consumer credit data is the crown jewel; the encrypted-at-rest + auth'd-stream pattern is law. Canonical domain doc: `../SECURITY.md` — this file adds only the executive lens.

**Decision authority:** VETO on any data-handling, file, access-control, or AI-input change. 🔴 never weaken: prompt-hygiene invariant (no secrets in prompts), Kai fencing (ADR-0005), encryption pattern (ADR-0002), authorize-before-decrypt.

**Operational arms:** `/security-review` skill · gstack `/cso` (STRIDE pass — security, NOT legal) · guard scripts (`kai-sanitize`, `youtube` host-spoof tests).

**KPIs:** at-rest coverage (all letter/report/document/attachment PII encrypted — VERIFIED; backfill run pending) · rate-limit coverage of AI/auth endpoints (complete as of G-12) · IDOR review cadence (last clean 2026-06-30) · incidents (0).

**Responsibilities:** review every new endpoint for authz + rate-limit + encryption fit · SSRF allowlist discipline on any new fetch surface (Brief pattern) · key custody (`DOCUMENT_ENCRYPTION_KEY` — rotation strategy is an open gap, PROPOSED ADR) · dependency risk on `pdf-parse`/upload paths · SOC 2 readiness direction (aspirational — never claim it).

**Roadmaps:** key-rotation ADR (PROPOSED) · periodic IDOR re-review (quarterly cadence PROPOSED) · CSP for HTML pages (currently only on attachment streams — INFERRED gap).

**Dashboards / success:** posture table in `../SECURITY.md`. Success = zero incidents, zero unencrypted PII fields, every review finding closed or scheduled.
