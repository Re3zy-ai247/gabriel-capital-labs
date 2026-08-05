# CreditVector Growth Experience Phase 1B — Mobile Handoff Delivery RC1

Status: **BLOCKED — VERCEL PREVIEW TOOLBAR MUTATES EVERY HTML ATTACHMENT**  
Prepared: **2026-07-31**  
Decision: **DO NOT BEGIN THE FOUNDER PHYSICAL-DEVICE TEST YET**

## Executive outcome

The original mobile handoff defect was verified and corrected for ZIP, TXT, Markdown, and manifest files: the new protected delivery page uses ordinary anchors to real server endpoints, every endpoint returns `Content-Disposition: attachment`, and authenticated ZIP/TXT retrieval is byte-identical to its authoritative sanitized local artifact.

RC1 cannot be declared complete because Vercel appends a 163-byte Preview Toolbar loader to every authenticated `text/html` attachment. All six HTML endpoints still return HTTP 200, the correct MIME type, and the correct attachment filename; the transport-equivalent browser test also emitted a native download event. Their retrieved bytes nevertheless differ from the authoritative sanitized local files and their responses omit `Content-Length`. That triggers the Founder's explicit stop condition.

No production deployment, product change, environment change, project-setting change, public exposure, dependency change, commit, Phase 1C work, or economic implementation was performed.

## Canonical status boundaries

- **CGN ECONOMIC PHASE 1A — BLOCKED**
- **GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW**
- **GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK**
- Founder Economic Decision Matrix: **UNRATIFIED**
- Live economics: **NO-GO**
- Phase 1C: **NOT AUTHORIZED**

## Root cause of the prior mobile failure

The prior handoff displayed links to artifacts on the local Mac workspace. Those links did not resolve to an authenticated HTTP file endpoint on Android and therefore could not place a real file in Android Downloads. There was no authoritative server response carrying `Content-Disposition: attachment`.

| Candidate cause | Finding |
|---|---|
| Missing `Content-Disposition` | **VERIFIED CONTRIBUTOR** — no real remote artifact response existed. |
| Inline `Content-Type` behavior | **NOT THE PRIOR ROOT CAUSE** — there was no remote response to classify. |
| Authentication redirect loop | **RULED OUT FOR RC1** — the signed-in browser reached the delivery page and emitted download events. |
| In-app browser restriction | **NOT PROVEN AS THE PRIOR CAUSE** — physical Android placement remains untested. |
| Broken or relative link | **VERIFIED** — prior links were local-workspace references unavailable to the phone. |
| Client-generated pseudo-download | **RULED OUT** — prior handoff was not a valid server download; RC1 uses no Blob/data URL. |
| Other verified cause | **LOCAL-ONLY DELIVERY ARCHITECTURE** — artifacts were not served from protected attachment endpoints. |

## Current platform blocker

Vercel enables its Toolbar on Preview deployments and injects a loader into HTML responses. An authenticated retrieval showed the exact mutation after the authoritative final newline:

`<script ... src="https://vercel.live/_next-live/feedback/feedback.js"></script>`

The injected fragment is 163 bytes. It appears on all six HTML downloads, changes every HTML SHA-256, introduces an external script reference, and removes `Content-Length` from those responses.

Tested in-scope mitigations did not solve the platform mutation:

- `Content-Disposition: attachment` — preserved, but did not prevent injection.
- strict CSP and `X-Content-Type-Options: nosniff` — preserved, but did not prevent injection.
- response `X-Vercel-Skip-Toolbar: 1` in a superseded diagnostic — Vercel requires this as an incoming request control.
- gzip content encoding — Vercel decoded, injected, and re-encoded the HTML.
- a closed Routing Middleware scoped to the six exact HTML paths in superseded diagnostic deployment `dpl_5KHug1NtSfgUtx6iyjh1FZ9jNH2A` — too late in Vercel's request lifecycle to suppress platform injection. The ineffective middleware was removed; the final candidate below is static-only.

Vercel documents two applicable controls: send `x-vercel-skip-toolbar` on the incoming client request, or disable the Toolbar for a branch/project through Vercel configuration. Ordinary Android anchors cannot add custom request headers, and environment/project-setting changes were explicitly outside this authorization.

## Delivery coordinates

- Protected delivery page: `https://gabriel-capital-labs-g395eeqvi-rey-gabriel-s-projects.vercel.app/`
- Direct ZIP: `https://gabriel-capital-labs-g395eeqvi-rey-gabriel-s-projects.vercel.app/downloads/GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_PACKAGE.zip`
- Direct HTML: `https://gabriel-capital-labs-g395eeqvi-rey-gabriel-s-projects.vercel.app/downloads/GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_HANDOFF.html`
- Direct TXT: `https://gabriel-capital-labs-g395eeqvi-rey-gabriel-s-projects.vercel.app/downloads/GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_HANDOFF.txt`
- Deployment ID: `dpl_6LgrDW4ZSsCXiyrWKJRwSzL9QKW6`
- Deployment target: **Preview**
- Deployment state: **READY, but RC1 release acceptance BLOCKED**
- Production: **NOT DEPLOYED**

