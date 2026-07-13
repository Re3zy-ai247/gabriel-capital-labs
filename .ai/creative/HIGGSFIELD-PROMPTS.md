# Higgsfield Prompt Library (canonical blocks — compose, never freestyle)

Every Kai generation = **reference media + composed blocks**. Text alone never defines Kai; the media does (Character Bible identity hierarchy). Video render recipes/costs stay canonical in AIOS `PROMPT-LIBRARY.md`.

## Generation SOP (binding)
1. Reference media on EVERY call: `CV-KAI-MASTER-001` (once it exists) + 1–2 ground-truth photos (`CV-KAI-REF-*`). Until the master exists, all four photos.
2. Model: reference-image still model (`nano_banana_pro`-class, or `soul_2` if a Kai Soul is later trained — needs 5+ photos and founder ask). Video: per AIOS recipes only.
3. `get_cost: true` preflight → one test render → score (`CONSISTENCY-SCORING.md`) → founder approval → batch.
4. Batch = same model, same blocks, same lighting, master as reference; vary ONLY the `[STATE]` block.
5. Register every accepted render (`../ASSET-REGISTRY.md`): ID, job_id, score, credits spent.

## Blocks

**[IDENTITY]** *(always first; media does the heavy lifting — text reinforces)*
> The exact Shiba Inu from the reference images — preserve the identical face shape, red-orange coat with cream urajiro markings on muzzle, cheeks, brows, chest and inner legs, white paw socks, dark almond eyes, black nose, small forward-tilted triangular ears with cream inner fur, sickle tail with cream underside, and his calm knowing expression. Same individual dog, not a generic Shiba.

**[STYLE]**
> Refined cinematic 3D character render for a premium fintech brand: realistic groomed fur with slightly simplified forms suitable for web animation. Sophisticated, calm, trustworthy. Not cartoonish, not chibi, not plush-toy, not meme-style.

**[LIGHTING-INK]** *(default; alternates in `CINEMATOGRAPHY.md`)*
> Dark navy studio environment, large soft neutral key light from upper left, subtle cyan-teal rim light from behind right tracing the ears, shoulders and tail, gentle fill, soft contact shadow, clean dark gradient background easy to matte out. The lighting tints the environment only — the coat colors stay true.

**[CAMERA]**
> Camera at the dog's seated eye level, 50mm portrait lens rendering, full body in frame occupying about 70% of frame height, centered, paws fully visible, square 1:1 composition, background softly defocused, the dog entirely sharp.

**[STATE-01..08]** *(one per render — canonical wording)*
- 01: > Seated neutral idle: upright calm seated posture facing camera, mouth gently closed with the natural slight smile, ears relaxed-forward, tail curled at rest.
- 02: > Curious head tilt: seated, head tilted about 15 degrees, ears level, eyes on camera, gently interested.
- 03: > Alert ears perk: seated, both ears rotated fully forward, chin lifted slightly, mouth closed, focused attention.
- 04: > Gentle success: seated, relaxed open-mouth smile with tongue slightly visible, tail raised mid-wag, warm and pleased but composed.
- 05 / 06: > Attention left/right: seated body facing camera, head turned about 30 degrees to the [left/right], eyes leading toward something just off-frame at interface height.
- 07: > Subtle paw raise: seated, right forepaw lifted a few centimeters off the ground, weight settled and calm, dignified.
- 08: > Calm thinking: seated, head angled slightly downward, soft unfocused gaze just below camera, quietly contemplative.

**[NEGATIVE]** *(always last)*
> No text, no logos, no clothing, no accessories, no props, no extra objects, no human features or hands, no altered coat colors or markings, no exaggerated cartoon eyes or proportions, no other animals, no watermark.

## Registered prompts
| Prompt ID | Composition | Status | Last use / cost |
|---|---|---|---|
| KAI-P-001 | IDENTITY+STYLE+LIGHTING-INK+CAMERA+STATE-01+NEGATIVE | APPROVED COMPOSITION — awaiting first render (master candidate) | — |
| KAI-P-002..008 | same with STATE-02..08 + master as added reference | blocked on CV-KAI-MASTER-001 approval | — |
