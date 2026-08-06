export const meta = {
  name: 'gcl-r4-final-polish',
  description: 'R4 final polish: replay coherence, watchdog/inert unification, crossing cleanup, tagline consistency — then one confirmation gate',
  phases: [
    { title: 'Fix', detail: 'Sonnet: root-cause rulings, minimal diffs', model: 'sonnet' },
    { title: 'Gate', detail: 'Opus: single merged confirmation gate', model: 'opus' },
  ],
}

const SITE = '/private/tmp/claude-501/-Users-re3zy/b1a3eebd-71bd-4681-8fbe-fedeec4d6c0a/scratchpad/gcl/apps/gabriel-capital-labs-site'
const PW = '/Users/re3zy/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FINDINGS = '/private/tmp/claude-501/-Users-re3zy/b1a3eebd-71bd-4681-8fbe-fedeec4d6c0a/scratchpad/R4-FINAL-FINDINGS.json'

const COMMON = `
CONTEXT: ${SITE}, branch claude/gcl-cinematic-institutional-site-6qx964, R4+R4.1 uncommitted on
0c7f515. Both final gates confirm exceedsR3=TRUE, both R4 blockers dead, LCP 252-352ms (better
than control), axe 0. Remaining: 14 findings in ${FINDINGS} (read fully — evidence + fixes).
Playwright ${PW}, Chrome ${CHROME}, headless, reducedMotion explicit per context. Control =
git archive HEAD. Hard constraints unchanged (Gateway G, mobile, R3 architecture, a11y, perf,
SEO). tsc/lint/build clean. Mark work R4.2. No commit/push/deploy.
`

phase('Fix')

const fix = await agent(
  `You are the R4.2 final-polish engineer. Files you own: components/ArrivalScene.tsx,
app/globals.css, app/layout.tsx. Root-cause RULINGS (binding — these unify the 14 findings):

${COMMON}

R-1 REPLAY = THE TRUE SEQUENCE (kills both HIGH replay findings coherently): a user-initiated
Replay re-applies the SAME state as a first visit — after the awaited scroll-to-top, re-add the
html.gcl-prologue lock, apply inert containment, hide nav AND hide the REPLAY chip itself
(autoAlpha 0) for the sequence duration; skip chip is the one interactive element; Esc works;
awaken releases everything (lock, inert, nav, replay chip restored, focus back per R3). The
incoherent state (inert but scrollable) becomes impossible because replay locks like first visit.
Verify: 3 consecutive replays — during P1 the frame is pure black (no gold chip), page cannot
scroll, Tab reaches only skip, Esc mid-sequence restores everything; after completion the page is
fully interactive with focus on the replay control.

R-2 SINGLE SOURCE OF TRUTH FOR PROLOGUE-ACTIVE (kills the watchdog/inert desync + F15 desync):
ArrivalScene runs the prologue IFF document.documentElement.classList.contains('gcl-prologue')
at mount — never its own recomputed predicate. If the class is absent (watchdog fired on a slow
load, /index.html pathname mismatch, any route without the lock), the scene takes the composed
static path and NEVER applies inert. Additionally: extend both watchdogs to 22s (sequence is
~15.1s — restore the safety margin), and make ArrivalScene's awaken tolerant of the watchdog
having already removed the class. Verify: (a) block the bundle 20s then let it load — page must
be scrollable AND fully interactive, no inert, composed; (b) /index.html direct load — no lock,
no inert, composed; (c) 404.html unaffected.

R-3 CROSSING EXIT LEAVES ZERO DESKTOP RESIDUE: on the 1024px crossing abort, clearProps on
markWrap (kills the 104% scale), atmosphere, signal, and skip chip; the awake atmosphere-breathe
must be scoped in CSS to (min-width:1024px) AND (prefers-reduced-motion: no-preference) — under
reduce the global neutraliser applies (do NOT exempt it; the R2 glow-breathe precedent is in the
freeze list, follow the freeze). Verify: cross mid-P3 to 390 — mark renders native 120x130, zero
animations running, zero desktop inline styles; cross back up — desktop composition correct.

R-4 TAGLINE CONSISTENCY ACROSS ALL PHONES: give .arrival__tagline-line a max-inline-size (ch-
based) + text-wrap:balance so EVERY width 320-430 renders the same balanced two-line composition
(no orphan, never the widest element). Verify at 320/360/375/390/393/412/430.

R-5 SKIP HIERARCHY & FOCUS: (a) skip chip resting state must sit BELOW the gold signal's
luminance in P2 (measure both composited; chip dimmer than signal) while keeping >=3:1 contrast
as a UI control, full weight on hover/focus; (b) the site's "Skip to content" link during the
prologue must WORK: activating it skips the prologue (tl.progress(1,false)) and then performs its
normal jump, no stranded hash-only dead end; (c) Enter on the SKIP chip moves focus to the h1
(tabindex -1), never <body>.

R-6 OVERRUN DISCLOSURE: the 12-16s window is beat-table time; hydration latency can stretch wall
time on slow devices. Do not redesign — measure at 6x CPU throttle and report the number for the
disclosure list.

Self-verify every ruling with measured numbers (build + serve + Playwright, both policies,
control build for parity). Also re-run quickly: mobile pins 0/2, deep-link bypass, seen-path,
Gateway G ancestor chain spot-check, axe both policies. Report per-ruling results.`,
  { model: 'sonnet', label: 'r4.2-polish', effort: 'high' }
)

log('R4.2 fixer done')

phase('Gate')

const GATE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'shippable', 'exceedsR3', 'founderRead', 'findings', 'disclosures'],
  properties: {
    verdict: { type: 'string', enum: ['FOUNDER_READY', 'READY_WITH_DISCLOSURES', 'NOT_READY', 'STOP_DO_NOT_SHIP'] },
    shippable: { type: 'boolean' },
    exceedsR3: { type: 'boolean' },
    founderRead: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'title', 'evidence', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW'] },
          title: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
        },
      },
    },
    disclosures: { type: 'array', items: { type: 'string' } },
  },
}

const gate = await agent(
  `You are the SINGLE FINAL confirmation gate for R4 — both prior gates confirmed exceedsR3=TRUE
and both blockers dead; your job is to confirm the 14 residual findings (${FINDINGS}) are closed
by the R4.2 rulings below WITHOUT new regressions, and issue the shipping verdict. Build and
measure everything yourself (git-archive control). Focus points: replay coherence (all three
states: during, after-complete, after-Esc — page interactivity, focus, scroll); the
watchdog/inert unification under a 20s-delayed bundle; crossing residue (mark native size);
tagline at all 7 phone widths; skip hierarchy vs the gold signal; skip-to-content; plus the
standing invariants (Gateway G chain through the full sequence, mobile pins/pixels, deep links,
seen-path, R3 pull-back parity, axe, LCP element+ms). If everything holds, say
READY_WITH_DISCLOSURES or FOUNDER_READY and give the final consolidated disclosure list for the
Founder report.

${COMMON}

R4.2 FIX REPORT (claims to test): ${fix}`,
  { model: 'opus', label: 'confirmation-gate', phase: 'Gate', effort: 'max', schema: GATE_SCHEMA }
)

log('CONFIRMATION GATE: ' + gate.verdict + ' shippable=' + gate.shippable + ' xR3=' + gate.exceedsR3)
return { fix, gate }