The immutable deployment URL above is authoritative. Vercel automatically assigned its normal CLI Preview alias; no explicit alias, promotion, or production command was run.

## Authoritative sanitized artifact ledger

| Artifact | Bytes | MIME | Authoritative local SHA-256 |
|---|---:|---|---|
| `GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_PACKAGE.zip` | 93,059 | `application/zip` | `f85b5a8cbfa9894710039f3ea6f02d6bd93a5a31d97e43cfbc1c7b3bd903a9fb` |
| `GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_HANDOFF.html` | 56,369 | `text/html; charset=utf-8` | `a3173e2bf9e17938087a71a5d9b44f3e660fac3c973956badc0bffc8d195d494` |
| `GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_HANDOFF.txt` | 19,105 | `text/plain; charset=utf-8` | `4c4dfced8ca6c29a7fb230c98d039482f1016d42e55fb3ec18b110bdd8bdd6ec` |
| `GROWTH_EXPERIENCE_PHASE_1B_CAPABILITY_CONTRACT.html` | 76,627 | `text/html; charset=utf-8` | `ac346d843ad49bba9c23805d45fd74fcf87a7836eaf467f712d93900ac050553` |
| `GROWTH_EXPERIENCE_PHASE_1B_CAPABILITY_CONTRACT.md` | 28,814 | `text/markdown; charset=utf-8` | `7c367d39e63ee37e1e185c81145f8099b3958923c4ca492eedc0de016947eee5` |
| `GROWTH_EXPERIENCE_PHASE_1B_ARCHITECTURE.html` | 62,850 | `text/html; charset=utf-8` | `2154c2e98fb501338c1837b87179da4420a2ce20b8bdd3b255ffa522b26c698c` |
| `GROWTH_EXPERIENCE_PHASE_1B_PRODUCT_SPECIFICATION.html` | 69,556 | `text/html; charset=utf-8` | `dbf3864fbe70e51463ffd9aa4283c0abf43c8a8f91d21ac616940546889e8508` |
| `GROWTH_EXPERIENCE_PHASE_1B_VALIDATION_LEDGER.html` | 10,123 | `text/html; charset=utf-8` | `34762271069990091387d41d6fe9a35b2a50854584cb29d83c3f5752121a2198` |
| `GROWTH_EXPERIENCE_PHASE_1B_BROWSER_MATRIX.html` | 6,892 | `text/html; charset=utf-8` | `35c8e9e2dcd099bc1b682111c1970e94be1b2e9031b67686f93dd95fbc3c87b2` |
| `GROWTH_EXPERIENCE_PHASE_1B_EVIDENCE_MANIFEST.txt` | 1,159 | `text/plain; charset=utf-8` | `c9e455abd6e11c1c912672974fc83def317541c4d0133a45784440cb922366d7` |

## Authenticated HTTP evidence

All ten direct endpoints returned authenticated HTTP 200 with their exact required `Content-Type` and:

`Content-Disposition: attachment; filename="<EXACT_FILENAME>"; filename*=UTF-8''<EXACT_FILENAME>`

| Artifact class | HTTP | Attachment | Content length | Byte identity |
|---|---:|---|---|---|
| ZIP | 200 | PASS | 93,059 | **PASS** |
| TXT handoff | 200 | PASS | 19,105 | **PASS** |
| Markdown contract | 200 | PASS | 28,814 | **PASS** |
| TXT evidence manifest | 200 | PASS | 1,159 | **PASS** |
| Six HTML artifacts | 200 | PASS | **ABSENT** | **FAIL — each +163 bytes** |

Remote HTML mutations:

| HTML artifact | Local bytes | Remote bytes | Remote SHA-256 |
|---|---:|---:|---|
| Founder Handoff | 56,369 | 56,532 | `3755ebde536edacd3f089f3291c630a654ece9b28e21dd89fab43f6ace70ba92` |
| Capability Contract | 76,627 | 76,790 | `78f4bbf6622f4ccabc531e8e5e203380faf018ffba1b94adee6e1efa49dc4341` |
| Architecture | 62,850 | 63,013 | `afe346facc0cdcc91832b0889462841a547c2825a9417e8118225ff0edc25a13` |
| Product Specification | 69,556 | 69,719 | `075e4fb43e1b546e3ee6d5b8446ad77a092c93a7b312b56bf2514613557174b0` |
| Validation Ledger | 10,123 | 10,286 | `256596bdbceb9142d4bdf8b206bf81773008040d7d765e17263563d73eec881a` |
| Browser Matrix | 6,892 | 7,055 | `e8f533fd75711e14f0b9e74bff7e507cf370c916f6da1914454f5c84b62e5563` |

