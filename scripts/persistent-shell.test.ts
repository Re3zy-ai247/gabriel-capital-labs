// Run: npx tsx scripts/persistent-shell.test.ts
//
// GUARD for the T2 persistent shell (T2-SPEC.md §9, items 1-9, implemented
// here in that exact numbered order — this file's own section banners match
// the spec's numbering verbatim, never renumbered). W3-owned (T2-SPEC.md §8).
//
// CONCURRENCY NOTE: T2 has three writers landing on the same worktree at
// once (W1 shell, W2 migration, W3 — this file). Several assertions below
// depend on files W1/W2 own that may not exist yet at the moment this guard
// happens to run. Rather than crash (a bare `readFileSync` ENOENT would take
// the whole suite down and report nothing), every such dependency is
// existence-checked first: missing ⇒ the assertion is counted as PENDING
// (a distinct bucket from FAIL) and named after exactly what it's blocked
// on, so a partial run still reports something actionable. PENDING still
// keeps the suite non-green (exit 1) — spec §10 requires ALL guard suites
// actually green before the Founder gate, and "blocked on a concurrent
// writer" is not yet "green" — but it is not a defect either, and the
// console output says which bucket every assertion landed in.
//
// WHAT THIS HOLDS (T2-SPEC.md §9):
//   1. Zero <AppShell under app/(rooms)/ (pages AND loading files).
//   2. app/(rooms)/layout.tsx exists, renders RoomsShell, calls reviewBuildAllowed().
//   3. RoomsShell DOM-order pins + id="main" + pb-24 + KaiPresence offset cross-check.
//   4. Registry ⇄ filesystem consistency.
//   5. Hook cadence pins ([pathname] deps + clearAdminContextCache wiring).
//   6. Ambient luminance contract (GxlField.tsx / AmbientGrid.tsx alpha ceilings).
//   7. Sidebar interception (useOptionalJourneyMachine + gated preventDefault).
//   8. Isolation gate (git diff vs 1698e2b ⊆ the T2 allowlist).
//   9. T1 freeze (machine/pacing/types/TravelLayer/RoomReady/demo segment byte-identical).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const repoRoot = join(__dirname, "..");

