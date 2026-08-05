# CX2 Route Map — the Founder Review Surface

| Route | What it is | Notes |
|---|---|---|
| **`/review/cxos`** | **THE ENTRY POINT — the Founder Walkthrough** | Synthetic banner · persona toggle (Returning 6 steps / New visitor 8) · BEGIN · room index · progress rail with Next/Prev/Replay/Restart · CinematicToggle in the More panel |
| `/review/cxos?persona=returning&step=N` | Deep link to any returning-operator step (1 Arrival · 2 Mission Boot · 3 Mission Control · 4 THE PASSAGE · 5 Arena · 6 Agency HQ) | Refresh-recoverable; back/forward step-by-step |
| `/review/cxos?persona=new&step=N` | New-visitor steps (1 Landing chapters · 2 Simulated sign-in · 3–8 the same spine) | The sign-in beat is labeled theater — no form, no inputs |
| `/review` | The review index — all seven rooms, walkthrough first | Direct regression access |
| `/review/agency-command` | Agency Headquarters facility (RC2, ACCEPTED) — 7 chambers, ambient runtime, Director panel | Cinematic default; only real reduced-motion downgrades it |
| `/review/mission-control` | Mission Control review stage | |
| `/review/mission-control-to-arena` | THE PASSAGE | Frozen 11.8s journey |
| `/review/threshold` | The Threshold arrival | Frozen 10s; plays fully on real GPUs |
| `/review/landing` | The Landing Journey chapters | |
| `/review/arena` | Arena entry + chamber | |
| `/` (landing) | Production landing with Threshold arrival + chapters (from CX) | Public surface; unchanged by CX2 |

Gate: every `/review/*` route hard-offs in production via `reviewBuildAllowed()` (server-authoritative, double-checked) — preview and local only.
