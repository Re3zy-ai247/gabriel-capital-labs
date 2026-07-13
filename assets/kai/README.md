# /assets/kai — the Kai asset library (source of record for files)

Governance split (one canonical source each): **approval + scoring** = `.ai/ASSET-REGISTRY.md` (Creative OS gate, ADR-0008) · **file-level version ledger** = `manifest.json` here · **identity law** = `.ai/creative/KAI-CHARACTER-BIBLE.md`. Product-served copies live in `public/kai/` (optimized web exports) — this tree holds masters.

## Folders
`master/` the canonical render lineage (kai-master-v1.png → v2 → …) · `renders/` scored working renders (pre-approval) · `expressions/` the Kai-State stills (naming: `Kai-<State>-v<N>.png`, e.g. `Kai-Concerned-v1.png`) · `animations/` sprite sheets + Lottie/overlay layers (blink, tail) · `marketing/` approved campaign exports · `landing-page/` web-optimized hero/section exports · `social/` per-channel crops · `youtube/` thumbnails/end-cards · `holograms/` projection-scene renders.

## Laws (enforced by `scripts/kai-manifest.test.ts`)
1. **Never overwrite a canonical render.** A canonical file is immutable; improvement = a NEW version file + a new manifest entry.
2. **Every non-v1 render references its `parentVersion`.** Kai evolves through versioning, never replacement — the lineage is auditable back to v1.
3. **Every approved render gets a manifest entry** with: Version · Date · Prompt · Generator · Credits · Lighting · Camera · Expression · Pose · Approved by · Canonical (true/false) (+ id, parentVersion, file, status, notes).
4. Canonical entries require `approvedBy` (founder) and a recorded score in `.ai/ASSET-REGISTRY.md`.
5. Files never land here without their manifest entry landing in the same commit.