let pass = 0;
let fail = 0;
let pending = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}
/** A dependency owned by another T2 writer hasn't landed yet — not a defect. */
function pendingCheck(label: string, blocker: string) {
  pending++;
  console.error(`PENDING (blocked on ${blocker}): ${label}`);
}
function tryReadRepoFile(relPath: string): string | null {
  const full = join(repoRoot, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}
function runGit(args: string): string | null {
  try {
    // --no-pager: never let a pager intercept output in an unusual environment.
    return execSync(`git --no-pager ${args}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}
function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}
const rel = (p: string) => p.replace(repoRoot + "/", "");
/** T1 precedent (scripts/transition-runtime.test.ts): strip comments before
 * any order/index-based textual analysis, so a descriptive comment that
 * happens to mention a marker string (e.g. a header comment documenting
 * `id="main"`, or a fix comment narrating "router.refresh()'s re-render")
 * can never masquerade as the real code position. Pure substring/regex
 * `.test()` checks elsewhere in this file don't need this — only the checks
 * that compare WHERE things happen relative to each other. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── 1 · zero <AppShell under app/(rooms)/ (pages AND loading files) ───────
{
  const roomsDir = join(repoRoot, "app/(rooms)");
  const allFiles = walkFiles(roomsDir);
  const pageAndLoading = allFiles.filter((f) => /(^|\/)(page|loading)\.tsx$/.test(f));
  check("app/(rooms)/ exists and contains at least one page.tsx", existsSync(roomsDir) && pageAndLoading.some((f) => f.endsWith("page.tsx")));
  const offenders = pageAndLoading.filter((f) => /<AppShell\b/.test(readFileSync(f, "utf8")));
  check(
    `zero <AppShell usages across every app/(rooms)/ page.tsx and loading.tsx (${pageAndLoading.length} files scanned)`,
    offenders.length === 0,
  );
  if (offenders.length) {
    console.error("  <AppShell offenders:");
    for (const f of offenders) console.error(`    ${rel(f)}`);
  }
}

// ── 2 · app/(rooms)/layout.tsx exists, renders RoomsShell, calls reviewBuildAllowed()
{
  const layoutSrc = tryReadRepoFile("app/(rooms)/layout.tsx");
  if (layoutSrc === null) {
    pendingCheck("layout: app/(rooms)/layout.tsx exists", "app/(rooms)/layout.tsx (W1)");
    pendingCheck("layout: imports reviewBuildAllowed from lib/cxos/reviewMode", "app/(rooms)/layout.tsx (W1)");
    pendingCheck("layout: imports RoomsShell from components/shell/RoomsShell", "app/(rooms)/layout.tsx (W1)");
    pendingCheck("layout: renders <RoomsShell> and calls reviewBuildAllowed() for its reviewInstrumentsAllowed prop", "app/(rooms)/layout.tsx (W1)");
  } else {
    check("layout: imports reviewBuildAllowed from lib/cxos/reviewMode", /import\s*\{\s*reviewBuildAllowed\s*\}\s*from\s*"@\/lib\/cxos\/reviewMode";/.test(layoutSrc));
    check("layout: imports RoomsShell from components/shell/RoomsShell", /import\s*\{\s*RoomsShell\s*\}\s*from\s*"@\/components\/shell\/RoomsShell";/.test(layoutSrc));
    check(
      "layout: renders <RoomsShell> passing reviewBuildAllowed() as reviewInstrumentsAllowed, wrapping children",
      /<RoomsShell\s+reviewInstrumentsAllowed=\{reviewBuildAllowed\(\)\}>\{children\}<\/RoomsShell>/.test(layoutSrc),
    );
    check("layout: NO auth check of its own (spec §1 — pages keep their own guards)", !/getServerSession|currentUser\(|currentAccount\(|redirect\(/.test(layoutSrc));
  }
}

// ── 3 · RoomsShell DOM-order + id="main" + pb-24 + KaiPresence cross-check
{
  const shellSrc = tryReadRepoFile("components/shell/RoomsShell.tsx");
  if (shellSrc === null) {
    pendingCheck("RoomsShell: DOM source-order (Sidebar<header<ImpersonationBanner<AnnouncementBanner<AgencyBar<main#main<KaiPresence<MobileNav)", "components/shell/RoomsShell.tsx (W1)");
    pendingCheck("RoomsShell: main carries id=\"main\" and pb-24", "components/shell/RoomsShell.tsx (W1)");
    pendingCheck("RoomsShell: KaiPresence untouched-offset cross-check", "components/shell/RoomsShell.tsx (W1)");
  } else {
    // Comment-stripped: this file's own header comment documents
    // `id="main"` descriptively (line 7), which would otherwise out-rank
    // every real JSX marker below it and break the order comparison.
    const shellCode = stripComments(shellSrc);
    const order = ["<Sidebar", "<header", "<ImpersonationBanner", "<AnnouncementBanner", "<AgencyBar", '<main id="main"', "<KaiPresence", "<MobileNav"];
    const indices = order.map((marker) => shellCode.indexOf(marker));
    check(
      "RoomsShell: every DOM-order marker is present",
      indices.every((i) => i !== -1),
    );
    check(
      "RoomsShell: source-order is Sidebar -> header -> ImpersonationBanner -> AnnouncementBanner -> AgencyBar -> main#main -> KaiPresence -> MobileNav",
      indices.every((i) => i !== -1) && indices.every((idx, i) => i === 0 || idx > indices[i - 1]),
    );
    check(
      'RoomsShell: main carries id="main" and pb-24 (skip-link target + mobile-nav clearance, byte-preserved from AppShell)',
      /<main id="main" className="[^"]*\bpb-24\b[^"]*">/.test(shellCode),
    );
    const kaiSrc = tryReadRepoFile("components/kai/KaiPresence.tsx");
    check(
      "RoomsShell: <KaiPresence /> rendered with no positioning-prop override",
      /<KaiPresence\s*\/>/.test(shellCode),
    );
    check(
      "RoomsShell: KaiPresence untouched-offset cross-check — its own bottom-20 still governs (RoomsShell passes no override)",
      kaiSrc !== null && /bottom-20/.test(kaiSrc),
    );
  }
}

// ── 4 · registry ⇄ filesystem consistency ──────────────────────────────────
{
  const registrySrc = tryReadRepoFile("lib/transition-runtime/roomRegistry.ts");
  if (registrySrc === null) {
    pendingCheck("registry: every journey=true room has a directory under app/(rooms)/", "lib/transition-runtime/roomRegistry.ts (W1)");
    pendingCheck("registry: every app/(rooms)/ top-level route directory has a registry entry", "lib/transition-runtime/roomRegistry.ts (W1)");
  } else {
    const roomRe = /\{\s*id:\s*"([^"]+)",\s*href:\s*"([^"]+)",\s*label:\s*"([^"]*)",\s*journey:\s*(true|false)\s*\}/g;
    const rooms: { id: string; href: string; journey: boolean }[] = [];
    let m: RegExpExecArray | null;
    while ((m = roomRe.exec(registrySrc))) rooms.push({ id: m[1], href: m[2], journey: m[4] === "true" });
    check("registry: parseable — found a healthy number of room entries (>= 20)", rooms.length >= 20);

    const roomsRootDir = join(repoRoot, "app/(rooms)");
    const roomsTopDirs = existsSync(roomsRootDir)
      ? readdirSync(roomsRootDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [];

    const journeyRooms = rooms.filter((r) => r.journey);
    check("registry: at least the flagship set (dashboard/agency/arena) is journey=true", ["dashboard", "agency", "arena"].every((id) => journeyRooms.some((r) => r.id === id)));
    const missingJourneyDirs = journeyRooms.filter((r) => !roomsTopDirs.includes(r.id));
    check(
      "registry: every journey=true room has a directory under app/(rooms)/",
      missingJourneyDirs.length === 0,
    );
    if (missingJourneyDirs.length) console.error(`  journey rooms missing a directory: ${missingJourneyDirs.map((r) => r.id).join(", ")}`);

    // Top-level route = a registry href with exactly one path segment
    // ("/academy", not "/mail/download") — matches this file's own
    // longest-prefix design (sub-rooms like mail-download/mail-send are
    // deliberately NOT their own app/(rooms)/ directory).
    const topLevelRegistryIds = new Set(rooms.filter((r) => /^\/[^/]+$/.test(r.href)).map((r) => r.href.slice(1)));
    const dirsMissingRegistryEntry = roomsTopDirs.filter((d) => !topLevelRegistryIds.has(d));
    check(
      "registry: every app/(rooms)/ top-level route directory has a registry entry",
      dirsMissingRegistryEntry.length === 0,
    );
    if (dirsMissingRegistryEntry.length) console.error(`  directories with no registry entry: ${dirsMissingRegistryEntry.join(", ")}`);

    // Bonus (the section is literally named "Registry <-> filesystem
    // consistency" — the arrow is bidirectional in the spec's own header):
    // the reverse direction too, so a stale registry row pointing at a
    // deleted/never-created directory is caught as loudly as the reverse.
    const registryIdsMissingDir = [...topLevelRegistryIds].filter((id) => !roomsTopDirs.includes(id));
    check(
      "registry (bonus, ⇄ direction): every top-level registry entry has a matching app/(rooms)/ directory",
      registryIdsMissingDir.length === 0,
    );
    if (registryIdsMissingDir.length) console.error(`  registry entries with no directory: ${registryIdsMissingDir.join(", ")}`);
  }
}

// ── 5 · hook cadence pins ───────────────────────────────────────────────────
{
  const pathnameDepFiles = [
    "components/admin/useAdminContext.ts",
    "components/community/useCommunityAccess.ts",
    "components/onboarding/useOnboardingStatus.ts",
    "components/AgencyBar.tsx",
    "components/AnnouncementBanner.tsx",
  ];
  for (const relPath of pathnameDepFiles) {
    const src = tryReadRepoFile(relPath);
    if (src === null) {
      pendingCheck(`hook cadence: ${relPath} depends its persistence-fixed effect on [pathname]`, `${relPath} (W1)`);
      continue;
    }
    check(
      `hook cadence: ${relPath} reads usePathname() and its persistence-fixed effect depends on [pathname]`,
      /usePathname/.test(src) && /\[pathname\]/.test(src),
    );
  }

  const adminCtxSrc = tryReadRepoFile("components/admin/useAdminContext.ts");
  const impBannerSrc = tryReadRepoFile("components/admin/ImpersonationBanner.tsx");
  if (adminCtxSrc === null || impBannerSrc === null) {
    pendingCheck("hook cadence: clearAdminContextCache is exported from useAdminContext.ts", "components/admin/useAdminContext.ts (W1)");
    pendingCheck("hook cadence: ImpersonationBanner.exit() calls clearAdminContextCache() before router.refresh()", "components/admin/ImpersonationBanner.tsx (W1)");
  } else {
    check(
      "hook cadence: clearAdminContextCache is exported from useAdminContext.ts (symmetry with the other two hooks)",
      /export\s+(function|const)\s+clearAdminContextCache\b/.test(adminCtxSrc),
    );
    // Comment-stripped: the fix's own explanatory comment narrates
    // "...triggered by router.refresh()'s server re-render..." BEFORE the
    // real call — a raw substring search would find that prose first and
    // wrongly conclude refresh() precedes the clear.
    const impBannerCode = stripComments(impBannerSrc);
    const exitStart = impBannerCode.indexOf("function exit");
    if (exitStart === -1) {
      check("hook cadence: ImpersonationBanner defines an exit() function", false);
    } else {
      const exitFn = impBannerCode.slice(exitStart, exitStart + 800);
      const clearIdx = exitFn.indexOf("clearAdminContextCache(");
      const refreshIdx = exitFn.indexOf("router.refresh()");
      check(
        "hook cadence: ImpersonationBanner.exit() calls clearAdminContextCache() before router.refresh() (stale-cache fix precedes the re-render it's meant to inform)",
        clearIdx !== -1 && refreshIdx !== -1 && clearIdx < refreshIdx,
      );
    }
  }
}

// ── 6 · ambient luminance contract ─────────────────────────────────────────
// Per the coordinator's directive: read the CURRENT alpha values ourselves
// and pin their ceilings — not the spec's own paraphrase. Repository
// evidence: T2-SPEC.md §6 describes "recon: 0.015-0.09 range", but the
// ACTUAL computed ceilings (verified against source below) run higher for
// two of the four terms — GxlField's warm-thread multiplier (0.035 * 1.4 =
// 0.049) and AmbientGrid's attention-accent pulse (0.09 + 0.06 = 0.15). The
// spec's own header law applies here ("Repository evidence overrides this
// spec on conflict"): this is a paraphrase-precision gap, not a design
// conflict, so it's noted here (and in the W3 handoff report) rather than
// blocking — the guard below pins the true source-verified expressions.
{
  const gxlSrc = tryReadRepoFile("components/gxl/GxlField.tsx");
  const agSrc = tryReadRepoFile("components/community/AmbientGrid.tsx");
  check("ambient: components/gxl/GxlField.tsx exists", gxlSrc !== null);
  check("ambient: components/community/AmbientGrid.tsx exists", agSrc !== null);
  if (gxlSrc !== null) {
    check(
      "ambient ceiling pinned — GxlField.tsx base thread alpha stays 0.015 + 0.02*(breath) [range 0.015-0.035]",
      /const a = 0\.015 \+ 0\.02 \* \(0\.5 \+ 0\.5 \* Math\.sin\(t \* breath \+ p\)\)/.test(gxlSrc),
    );
    check(
      "ambient ceiling pinned — GxlField.tsx warm-thread multiplier stays 1.4x [true ceiling 0.049]",
      /rgba\(227,169,46,\$\{\(a \* 1\.4\)\.toFixed\(3\)\}\)/.test(gxlSrc),
    );
  }
  if (agSrc !== null) {
    check(
      "ambient ceiling pinned — AmbientGrid.tsx base dot alpha stays 0.04 + 0.05*(breath) [range 0.04-0.09]",
      /:\s*0\.04 \+ 0\.05 \* \(0\.5 \+ 0\.5 \* Math\.sin\(t \* liveBreath \+ p\)\)/.test(agSrc),
    );
    check(
      "ambient ceiling pinned — AmbientGrid.tsx attention-accent alpha stays 0.09 + 0.06*(breath) [true ceiling 0.15]",
      /\?\s*0\.09 \+ 0\.06 \* \(0\.5 \+ 0\.5 \* Math\.sin\(t \* liveBreath \* 0\.6 \+ p\)\)/.test(agSrc),
    );
  }
}

// ── 7 · Journey interception — ONE delegated shell-level mechanism (T2.1) ──
// The T2.1 coordinator pass consolidated interception: Sidebar.tsx reverted
// byte-identical to baseline (no per-component handlers anywhere), and
// ShellBody carries a single bubble-phase delegated onClick (TransitionShell
// precedent) that also covers in-content portals like the frozen ArenaDoor.
{
  const sidebarSrc = tryReadRepoFile("components/Sidebar.tsx");
  const sidebarDiff = runGit("diff 1698e2b --stat -- components/Sidebar.tsx");
  check(
    "Interception uniqueness: components/Sidebar.tsx is byte-identical to 1698e2b (no per-component journey handlers)",
    sidebarSrc !== null && (sidebarDiff ?? "x").trim() === "",
  );
  check(
    "Interception uniqueness: Sidebar.tsx contains no journey-machine imports",
    sidebarSrc !== null && !/useOptionalJourneyMachine|transition-runtime/.test(sidebarSrc),
  );

  const shellSrc = tryReadRepoFile("components/shell/RoomsShell.tsx");
  if (shellSrc === null) {
    pendingCheck("RoomsShell: delegated interception present", "components/shell/RoomsShell.tsx");
  } else {
    const body = stripComments(shellSrc);
    check(
      "RoomsShell delegation: defaultPrevented respected before anything else",
      /if\s*\(\s*event\.defaultPrevented\s*\)\s*return/.test(body),
    );
    check(
      "RoomsShell delegation: plain-primary-click guard (button 0, no modifiers)",
      /event\.button\s*!==\s*0/.test(body) && /metaKey/.test(body) && /ctrlKey/.test(body) && /shiftKey/.test(body) && /altKey/.test(body),
    );
    check(
      "RoomsShell delegation: anchor resolution via closest(\"a\") with _blank/download exclusions",
      /closest\?\.\(\s*"a"\s*\)/.test(body) && /_blank/.test(body) && /download/.test(body),
    );
    check(
      "RoomsShell delegation: destination resolved via matchJourneyRoom (journey rooms only)",
      /matchJourneyRoom\(/.test(body),
    );
    check(
      "RoomsShell delegation: preventDefault() only after an accepted navigate() (fall-through law)",
      /const\s+accepted\s*=\s*navigate\(/.test(body) && /if\s*\(\s*accepted\s*\)\s*event\.preventDefault\(\)/.test(body),
    );
    check(
      "RoomsShell delegation: journeyLabel() used so announcements never speak the leading slash",
      /journeyLabel\(/.test(body),
    );
  }
}

// ── 8 · isolation gate — git diff vs 1698e2b ⊆ the T2 allowlist ───────────
{
  const T2_BASE = "1698e2b";

  // spec §8's table, flattened to exact repo-relative paths.
  const EXACT_ALLOWLIST = new Set([
    // W1 shell
    "components/shell/RoomsShell.tsx",
    "lib/transition-runtime/roomRegistry.ts",
    "components/transition-runtime/TransitionRuntimeProvider.tsx",
    // T2.1 coordinator amendments: TravelLayer's focus fallback (pinned in
    // item 9) — Sidebar.tsx stays listed although reverted byte-identical
    // (a zero diff never reaches this gate anyway) — and the T1 suite's
    // isolation-gate supersession block (it now defers to THIS suite when
    // this file exists; everything else in it is untouched).
    "components/transition-runtime/TravelLayer.tsx",
    "scripts/transition-runtime.test.ts",
    "components/Sidebar.tsx",
    "components/AgencyBar.tsx",
    "components/AnnouncementBanner.tsx",
    "components/admin/useAdminContext.ts",
    "components/admin/ImpersonationBanner.tsx",
    "components/community/useCommunityAccess.ts",
    "components/onboarding/useOnboardingStatus.ts",
    "components/kai/KaiPresence.tsx",
    "app/globals.css",
    // W3 (this writer)
    "components/cxos/mission/MissionEntry.tsx",
    "components/cxos/arena/ArenaEntry.tsx",
    "scripts/cxos-mission.test.ts",
    "scripts/cxos-arena.test.ts",
    "scripts/persistent-shell.test.ts",
  ]);
  const PREFIX_ALLOWLIST = ["app/(rooms)/", "docs/reviews/cinematic-transition-runtime/"];
  // The 22 git-mv'd dirs (spec §1) — the ONLY renames permitted, and only
  // app/<dir>/... -> app/(rooms)/<dir>/... (same dir name both sides).
  const MOVED_DIRS = new Set([
    "academy", "agency", "arena", "billing", "builder", "campaigns", "community", "dashboard",
    "gxl", "identity", "journey", "letters", "mail", "modules", "network", "onboarding",
    "scores", "settings", "strategist", "support", "tradelines", "upload",
  ]);
  // Zero-diff zones: no exceptions except the two W3 ceremony files.
  const ZERO_DIFF_PREFIXES = ["app/admin/", "app/api/", "lib/cxos/", "components/cxos/", "app/review/agency-command/"];
  const ZERO_DIFF_EXCEPTIONS = new Set(["components/cxos/mission/MissionEntry.tsx", "components/cxos/arena/ArenaEntry.tsx"]);

  const isPlainAllowed = (p: string) => EXACT_ALLOWLIST.has(p) || PREFIX_ALLOWLIST.some((pre) => p.startsWith(pre));
  const isZeroDiffZone = (p: string) => ZERO_DIFF_PREFIXES.some((pre) => p.startsWith(pre)) && !ZERO_DIFF_EXCEPTIONS.has(p);
  const topDirOf = (p: string): string | null => {
    const m = /^app\/([^/]+)\//.exec(p);
    return m ? m[1] : null;
  };

  type Row = { status: string; path: string; oldPath?: string };
  function parseNameStatus(raw: string): Row[] {
    const rows: Row[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const cols = line.split("\t");
      const status = cols[0];
      if ((status.startsWith("R") || status.startsWith("C")) && cols.length >= 3) {
        rows.push({ status, oldPath: cols[1], path: cols[2] });
      } else if (cols.length >= 2) {
        rows.push({ status, path: cols[1] });
      }
    }
    return rows;
  }

  const nameStatusRaw = runGit(`diff --name-status ${T2_BASE}`);
  check("isolation gate: `git diff --name-status 1698e2b` runs cleanly", nameStatusRaw !== null);
  const rows = parseNameStatus(nameStatusRaw ?? "");

  const violations: string[] = [];
  const okReport: string[] = [];
  for (const row of rows) {
    if (row.oldPath) {
      const oldDir = topDirOf(row.oldPath);
      const isExpectedMove =
        oldDir !== null &&
        MOVED_DIRS.has(oldDir) &&
        !row.oldPath.startsWith("app/(rooms)/") &&
        row.path.startsWith(`app/(rooms)/${oldDir}/`);
      if (isZeroDiffZone(row.oldPath) || isZeroDiffZone(row.path)) {
        violations.push(`ZERO-DIFF ZONE rename: [${row.status}] ${row.oldPath} -> ${row.path}`);
      } else if (isExpectedMove || (isPlainAllowed(row.oldPath) && isPlainAllowed(row.path))) {
        okReport.push(`[${row.status}] ${row.oldPath} -> ${row.path}`);
      } else {
        violations.push(`disallowed rename: [${row.status}] ${row.oldPath} -> ${row.path}`);
      }
    } else {
      if (isZeroDiffZone(row.path)) {
        violations.push(`ZERO-DIFF ZONE touched: [${row.status}] ${row.path}`);
      } else if (!isPlainAllowed(row.path)) {
        violations.push(`outside T2 allowlist: [${row.status}] ${row.path}`);
      } else {
        okReport.push(`[${row.status}] ${row.path}`);
      }
    }
  }
  check(
    `isolation gate: every tracked diff vs 1698e2b (${rows.length} entries) is within the T2 allowlist — renames restricted to the 22 named dirs, zero-diff zones respected`,
    violations.length === 0,
  );

  const statusRaw = runGit("status --porcelain --untracked-files=all");
  check("isolation gate: `git status --porcelain` runs cleanly", statusRaw !== null);
  const untrackedFiles = (statusRaw ?? "")
    .split("\n")
    .filter((l) => l.startsWith("??"))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
  const untrackedViolations = untrackedFiles.filter((f) => isZeroDiffZone(f) || !isPlainAllowed(f));
  check(
    `isolation gate: every untracked new file (${untrackedFiles.length} found) is within the T2 allowlist`,
    untrackedViolations.length === 0,
  );

  console.log("\n--- Isolation gate report (vs 1698e2b) ---");
  for (const r of okReport) console.log(`  OK    ${r}`);
  for (const f of untrackedFiles) console.log(`  ${untrackedViolations.includes(f) ? "VIOLATION" : "OK  "}  ?? ${f}`);
  for (const v of violations) console.log(`  VIOLATION  ${v}`);
}

// ── 9 · T1 freeze — byte-identical to 1698e2b ───────────────────────────────
{
  const T2_BASE = "1698e2b";
  const T1_FROZEN_PATHSPECS = [
    "lib/transition-runtime/machine.ts",
    "lib/transition-runtime/pacing.ts",
    "lib/transition-runtime/types.ts",
    "components/transition-runtime/RoomReady.tsx",
    "app/review/transition-runtime",
  ];
  const pathArgs = T1_FROZEN_PATHSPECS.map((p) => `"${p}"`).join(" ");
  const frozenDiff = runGit(`diff ${T2_BASE} --stat -- ${pathArgs}`);
  check("T1 freeze: `git diff 1698e2b --stat` over the frozen T1 files runs cleanly", frozenDiff !== null);
  check(
    "T1 freeze: machine.ts, pacing.ts, types.ts, RoomReady.tsx, and the app/review/transition-runtime demo segment are byte-identical to 1698e2b",
    (frozenDiff ?? "").trim() === "",
  );
  if ((frozenDiff ?? "").trim() !== "") console.error(`  T1 freeze diff:\n${frozenDiff}`);

  // T2.1 amendment (new integration evidence, coordinator-authorized):
  // TravelLayer.tsx is no longer byte-frozen — the ONE permitted change is
  // the arrival focus-handoff fallback ("main h1" ?? "header h1"), because
  // the product shell's title <h1> lives in <header> and the original
  // selector silently voided the a11y focus law product-wide. Pin: the
  // fallback exists, AND the diff touches only that region (no other
  // hunk in the file).
  const travelSrc = tryReadRepoFile("components/transition-runtime/TravelLayer.tsx");
  check(
    "TravelLayer (T2.1 amendment): arrival focus-handoff falls back to header h1",
    travelSrc !== null && /querySelector<HTMLElement>\("main h1"\)\s*\?\?\s*\n?\s*document\.querySelector<HTMLElement>\("header h1"\)/.test(travelSrc),
  );
  const travelDiff = runGit(`diff ${T2_BASE} -- "components/transition-runtime/TravelLayer.tsx"`) ?? "";
  const travelHunks = travelDiff.split("\n").filter((l) => l.startsWith("@@")).length;
  const travelRemovals = travelDiff
    .split("\n")
    .filter((l) => l.startsWith("-") && !l.startsWith("---"))
    .filter((l) => !/main h1|TransitionShell's own settle-focus/.test(l));
  check(
    "TravelLayer (T2.1 amendment): the diff vs 1698e2b is exactly one hunk touching only the focus-handoff selector",
    travelHunks === 1 && travelRemovals.length === 0,
  );

  // Additive-only spot-check on the one permitted exception (spec §0): the
  // diff must contain ONLY added lines for TransitionRuntimeProvider.tsx —
  // no removed/changed line anywhere in it. (Informational depth beyond the
  // literal item 9 text, which excludes this file from the byte-identical
  // set by design — kept as its own assertion, not folded into item 9's
  // count, so a failure here reads as "additive law broken", not "T1 frozen
  // file touched".)
  const providerDiff = runGit(`diff ${T2_BASE} -- "components/transition-runtime/TransitionRuntimeProvider.tsx"`);
  if (providerDiff !== null && providerDiff.trim() !== "") {
    const removedLines = providerDiff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
    check(
      "TransitionRuntimeProvider.tsx (T1 freeze exception): diff vs 1698e2b is purely additive — zero removed/changed lines",
      removedLines.length === 0,
    );
  }
}

const total = pass + fail + pending;
console.log(`\npersistent-shell.test.ts: ${pass} passed, ${fail} failed, ${pending} pending (blocked on other T2 writers)`);
console.log(`${fail === 0 && pending === 0 ? "PASS" : "INCOMPLETE"} ${pass}/${total}`);
process.exit(fail > 0 || pending > 0 ? 1 : 0);