## Protection evidence

- Anonymous GET to the delivery page: **302 to Vercel Authentication**, 15-byte protection response.
- Anonymous GET to each of the ten direct endpoints: **302**, no artifact bytes exposed.
- Final static-only deployment authenticated GET: **HTTP 200**, correct delivery-page body, no authentication redirect.
- On the superseded diagnostic deployment with the same page, artifacts, and response headers, a signed-in in-app browser loaded without a loop.
- That signed-in browser at 390 × 844 emitted native download events for ZIP, HTML, and TXT; the page URL/history remained stable. The removed middleware produced no observable transport benefit.
- Deployment protection did not block attachment handling after authentication.
- Protection cannot prevent the later Vercel Toolbar mutation of HTML bytes.

## Automated mobile acceptance

Local acceptance exercised the exact generated Build Output response policy with Android mobile emulation.

| Viewport | Coarse/touch | Horizontal overflow | Minimum visible control | ZIP event/hash | Console/page errors |
|---|---|---|---|---|---|
| 390 × 844 | PASS | 0 px | 48.8 px high | PASS | 0 |
| 360 × 800 | PASS | 0 px | 48.8 px high | PASS | 0 |
| 320 × 800 | PASS | 0 px | 48.8 px high | PASS | 0 |

Additional local evidence:

- HTML and TXT downloaded as files at 390 × 844 with correct suggested filenames and authoritative hashes.
- JavaScript-disabled ZIP download event: PASS.
- Reduced motion: requested, zero running animations, primary download visible.
- Keyboard and visible focus: PASS.
- Axe WCAG A/AA sample: zero violations.
- Browser Back/history safety: attachment clicks did not navigate or add history.
- External network requests: zero.
- Console warnings/errors and page errors: zero.
- Delivery-owned local/session storage, cookies, and service workers: zero.
- POST returned 405 with `Allow: GET, HEAD`.

Remote browser evidence on the superseded, transport-equivalent diagnostic proves the authenticated browser download events. Authenticated HTTP evidence on the final static deployment proves the final response policy and bytes. Neither proves that Android physically placed a file in Files → Downloads.

## Automated proof versus physical Android proof

**A. Verified automatically**

- real protected server endpoints;
- anonymous protection redirect;
- authenticated page without a loop;
- HTTP 200 and attachment headers;
- correct ZIP/TXT/MD/manifest filenames, lengths, sizes, and hashes;
- ZIP/HTML/TXT native browser download events;
- mobile layout, focus, Axe, reduced motion, console, history, and no-write behavior.

**B. Still requires the Founder on a physical Android device**

- the Android operating system places the downloaded file in Files → Downloads;
- the downloaded ZIP is selectable through ChatGPT's attachment picker;
- ChatGPT uploads the selected ZIP successfully.

Because HTML byte identity is blocked, the physical-device check should wait for a separately authorized Toolbar/hosting resolution.

## Founder physical-device checklist

1. Open the protected mobile delivery page.
2. Sign in to Vercel if prompted.
3. Tap “Download Complete Founder ZIP Package.”
4. If the in-app browser does not show a download, tap “Open in Chrome.”
5. In Chrome, tap the ZIP download again.
6. Open Android Files.
7. Open Downloads.
8. Confirm:
   GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_PACKAGE.zip
9. Return to ChatGPT.
10. Tap the attachment button.
11. Choose Files.
12. Select the downloaded ZIP.
13. Upload it into the conversation.

## ZIP integrity and hash history

The original package remains unchanged:

- Original path artifact SHA-256: `c3e6d3595945af18f63dafd87e5d681a863b3534663d6c5b2c42b7cd8ae77e88`
- Original size: 1,044,513 bytes
- Original archive integrity: PASS
- Distribution safety: FAIL — it contained local workspace/OS-username traces and non-curated internal/evidence members.

The sanitized RC1 package is intentionally byte-different:

- Final SHA-256: `f85b5a8cbfa9894710039f3ea6f02d6bd93a5a31d97e43cfbc1c7b3bd903a9fb`
- Final size: 93,059 bytes
- Members: exactly nine flat, human-readable Founder artifacts
- Archive test: PASS
- Member parity with sanitized local files: PASS
- Symlinks, traversal, encryption, extra fields, macOS metadata: absent

Byte-level reasons for the changed ZIP:

1. Twenty-four non-curated source, screenshot, and private-evidence members were excluded (33 members reduced to nine).
2. Seventy-two occurrences of the absolute workspace path—which also contained the OS username—were removed from distributed text.
3. The prior Vercel account-slug URL was redacted from distributed artifacts.
4. Validation and browser evidence Markdown were rendered into standalone HTML.
5. The product-specification filename was normalized for the Founder-facing package.
6. The evidence manifest, CRCs, compression stream, central directory, and fixed metadata were regenerated from the sanitized bytes.

