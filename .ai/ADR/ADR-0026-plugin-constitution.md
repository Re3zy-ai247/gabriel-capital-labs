# ADR-0026: The Plugin Constitution — the rules of the Kai ecosystem

Status: **PROPOSED — for founder review before kernel freeze.** Governs the ecosystem, not
implementation. The equivalent of the App Store Review Guidelines + Chrome Extension
Manifest + VS Code Extension API + Kubernetes CRDs + Terraform Registry — combined.
Date: 2026-07-15
Decision owners: Founder directive

> The moment a plugin can be written by someone who never met us, the trust boundary
> flips: plugins are **untrusted by default**, and the kernel must protect users, tenants,
> and other plugins *from* them. This document is the constitution that makes a decades-long,
> multi-party ecosystem safe, versionable, billable, and compliant.

## 1. What a plugin is
A **signed, versioned, manifest-declared** unit that registers a capability namespace +
handlers + declared permissions + a compliance boundary, runs **only** behind the kernel,
and can be added, updated, or removed **without changing the kernel**. It owns policy; it
never owns mechanism. A plugin is a bounded context (DDD): it exposes published, versioned
contracts, never its internals.

## 2. Identity, signing, namespaces
- **Identity:** a stable plugin id + a **publisher identity** (verified). Every plugin is
  **cryptographically signed**; the kernel verifies signature + manifest at registration and
  rejects unsigned/tampered plugins.
- **Namespaces** (the `domain.entity.action` grammar, ADR-0024) are **reserved through a
  registry.** First-party owns short reserved roots (`credit.*`, `funding.*`). Third-party is
  **scoped under a verified publisher** (`com.acme.tax.*`), like npm scopes / Java packages /
  Terraform `namespace/name`. No squatting; typo/impersonation defenses (verified-publisher
  badges). The kernel routes resolution/dispatch to the registered owner of a prefix — only.

## 3. Trust tiers (this drives everything else)
| Tier | Who | Execution | Data access | Review |
|---|---|---|---|---|
| **First-party** | Us (CreditVector is plugin #1) | may run in-process | broad, PEP-gated | internal CCO/CTO gates |
| **Verified partner** | Reviewed, signed | out-of-process/isolated | scoped, contract-typed | platform review + compliance cert |
| **Third-party** | Public developers | **sandboxed (out-of-process/WASM)** | **least-privilege, no raw graph, no regulated data** without certification | manifest review + automated checks |
| **Private / enterprise** | A tenant's own | tenant-scoped, self-signed | tenant-only | tenant-governed, not public |

## 4. Capabilities, permissions, least-privilege (capability-based security + zero trust)
- Plugins **declare** required capabilities and permissions in the **manifest**; the tenant/
  user **grants** them; the kernel **enforces at the PEP**. Default **deny**.
- **Capability-based security:** a plugin holds only unforgeable capability tokens it was
  granted — **no ambient authority.** It cannot name or reach anything it wasn't granted.
- **Zero trust between plugins:** no plugin trusts another; the kernel mediates everything.

## 5. Inter-plugin communication & Memory Graph access
- **Plugins never call each other directly.** Composition is only via (a) kernel **capability
  calls** (subject to grant + PEP) and (b) the **Event Bus** (governed, schema-registered
  events). Direct imports/calls are forbidden — they'd recreate coupling and break the sandbox.
- **Memory Graph:** third-party plugins get **no raw access** — only scoped, contract-typed
  reads/writes through the kernel Memory Interface, subject to **permissible-purpose** (the
  R5 legal model). No plugin ever reads another plugin's private data or another tenant's data.

## 6. Versioning, breaking changes, deprecation, rollout
- **Capabilities are semver'd** (`credit.dispute.create@2`); **back-compat guaranteed within a
  major** (Stripe-style pinned versions — never break a live caller). Breaking change = new
  major + migration guide + a **deprecation window** (K8s API-deprecation-policy style).
- **Kernel runs multiple versions** concurrently; callers pin. **Updates roll out staged/
  canary** with rollback; a bad version is contained and revertible (Borg/K8s rollout).
- **The kernel ABI (Module Contract + ports) is stability-guaranteed — "never break a
  plugin" (Linux's "don't break userspace").** Additive-only; long deprecation windows.

## 7. Billing & entitlement
- Each capability declares its **cost/entitlement class**; the Capability Engine + billing
  **meter usage per capability**; entitlement is enforced at the **PEP before dispatch**
  (a not-entitled call never runs). Metered/paid capabilities settle through the credit
  economy. Third-party revenue share is a future registry concern.

## 8. Trust establishment, sandboxing, revocation, audit
- **Sandboxing (the hard requirement):** on serverless, in-process TS plugins share the
  process and **cannot be trusted for isolation.** Therefore **untrusted (third-party)
  plugins run out-of-process** — an isolated function or a **WASM sandbox** — and reach the
  kernel only via the capability protocol. First-party may run in-process (trusted). **This
  seam is defined now even though v1 ships first-party only** — so third-party slots in with
  no rewrite.
- **Revocation:** the kernel holds a **revocation list**; a compromised plugin's signature is
  revoked → it is **instantly disabled everywhere** (kill switch). Per-plugin + per-tenant.
- **Audit:** every plugin action is audited (who/what/when/evidence/decision), immutable,
  tamper-proof, queryable per plugin — the basis for review and revocation.
- **Rate limits & quotas per plugin/tenant** at the PEP (blast-radius containment; a runaway
  plugin can't degrade the platform — Amazon cell thinking).

## 9. Compliance certification (the deepest rule)
A third-party plugin touching **regulated data** (FCRA credit, GLBA financial, PII) makes the
platform potentially liable for it. Therefore: **third-party plugins may not touch regulated
data without a compliance certification** (a financial-data App-Store-review analog,
counsel-designed). **v1 posture: only first-party/certified plugins touch FCRA data;
third-party plugins are sandboxed away from regulated data** until the certification regime
exists. Permissible-purpose (ADR-0024 R5) is enforced per-plugin, per-capability.

## 10. Lifecycle & forward compatibility
`submit → verify signature + manifest → automated + (tiered) human review → grant permissions
→ activate (flagged, staged) → version/update (canary) → deprecate (window) → revoke/remove`
— every step audited. **Forward compatibility:** the manifest schema is versioned and the
kernel **tolerates unknown manifest fields** (forward-compat); capability/event contracts are
**additive-only** within a major.

## Consequences
- **v1 is first-party only** (Credit as plugin #1), but the **plugin boundary, signing,
  manifest, capability-grant, and out-of-process seam are designed now** so a third-party
  ecosystem is a later *addition*, never a *rewrite*.
- The kernel becomes the enforcement point for signing, permissions, quotas, revocation, and
  compliance — all mechanisms it already owns (Registry, PEP, Audit, Capability Resolution).
- This is what lets CreditVector become the **reference implementation** that proves the
  Kai Kernel can host an entire ecosystem.
