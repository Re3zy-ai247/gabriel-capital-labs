# Character Consistency Scoring System (the acceptance gate)

Every render is scored by the Creative Director (Claude) **against the ground-truth photos** (never against prior renders — that's how drift compounds) before it may be shown as a candidate, registered, or used. Founder approval is a separate, final step for canonical/public assets.

## Rubric — five axes, 1–5 each (25 max)
| Axis | 5 | 3 | 1 |
|---|---|---|---|
| **A. Facial identity** | Unmistakably Kai: markings, eye shape/color, muzzle blaze, ear set all match refs | Recognizable Shiba, 1–2 marking errors | Generic Shiba / wrong dog |
| **B. Personality** | Calm-confident-friendly strategist energy; expression matches the requested state | Right state, slightly off energy (too goofy/too stern) | Cartoonish, aggressive, or lifeless |
| **C. Lighting** | Exact bible setup (key/rim geometry, navy environment, true coat) | Right mood, wrong geometry or weak rim | Wrong setup / color cast on fur |
| **D. Pose & render quality** | Clean silhouette, correct anatomy, matte-friendly, state reads instantly | Usable with minor cleanup | Artifacts, anatomy errors, unusable edges |
| **E. Brand consistency** | Style lock + hard locks fully honored; sits naturally next to product UI | Minor drift (fur too stylized / too photoreal) | Any hard-lock violation |

## Acceptance thresholds
- **Canonical assets** (master, the 8 states, anything public): total ≥ **22/25**, **A = 5 mandatory**, no axis < 4, zero hard-lock violations.
- **Internal drafts/explorations:** total ≥ 18, A ≥ 4.
- **Automatic rejection regardless of score:** any Character-Bible hard lock violated (clothing, altered coat, text, human features, breed drift).

## Procedure
1. Score against `CV-KAI-REF-*` photos with the rubric; record all five axis scores + one-line rationale each.
2. Fail → diagnose which block caused it (identity refs? lighting block? model choice?) → adjust per the prompt library SOP → retake. Two consecutive fails on the same state → stop and reassess model/approach before spending more credits (don't brute-force).
3. Pass → present to founder with scores + cost; on approval, register in `../ASSET-REGISTRY.md` (`CV-KAI-*` ID, job_id, score, credits).
4. Batch drift check: when a batch completes, re-score 2 random accepted states side-by-side against the master; drift → the batch anchor was weak, re-anchor before the next batch.

Scores are recorded in the asset-registry entry — the registry is the single history of what passed and what it cost.
