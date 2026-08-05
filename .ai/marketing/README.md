# Marketing OS (CVIOS department)

Owner: CMO (`../executive/ChiefMarketingOfficer.md`). Drafting arms: `/gcl-content` (content) + `/gcl-research` (cited research) + `/gcl-leadgen` (B2B). **Iron rules:** every asset passes the CROA bar (draft 🟢 → CCO pass → founder approves publish 🟡) · check `CAMPAIGN-LIBRARY.md` + `../ASSET-REGISTRY.md` before creating ANY new asset · every asset becomes reusable (registry entry) · voice per `BRAND-VOICE.md`.

## Channel map
| Channel | Status | Notes |
|---|---|---|
| Website/landing | ✅ LIVE | `app/page.tsx` — compliance-reviewed copy is the approved-language baseline |
| Brief (owned media) | ✅ LIVE | the content engine's spine — official-source news, human-published |
| Email newsletter | 🟡 BUILT, verification-gated | weekly digest — Founder legal identity resolved in local source; deployment + received test pending |
| Web Push | ✅ LIVE | product alerts today; marketing use needs CCO pass |
| SEO / Blog | ❌ post-launch | Brief articles already carry per-article SEO/OG metadata — extend, don't rebuild |
| YouTube | ❌ planned | 60s master ad rendered (see library); channel not launched |
| Instagram / TikTok / X / LinkedIn / Facebook | ❌ planned | repurposing targets — feed from Brief + ad kit; posting is 🟡 per post |
| Lead magnets / case studies / UGC | ❌ planned | case studies + UGC need consent + CCO ("results aren't typical" framing mandatory) |

## Content engine (repurposing-first)
One source asset → many formats: Brief article → social caption (`socialCaption` already generated + scrubbed) → carousel → short-video script → newsletter item. Never write channel content from scratch when a scrubbed source exists upstream. Calendar convention: anchor on the Brief cadence (daily ingest, weekly digest); a real calendar file gets created when there's a real schedule to put in it — not before.

## External asset homes (canonical — do NOT copy into the repo)
- **Ad kit & renders:** `~/Documents/CreditVector-Ad-Assets/` (`AD-BUILD-KIT.md` = 60s timeline; `render.sh` reproducible)
- **Video prompt recipes & costs:** AIOS `PROMPT-LIBRARY.md` (Kling Pro ≈2,764 credits/8s; AI can't render text/logos — composite in post)
- **Brand source files:** `~/Documents/CreditVector-Branding/` + repo `public/`

## SOPs
1. **Publish anything:** draft → `/compliance-review` → founder approval → post → log in `CAMPAIGN-LIBRARY.md`.
2. **Paid generation:** ALL visual/video generation now runs through the Creative OS (`../creative/README.md`, ADR-0008): registry check → composed prompt blocks → cost preflight → test render → consistency score → founder approval → register cost.
3. **Claims:** educational framing only; no outcome promises; testimonials need "results aren't typical."
