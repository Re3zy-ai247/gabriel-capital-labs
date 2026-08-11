// Run: npx tsx scripts/cxos-arena.test.ts
//
// SOURCE-LEVEL guard for CXOS Phase 5 — the Arena entry and chamber. Labelled
// as such; the behavioural evidence is the Playwright pass in the Phase 5
// report.
//
// WHAT THIS HOLDS — the frozen ownership constitution, in code:
//   1. Arena RENDERS reputation truth; it never computes or mutates it. No
//      file under components/cxos/arena may import the reputation service's
//      write surface, prisma, or fetch.
//   2. No fabricated metrics: no Math.random, no Date.now-derived numbers, no
//      literal XP values outside the clearly-synthetic review fixtures.
//   3. The gate order is untouchable: the server redirect precedes the entry;
//      the door renders only behind arenaAccessible.
//   4. Honest statuses: the competition aperture is PLANNED and structurally
//      cannot render an open state; REFUSED_V1 stays the source of truth.
//   5. Review isolation: the stage is fixtures-only, banner unconditional,
//      no first-entry consumption in review, production hard-off.
//   6. Entry laws: 7–12 s first / ≤1.5 s returning, tier D mounts nothing,
//      three-way skip, safety fade, focus handoff.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const entry = readFileSync(join(root, "components/cxos/arena/ArenaEntry.tsx"), "utf8");
const chamber = readFileSync(join(root, "components/cxos/arena/ArenaChamber.tsx"), "utf8");
const door = readFileSync(join(root, "components/cxos/arena/ArenaDoor.tsx"), "utf8");
const page = readFileSync(join(root, "app/(rooms)/arena/page.tsx"), "utf8");
const dash = readFileSync(join(root, "app/(rooms)/dashboard/page.tsx"), "utf8");
const stage = readFileSync(join(root, "app/review/arena/stage.tsx"), "utf8");
const stagePage = readFileSync(join(root, "app/review/arena/page.tsx"), "utf8");
const ledger = readFileSync(join(root, "lib/cxos/arenaLedger.ts"), "utf8");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const arenaUi = entry + chamber + door;

