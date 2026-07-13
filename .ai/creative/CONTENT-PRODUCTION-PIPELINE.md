# Content Production Pipeline (the studio's assembly line)

Extends `README.md` §pipeline (asset-level gates) to full productions (episodes, ads, films). Goal: produce YouTube/TikTok/Instagram/ads/commercials/launch films **without reinventing creative direction** — direction lives in the bibles; production fills slots. Every stage is deterministic; every artifact is versioned; every reuse is free.

## Roles
| Role | Held by | Does |
|---|---|---|
| Creative Director | Claude (in-session) | composes from bibles, scores, assembles briefs/boards/scripts |
| Rendering studio | Higgsfield (connector) | executes composed prompts only |
| Editorial/compliance gate | `/compliance-review` (CCO) | scripts + boards before spend; publish pass |
| Final approval & publish | Founder (🟡) | every public asset, every canonical asset |
| System of record | git (this repo) + `../ASSET-REGISTRY.md` / `../marketing/CAMPAIGN-LIBRARY.md` | versions + inventory |

## The line (every production, same 9 stations)
1. **Brief** — series template (`MEDIA-OS.md`) or storyboard (`STORYBOARDS.md`); one paragraph: audience, beat, channel, deadline.
2. **Script** — REY-KAI-DYNAMIC patterns + FOUNDER-STORY pillars; clip beats marked for repurposing.
3. **Compliance gate #1** — script/board level, before any credit is spent.
4. **Asset pull** — registry first (`CV-KAI-*` states, panel comps, UI captures, music beds, prior renders). The registry is the backlot; check it like Pixar checks the model library.
5. **Render (only the gaps)** — composed prompts (`HIGGSFIELD-PROMPTS.md` blocks; video recipes in AIOS `PROMPT-LIBRARY.md`); cost preflight; test-before-batch; consistency scoring (`CONSISTENCY-SCORING.md`) on every Kai frame set.
6. **Assemble & cut** — CINEMATIC-BIBLE grammar; 16:9 master, 9:16 derivative; reproducible edit scripts where possible (the CAMP-001 `render.sh` precedent — an edit that can't be re-run is a liability).
7. **Founder approval** — screening cut + scores + total cost.
8. **Publish + register** — channel post (🟡 executed by founder or on founder's explicit go), entry in CAMPAIGN-LIBRARY (episode #, assets used, credits spent, links).
9. **Retro** — what got reused vs re-rendered; new reusable assets promoted into the registry; template friction fixed in the template (never worked around silently).

## Version control
Scripts, boards, prompts, bibles: **git, in this repo** — amendments are commits, reviewable like code. Binary renders: Higgsfield/asset storage, referenced by registry ID + job_id (never loose files with no registry row). Bible changes follow the permanence rules (founder-gated for character canon).

## Future stack (flagged, NOT enabled — each requires founder decision + gates)
| Capability | Status | Gates before first use |
|---|---|---|
| **Rey voice cloning** | FUTURE | Founder's explicit written consent + secure custody of the voice model (treat like a credential: never in prompts/repo) + per-script founder approval of every cloned line + disclosure policy decision (CLO). Never clone anyone else. |
| **Lip sync / Rey avatar** | FUTURE | Same consent + disclosure regime; hybrid law extends: real Rey footage preferred, synthetic Rey is a deliberate, labeled choice. |
| **Kai voice** | FUTURE, default NO | v1 canon: Kai is silent (CINEMATIC-BIBLE §sound). Giving Kai a voice is a bible amendment — founder-level brand decision, not a production convenience. |
| **Long-form AI video (full scenes)** | MATURING | Adopt per-recipe via AIOS PROMPT-LIBRARY as models earn it; consistency scoring applies frame-set-wide; hybrid law (real UI, real logos) is permanent regardless of model quality. |

## Token & credit economics of the pipeline
Direction is pre-computed (the bibles) → sessions spend tokens filling slots, not re-deriving style. Renders are pooled (registry) → credits buy NEW frames only. The deterministic scoring rubric kills taste-debates → fewer retakes. KPI: reuse ratio (assets pulled ÷ assets rendered) per production — should climb every quarter.