## Security and production-safety review

- Sanitized artifact secret/credential/env/PII/path/username scans: PASS.
- ZIP member allowlist, regular-file modes, metadata, and traversal checks: PASS.
- Standalone HTML external-asset scan before deployment: PASS.
- Shared dirty worktree was not uploaded or deployed wholesale.
- Curated final deployment input: one local Vercel project link, one routing config, and eleven static files.
- Final deployment contains no function, middleware, server runtime, dependency, or product source file.
- A no-benefit Edge middleware used only in superseded diagnostic deployment `dpl_5KHug1NtSfgUtx6iyjh1FZ9jNH2A` was removed before the final static deployment.
- No schema, Prisma, migration, API belonging to the product, billing, Stripe, tax, ledger, payout, Marketplace, Community, Identity, Organization, Mission Control, Agency Command, Arena, or Growth Center product code changed.
- No production deployment or production alias promotion occurred.
- No dependency or lockfile changed.
- No commit was created.
- The Vercel Toolbar mutation means the remotely retrieved HTML is not standalone and therefore remains release-blocking.

## Validation ledger

| # | Required validation | Result |
|---:|---|---|
| 1 | Artifact existence/nonzero | PASS |
| 2 | SHA-256 for each artifact | PASS locally |
| 3 | ZIP archive test | PASS |
| 4 | ZIP member allowlist | PASS |
| 5 | Secret scan | PASS |
| 6 | PII scan | PASS |
| 7 | Absolute local-path scan | PASS |
| 8 | Username scan | PASS |
| 9 | Standalone HTML external-resource scan | PASS locally |
| 10 | HTML source/integrity parity | **FAIL remotely: +163 bytes each** |
| 11 | Correct MIME | PASS |
| 12 | Correct attachment disposition | PASS |
| 13 | Correct filename | PASS |
| 14 | Authenticated HTTP 200 | PASS, 10/10 |
| 15 | Anonymous protection redirect | PASS, page + 10/10 endpoints |
| 16 | No authentication loop | PASS |
| 17 | Mobile download-event verification | PASS for ZIP/HTML/TXT |
| 18 | Byte-identical authenticated retrieval | **FAIL: 4/10 pass, 6 HTML fail** |
| 19 | Zero horizontal overflow | PASS, 3/3 |
| 20 | 44 px minimum controls | PASS, 3/3 |
| 21 | Keyboard/focus | PASS |
| 22 | Axe sample | PASS, zero violations |
| 23 | Reduced-motion usability | PASS |
| 24 | Console errors/warnings | PASS, zero |
| 25 | Production safety/no write | PASS |
| 26 | Deployment identity/release binding | PASS for evidence; release remains BLOCKED |

Scoped ESLint: **PASS**.  
Repository typecheck: **BLOCKED BY PRE-EXISTING SHARED-WORKTREE PRISMA CLIENT DRIFT** at `lib/terms.ts:57` and `lib/terms.ts:76` (`termsAcceptance` missing); no RC1 file produced a type diagnostic.  
`git diff --check`: **PASS**.

## Repository/worktree truth

- Local repository: `/Users/re3zy/Documents/gabriel-capital-labs-to-upload`
- Branch: `feat/cxos-phase3`
- Baseline HEAD: `a40a41c5a76028ad5cae2ff655c5bf168fb86a4a`
- Phase 1B commit: **NONE**
- RC1 commit: **NONE**
- Phase 1B and RC1 files: **local and uncommitted**
- Shared worktree: **DIRTY with parallel-stream changes**
- The baseline SHA does not contain Phase 1B or RC1.
- No source commit or wholesale shared-worktree deployment occurred.
- The existing protected Growth Center product Preview and its immutable deployment remain distinct from this documentation-only delivery candidate.

## Required unblock decision

Do not weaken Deployment Protection and do not ship a MIME lie or JavaScript pseudo-download. A new, explicit delivery-infrastructure authorization is required for one of:

1. disable the Vercel Toolbar for this isolated delivery Preview at the project/branch level, then redeploy and repeat all ten authenticated byte checks; or
2. provision a separate protected documentation host/project whose HTML responses are not rewritten, then repeat protection and mobile acceptance.

Neither option authorizes production, Phase 1C, participant data, product integration, runtime AI, commerce, billing, payouts, or economics.

## Final RC1 disposition

**BLOCKED — AUTHENTICATED ZIP AND TXT ATTACHMENT DOWNLOADS VERIFIED; ALL SIX HTML ATTACHMENTS ARE MUTATED BY VERCEL PREVIEW TOOLBAR INJECTION; FOUNDER PHYSICAL-DEVICE TEST NOT YET AUTHORIZED.**