// ── 1 · ownership: Arena renders, never owns ─────────────────────────────────
check("no reputation WRITE surface reachable from Arena UI (no service import, no award call)",
  !/reputation\/service|reputation\/repository|awardXp|recordAward|appendAward/.test(arenaUi + page) &&
  !/from "@\/lib\/reputation(?!\/scoring)/.test(page));
check("no prisma / fetch / session mutation in Arena UI components",
  // call forms only — the chamber's own header COMMENT names these words
  !/prisma\.|\bfetch\(|getServerSession\(/.test(arenaUi));
check("the chamber's only policy import is the read-only scoring re-export",
  /from "@\/lib\/arena\/policy"/.test(chamber) && /REFUSED_V1/.test(chamber));

// ── 2 · no fabricated metrics ────────────────────────────────────────────────
check("no random or clock-derived numbers anywhere in Arena UI",
  !/Math\.random|Date\.now|new Date\(/.test(arenaUi));
check("the page hands the entry ONLY loaded truth (props from OwnProgress/standing)",
  /identity=\{cxIdentity\}/.test(page) && /totalXp=\{s\.totalXp\}/.test(page) &&
  /policyVersion=\{p\.policyVersion\}/.test(page));
check("no literal XP number is rendered by the live page or chamber (fixtures live ONLY in the review stage)",
  !/totalXp: \d/.test(page + chamber + entry + door));

// ── 3 · the gate order is untouchable ────────────────────────────────────────
check("the server redirect precedes every Arena surface (entry cannot mask eligibility)",
  page.indexOf("if (!arenaAccessible(user)) redirect(") !== -1 &&
  page.indexOf("if (!arenaAccessible(user)) redirect(") < page.indexOf("<ArenaEntry"));
check("the Mission Control door renders ONLY behind the real server gate",
  /const cxArena = arenaAccessible\(user\) \? await readOwnProgress\(user\.id\) : null;/.test(dash) &&
  /\{cxArena && <ArenaDoor/.test(dash));
check("no teaser for the ungated: no locked-door upsell vocabulary anywhere",
  !/locked|Upgrade to enter|Unlock the Arena|join the waitlist/i.test(dash + door));

// ── 4 · honest statuses ──────────────────────────────────────────────────────
check("the competition aperture is PLANNED and has no open/live branch",
  /PLANNED/.test(chamber) && !/status === "LIVE"|isLive|open === true/.test(chamber) &&
  /REFUSED_V1\.includes\("seasons"\)/.test(chamber));
check("milestone seals render NOTHING when badges are absent (no placeholder seals)",
  /if \(badges\.length === 0\) return null;/.test(chamber));
check("the semantic ledger covers the shipped elements",
  ["Clearance register", "Evidence vault lines", "Ascent line", "Arena reveal ring",
   "Standing ring", "Milestone seals", "Ledger wall", "Competition aperture", "Kai brief",
   "Arena door"].every((e) => ledger.includes(e)) &&
  /reducedMotion:/.test(ledger) && /whenAbsent:/.test(ledger));
check("no 1–5 star / popularity vocabulary anywhere in Arena UI",
  !/\bstars?\b|star rating|popularity|upvote|like count|leaderboard/i.test(arenaUi));

// ── 5 · review isolation ─────────────────────────────────────────────────────
check("stage: fixtures only — no prisma, no session, no fetch, no reputation import",
  !/prisma|getServerSession|currentUser|fetch\(|from "@\/lib\/reputation|from "@\/lib\/arena\//.test(stage));
check("stage: the synthetic banner is unconditional", /SYNTHETIC REVIEW DATA/.test(stage));
check("stage: gated by reviewBuildAllowed", /reviewBuildAllowed\(\)/.test(stagePage));
check("review runs never consume the visitor's first-entry marker",
  /if \(!review\.current\) \{\s*try \{\s*sessionStorage\.setItem\(SESSION_KEY, "1"\)/.test(entry));

// ── 6 · entry laws ───────────────────────────────────────────────────────────
{
  const first = Number((entry.match(/arm\(\(\) => finish\(\), (\d+)\);\n    \} else/) ?? [])[1]);
  const ret = Number((entry.match(/\} else \{\s*arm\(\(\) => finish\(\), (\d+)\)/) ?? [])[1]);
  check("first entry inside the 7–12 s law", first >= 7000 && first <= 12000);
  check("returning entry ≤ 1.5 s", ret > 0 && ret <= 1500);
}
check("tier D mounts nothing", /if \(tier === "D"\) return;/.test(entry));
check("entry: journey-arrival bail (T2 §5) — an in-shell journey that already arrived (sequence > 0) suppresses a stacked returning veil",
  /if \(machine && machine\.state\(\)\.sequence > 0 && variant === "returning"\) \{/.test(entry));
check("entry: reads the OPTIONAL journey hook only — never the hard hook that throws outside a provider",
  /import \{ useOptionalJourneyMachine \} from "@\/components\/transition-runtime\/TransitionRuntimeProvider";/.test(entry) &&
  !/useJourneyMachine\(/.test(entry));
check("three-way skip: Escape + autofocused button + click anywhere",
  /e\.key === "Escape"\) finish\(\)/.test(entry) && /autoFocus/.test(entry) && /onClick=\{finish\}/.test(entry));
check("the 12 s pure-CSS safety fade covers the Arena veil",
  /\.cx-ar-veil \{[\s\S]{0,400}cx-mc-safety 0\.5s ease 12s forwards/.test(css));
check("reduced-motion CSS backstop covers the Arena veil",
  /\.cx-ar-veil \{ animation: none !important; display: none !important; \}/.test(css));
check("focus lands on the room's heading after the dissolve",
  /querySelector<HTMLElement>\("main h1, h1"\)/.test(entry));
check("accessible dialog naming its escape hatch",
  /role="dialog"/.test(entry) && /Press Escape to skip/.test(entry));

console.log(`\ncxos-arena.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
