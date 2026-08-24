// Run: npx tsx scripts/session-recovery.test.ts
//
// RC1 slice S2 — SESSION RECOVERY & NAVIGATION. Guards P0-5 / A1-01, A1-08,
// A1-09, A1-12, A1-15 and the upload re-analysis label handoff.
//
// The failure this suite exists to prevent: a returning consumer whose JWT has
// expired is shown their credit file as 0 / 0 / 0, or the words "Please sign
// in." with nothing to click, inside the full application chrome. On a credit
// product the honest reading of that screen is "my data was deleted".
//
// Structure — behavioural first, source-level only where the repo has no
// runtime to execute:
//   1  lib/callbackUrl.ts               pure, executed
//   2  middleware.ts                    executed over a faked getToken
//   3  matcher ↔ AUTHED_ROUTES          source (a Next matcher must be a literal)
//   4  lib/requireSession.ts            executed over the REAL lib/session.ts
//   5  the three new segment gates      executed
//   6  app/dashboard/page.tsx           executed (the P0-5 headline surface)
//   7  every owned authed page          source: the gate is wired, the linkless
//                                       "Please sign in." is gone
//   8  components/Sidebar.tsx           source: dialog contract + truthful label
//   9  not-found / error boundaries     source: truthful copy
//  10  /support, /help, /upload         source: signed-out path, reachability,
//                                       honest button label
//
// Sections 4-6 follow scripts/score-tracker-auth-runtime.test.ts's module._load
// monkey-patch technique, so the REAL lib/session.ts runs — including its
// disabled-account, demo-identity and workspace/impersonation handling — rather
// than a stand-in that could agree with a broken gate.
//
// Offline by design: no network, no database, no next-auth secret.

import { readFileSync } from "fs";
import { join } from "path";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) { pass++; console.log(`✓ ${label}`); }
  else { fail++; console.error(`✗ ${label}`); }
}

const ROOT = join(__dirname, "..");
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

// Several assertions below are about what a CONSUMER is shown, and this slice's
// comments quote the very strings being asserted absent (that is how a fix is
// documented). Strip whole-line `//` comments and `{/* … */}` JSX comments so a
// comment can never satisfy — or defeat — a check about rendered copy. Only
// whole-line comments are removed, so a "https://…" inside a string is safe.
function rendered(path: string): string {
  return src(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const NodeModule = require("module") as { _load: Loader };
const mutableEnv = process.env as Record<string, string | undefined>;

function clearModule(path: string) {
  try { delete require.cache[require.resolve(path)]; } catch { /* not yet loaded */ }
}

// ── 1 — the callback-URL validator ─────────────────────────────────────────
// An unvalidated ?callbackUrl= is an open redirect: the victim completes a real
// sign-in on the real domain and is handed to a site someone else chose, at the
// moment they are most primed to trust what they see.
function testCallbackUrl() {
  const { safeCallbackUrl, isSafeCallbackPath, loginPathFor, DEFAULT_AFTER_LOGIN } =
    require("../lib/callbackUrl") as typeof import("../lib/callbackUrl");

  check("default destination is the dashboard", DEFAULT_AFTER_LOGIN === "/dashboard");

  const hostile: Array<[string, string]> = [
    ["absolute https URL", "https://evil.com/pwn"],
    ["absolute http URL", "http://evil.com/pwn"],
    ["absolute URL on our own host", "https://www.creditvector.app/letters"],
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/letters"],
    ["backslash protocol-relative", "/\\evil.com"],
    ["backslash anywhere", "/letters\\@evil.com"],
    ["leading whitespace before //", " //evil.com"],
    ["javascript: scheme", "javascript:alert(1)"],
    ["data: scheme", "data:text/html,<script>1</script>"],
    ["newline injection", "/letters\nLocation: //evil.com"],
    ["tab injection", "/letters\tx"],
    ["bare word", "letters"],
    ["empty string", ""],
  ];
  for (const [label, value] of hostile) {
    check(`rejects ${label} → dashboard`, safeCallbackUrl(value) === "/dashboard" && !isSafeCallbackPath(value));
  }
  check("rejects a non-string", safeCallbackUrl(undefined) === "/dashboard" && safeCallbackUrl(null) === "/dashboard");
  check("rejects an absurdly long value", safeCallbackUrl("/" + "a".repeat(600)) === "/dashboard");
  check("rejects /login itself (sign-in loop)", safeCallbackUrl("/login") === "/dashboard");
  check("rejects /login with a query (sign-in loop)", safeCallbackUrl("/login?callbackUrl=/x") === "/dashboard");
  check("rejects /register (sign-in loop)", safeCallbackUrl("/register") === "/dashboard");
  check("rejects an API route", safeCallbackUrl("/api/profile") === "/dashboard");

  const honoured = ["/letters", "/scores", "/tradelines", "/letters?tab=drafts", "/mail/download/abc", "/settings#password"];
  for (const value of honoured) {
    check(`honours the relative path ${value}`, safeCallbackUrl(value) === value && isSafeCallbackPath(value));
  }
  check("an explicit fallback is respected", safeCallbackUrl("//evil.com", "/scores") === "/scores");

  check("loginPathFor encodes the return path", loginPathFor("/journey") === "/login?callbackUrl=%2Fjourney");
  check("loginPathFor keeps a query string intact", loginPathFor("/letters?tab=drafts&x=1") === "/login?callbackUrl=%2Fletters%3Ftab%3Ddrafts%26x%3D1");
  check("loginPathFor refuses to embed a hostile target", loginPathFor("//evil.com") === "/login");
  check("loginPathFor round-trips through URL decoding", (() => {
    const url = new URL(loginPathFor("/letters?tab=drafts"), "http://x.test");
    return url.searchParams.get("callbackUrl") === "/letters?tab=drafts";
  })());
}

// ── 2 — middleware, executed ───────────────────────────────────────────────
async function testMiddleware() {
  const realLoad = NodeModule._load;
  let token: Record<string, unknown> | null = null;
  const previousNodeEnv = mutableEnv.NODE_ENV;

  NodeModule._load = function patched(this: unknown, request, parent, isMain) {
    if (request === "next-auth/jwt") return { getToken: async () => token };
    return realLoad.apply(this, [request, parent, isMain]);
  } as Loader;

  try {
    mutableEnv.NODE_ENV = "production";
    clearModule("../middleware");
    const mw = require("../middleware") as typeof import("../middleware");
    const { NextRequest } = require("next/server") as typeof import("next/server");

    const run = async (path: string) => {
      const res = await mw.middleware(new NextRequest(new URL(`http://x.test${path}`)));
      const location = res.headers.get("location");
      return { status: res.status, to: location ? new URL(location).pathname + new URL(location).search : null };
    };

    const valid = { uid: "u1", sessionVersion: "A".repeat(43), email: "person@example.com" };

    // --- signed out -------------------------------------------------------
    token = null;
    for (const path of ["/dashboard", "/letters", "/tradelines", "/upload", "/settings", "/journey", "/strategist", "/onboarding", "/scores", "/mail"]) {
      const r = await run(path);
      check(`signed out on ${path} → /login carrying the return path`,
        r.status === 307 && r.to === `/login?callbackUrl=${encodeURIComponent(path)}`);
    }
    check("a nested authed path is guarded too", (await run("/mail/download/pkg1")).to === "/login?callbackUrl=%2Fmail%2Fdownload%2Fpkg1");
    check("the query string survives the round trip", (await run("/letters?tab=drafts")).to === "/login?callbackUrl=%2Fletters%3Ftab%3Ddrafts");

    // --- the surfaces that must stay reachable signed out -----------------
    check("signed out on /billing/cancel is never redirected (S1 remedy)", (await run("/billing/cancel")).status === 200);
    check("signed out on /support is never redirected (A1-09)", (await run("/support")).status === 200);
    check("signed out on the landing renders the landing", (await run("/")).status === 200);
    // Review HIGH-1. /brief is PUBLIC content, not an app room: it carries
    // canonical + OpenGraph metadata, robots.txt deliberately does not disallow
    // it, and lib/briefDigest.ts:75,87 deep-links articles from the digest email.
    // Redirecting it bounces a reader arriving from their own inbox and deindexes
    // every published article. Being in the in-app NAV list does not make a route
    // non-public — which is exactly how it got over-matched.
    check("signed out on a public Brief article is never redirected (it is indexed and is linked from the digest email)",
      (await run("/brief/some-article")).status === 200);
    check("signed out on the Brief index is never redirected", (await run("/brief")).status === 200);
    check("signed out on /brief/saved is never redirected (it renders its own truthful panel)",
      (await run("/brief/saved")).status === 200);
    for (const path of ["/help", "/pricing", "/legal/terms", "/register", "/forgot-password"]) {
      check(`signed out on the public route ${path} is never redirected`, (await run(path)).status === 200);
    }

    // --- stale / legacy evidence -----------------------------------------
    token = { uid: "u1" }; // pre-RC1 uid-only JWT: no sessionVersion
    check("a pre-RC1 uid-only JWT is treated as signed out", (await run("/dashboard")).to === "/login?callbackUrl=%2Fdashboard");
    token = { uid: "u1", sessionVersion: "not-a-valid-version" };
    check("a malformed sessionVersion is treated as signed out", (await run("/letters")).to === "/login?callbackUrl=%2Fletters");
    token = { uid: "", sessionVersion: "A".repeat(43) };
    check("an empty uid is treated as signed out", (await run("/letters")).to === "/login?callbackUrl=%2Fletters");
    token = { uid: "u1", sessionVersion: "A".repeat(43), email: "demo@gabrielcapitallabs.com" };
    check("a historic demo identity is treated as signed out outside development", (await run("/letters")).to === "/login?callbackUrl=%2Fletters");

    // --- S1's cancellation-only branch must be extended, never regressed ---
    token = { cancellationOnly: true, uid: "u1" };
    check("S1: a suspended account is still sent to /billing/cancel", (await run("/dashboard")).to === "/billing/cancel");
    check("S1: a suspended account reaches /billing/cancel itself", (await run("/billing/cancel")).status === 200);
    check("S1: the cancellation branch now also covers the widened matcher", (await run("/letters")).to === "/billing/cancel");
    check("S1: cancellation wins over the landing redirect", (await run("/")).to === "/billing/cancel");

    // --- a real session is untouched --------------------------------------
    token = valid;
    check("S1: a signed-in visitor is still forwarded off the landing", (await run("/")).to === "/dashboard");
    for (const path of ["/dashboard", "/letters", "/settings"]) {
      check(`a real session passes through ${path}`, (await run(path)).status === 200);
    }
    check("/dashboard never self-redirects", (await run("/dashboard")).to === null);

    // --- development keeps the demo-account fallback explorable ------------
    mutableEnv.NODE_ENV = "development";
    token = null;
    check("development does not redirect (matches currentUserOrDemo's fallback)", (await run("/letters")).status === 200);
    mutableEnv.NODE_ENV = "test";
    check("NODE_ENV=test fails closed", (await run("/letters")).to === "/login?callbackUrl=%2Fletters");
    mutableEnv.NODE_ENV = undefined;
    check("an unset NODE_ENV fails closed", (await run("/letters")).to === "/login?callbackUrl=%2Fletters");
  } finally {
    NodeModule._load = realLoad;
    mutableEnv.NODE_ENV = previousNodeEnv;
    clearModule("../middleware");
  }
}

// ── 3 — matcher ↔ AUTHED_ROUTES ────────────────────────────────────────────
// A Next.js matcher has to be a static literal, so the two lists cannot be
// derived from one another. A route present in AUTHED_ROUTES but missing from
// the matcher is SILENTLY unguarded — middleware simply never runs for it.
function testMatcherConsistency() {
  const text = src("middleware.ts");
  const listed = /const AUTHED_ROUTES = \[([\s\S]*?)\];/.exec(text);
  check("AUTHED_ROUTES is declared as a literal list", listed !== null);
  if (!listed) return;
  const routes = Array.from(listed[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);
  check("AUTHED_ROUTES is not empty", routes.length >= 20);

  const matcherBlock = /export const config = \{[\s\S]*?matcher: \[([\s\S]*?)\],\s*\};/.exec(text);
  check("the matcher is declared as a literal list", matcherBlock !== null);
  if (!matcherBlock) return;
  const matcher = Array.from(matcherBlock[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);

  const matcherRoots = matcher.filter((m) => m !== "/").map((m) => m.replace("/:path*", ""));
  const missing = routes.filter((r) => !matcherRoots.includes(r));
  check(`every guarded route is in the matcher (missing: ${missing.join(", ") || "none"})`, missing.length === 0);
  const extra = matcherRoots.filter((m) => !routes.includes(m));
  check(`the matcher carries nothing unguarded (extra: ${extra.join(", ") || "none"})`, extra.length === 0);
  check("the landing stays matched", matcher.includes("/"));
  check("/support is deliberately absent from the matcher", !matcherRoots.includes("/support"));
  check("no public auth screen is matched", !matcherRoots.some((m) => ["/login", "/register", "/forgot-password", "/reset-password", "/help", "/pricing", "/legal"].includes(m)));
  // Set-equality alone is blind to this class: a matcher that swallows a public
  // surface is still perfectly self-consistent, which is how review HIGH-1
  // shipped 172-green. Name the public surfaces explicitly.
  check("no public content surface is matched",
    !matcherRoots.some((m) => ["/brief", "/help", "/pricing", "/legal"].includes(m)));
  check("nothing under /brief is matched, by prefix either",
    !matcher.some((m) => m.startsWith("/brief")) && !routes.some((r) => r.startsWith("/brief")));
  check("/api is never matched", !matcherRoots.some((m) => m.startsWith("/api")));
}

// ── 4-6 — the server gates, executed over the REAL lib/session.ts ──────────
type FakeUser = { id: string; role: string; disabled: boolean; isAgency: boolean; email: string; managedByAgencyId?: string | null };

async function withRealSession(
  run: (ctx: {
    setSession: (id: string | null) => void;
    users: Record<string, FakeUser>;
    redirects: string[];
  }) => Promise<void>,
) {
  const realLoad = NodeModule._load;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  let sessionUserId: string | null = null;
  const users: Record<string, FakeUser> = {
    u1: { id: "u1", role: "USER", disabled: false, isAgency: false, email: "person@example.com" },
    disabled1: { id: "disabled1", role: "USER", disabled: true, isAgency: false, email: "suspended@example.com" },
    demo1: { id: "demo1", role: "USER", disabled: false, isAgency: false, email: "demo@gabrielcapitallabs.com" },
  };
  const redirects: string[] = [];
  mutableEnv.NODE_ENV = "production"; // the demo-user fallback must not mask a gate

  NodeModule._load = function patched(this: unknown, request, parent, isMain) {
    if (request.endsWith(".css")) return { default: new Proxy({}, { get: () => "cls" }) };
    if (request === "next-auth") return { getServerSession: async () => (sessionUserId ? { user: { id: sessionUserId } } : null) };
    if (request === "next/headers") return { cookies: () => ({ get: () => undefined }) };
    if (request === "./auth" || request === "@/lib/auth") return { authOptions: {} };
    if (request === "./prisma" || request === "@/lib/prisma") {
      return {
        prisma: {
          user: {
            findUnique: async ({ where }: { where: { id?: string } }) => (where.id ? users[where.id] ?? null : null),
            findFirst: async () => null,
          },
        },
      };
    }
    if (request === "next/navigation") {
      return {
        redirect: (url: string) => {
          redirects.push(url);
          const error = new Error("NEXT_REDIRECT") as Error & { digest?: string };
          error.digest = "NEXT_REDIRECT";
          throw error;
        },
        notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
      };
    }
    return realLoad.apply(this, [request, parent, isMain]);
  } as Loader;

  for (const m of ["../lib/session", "../lib/requireSession", "../app/letters/layout", "../app/settings/layout", "../app/upload/layout", "../app/scores/layout", "../app/dashboard/page"]) {
    clearModule(m);
  }

  try {
    await run({ setSession: (id) => { sessionUserId = id; }, users, redirects });
  } finally {
    NodeModule._load = realLoad;
    mutableEnv.NODE_ENV = previousNodeEnv;
    for (const m of ["../lib/session", "../lib/requireSession", "../app/letters/layout", "../app/settings/layout", "../app/upload/layout", "../app/scores/layout", "../app/dashboard/page"]) {
      clearModule(m);
    }
  }
}

async function redirectedTo(fn: () => Promise<unknown>, redirects: string[]): Promise<string | null> {
  const before = redirects.length;
  try {
    await fn();
    return null;
  } catch (error) {
    if ((error as { digest?: string }).digest !== "NEXT_REDIRECT") throw error;
    return redirects[before] ?? null;
  }
}

async function testServerGates() {
  await withRealSession(async ({ setSession, redirects }) => {
    const requireSession = require("../lib/requireSession") as typeof import("../lib/requireSession");

    // 4 — the shared helper, over the real session resolver.
    setSession(null);
    check("requireUser sends an absent session to /login with the return path",
      (await redirectedTo(() => requireSession.requireUser("/letters"), redirects)) === "/login?callbackUrl=%2Fletters");

    setSession("u1");
    const resolved = await requireSession.requireUser("/letters");
    check("requireUser returns the real resolved user for a live session", resolved?.id === "u1");

    setSession("disabled1");
    check("requireUser refuses a DISABLED account (a cookie alone cannot see this)",
      (await redirectedTo(() => requireSession.requireUser("/letters"), redirects)) === "/login?callbackUrl=%2Fletters");

    setSession("demo1");
    check("requireUser refuses a historic demo identity outside development",
      (await redirectedTo(() => requireSession.requireUser("/letters"), redirects)) === "/login?callbackUrl=%2Fletters");

    setSession("nobody");
    check("requireUser refuses a session id with no row (deleted account)",
      (await redirectedTo(() => requireSession.requireUser("/letters"), redirects)) === "/login?callbackUrl=%2Fletters");

    // 5 — the three new segment gates for the "use client" pages.
    const gates: Array<[string, string, string]> = [
      ["/letters", "../app/letters/layout", "letters"],
      ["/settings", "../app/settings/layout", "settings"],
      ["/upload", "../app/upload/layout", "upload"],
    ];
    for (const [route, modulePath, label] of gates) {
      const mod = require(modulePath) as { default: (input: { children: unknown }) => Promise<unknown>; dynamic?: string };
      check(`${label} gate is force-dynamic (never answered from a static cache)`, mod.dynamic === "force-dynamic");
      setSession(null);
      check(`${label} gate refuses a signed-out visitor and returns to ${route}`,
        (await redirectedTo(() => mod.default({ children: "protected" }), redirects)) === `/login?callbackUrl=${encodeURIComponent(route)}`);
      setSession("disabled1");
      check(`${label} gate refuses a disabled account`,
        (await redirectedTo(() => mod.default({ children: "protected" }), redirects)) !== null);
      setSession("u1");
      check(`${label} gate renders the page for a real session`, (await mod.default({ children: "protected" })) === "protected");
    }

    // The S9 gate must survive this slice untouched.
    const scores = require("../app/scores/layout") as { default: (input: { children: unknown }) => Promise<unknown> };
    setSession(null);
    check("S9's /scores gate still redirects (unchanged by this slice)",
      (await redirectedTo(() => scores.default({ children: "x" }), redirects)) === "/login?callbackUrl=/scores");

    // 6 — the headline surface: Mission Control, executed.
    (globalThis as unknown as { React: unknown }).React = require("react");
    const dashboard = require("../app/dashboard/page") as { default: () => Promise<unknown>; dynamic?: string };
    check("the dashboard is force-dynamic", dashboard.dynamic === "force-dynamic");
    setSession(null);
    const landed = await redirectedTo(() => dashboard.default(), redirects);
    check("an expired session never renders Mission Control — it leaves for /login",
      landed === "/login?callbackUrl=%2Fdashboard");
  });
}

// ── 7 — every owned authenticated page wires the gate ──────────────────────
function testOwnedPagesWireTheGate() {
  const serverPages: Array<[string, string]> = [
    ["app/dashboard/page.tsx", "/dashboard"],
    ["app/journey/page.tsx", "/journey"],
    ["app/onboarding/page.tsx", "/onboarding"],
    ["app/strategist/page.tsx", "/strategist"],
  ];
  for (const [path, route] of serverPages) {
    const text = rendered(path);
    check(`${path} calls the shared gate for ${route}`,
      /from "@\/lib\/requireSession"/.test(text) && text.includes(`("${route}")`));
  }
  // The dashboard keeps its own principal resolution (it has to: agency owner vs
  // open client workspace vs consumer are three different subjects). What must
  // be true is that the unresolved case LEAVES rather than renders.
  check("the dashboard leaves for /login instead of rendering a shell",
    /if \(!principal\) redirectToLogin\("\/dashboard"\);/.test(rendered("app/dashboard/page.tsx")));
  // Every other owned server page delegates resolution entirely.
  for (const path of ["app/journey/page.tsx", "app/onboarding/page.tsx", "app/strategist/page.tsx"]) {
    check(`${path} no longer resolves the session itself`, !rendered(path).includes("currentUserOrDemo()"));
  }

  const clientSegments = ["app/letters/layout.tsx", "app/settings/layout.tsx", "app/upload/layout.tsx"];
  for (const path of clientSegments) {
    const text = src(path);
    check(`${path} exists and gates the segment`, text.includes("requireUser(") && text.includes('export const dynamic = "force-dynamic"'));
  }

  // The zeroed-file illusion: strategist rendered a complete "0 High / 0 Medium
  // / 0 Low" reading of a file it had never loaded.
  const strategist = rendered("app/strategist/page.tsx");
  check("strategist no longer substitutes an empty tradeline list for an absent user",
    !/user \? await prisma\.tradeline/.test(strategist) && !strategist.includes("user ? `cv-strategy-plan"));

  // No owned page may answer an absent session with unclickable words.
  const owned = [
    "app/dashboard/page.tsx", "app/journey/page.tsx", "app/onboarding/page.tsx",
    "app/strategist/page.tsx", "app/letters/page.tsx", "app/settings/page.tsx",
    "app/upload/page.tsx", "app/scores/page.tsx", "app/support/page.tsx",
    "app/help/page.tsx", "app/login/page.tsx", "app/not-found.tsx",
    "app/error.tsx", "app/global-error.tsx",
  ];
  for (const path of owned) {
    check(`${path} has no linkless "Please sign in."`, !rendered(path).includes("Please sign in."));
  }

  // Onboarding gets the app chrome (A1-15) without its pricing copy being touched.
  const onboarding = rendered("app/onboarding/page.tsx");
  check("onboarding renders inside AppShell (A1-15)", /<AppShell title="\/ Getting started">/.test(onboarding) && onboarding.includes("</AppShell>"));
  // RC1-S6b: S2's hand-off marker ("Want the full engine?") existed to hold the
  // stale upsell in place until the copy slice landed. It has landed. Pinned
  // both ways now — the truthful replacement must be present AND the upsell
  // must not come back. rendered() strips {/* */} and //, so the narration at
  // app/onboarding/page.tsx:105-111 satisfies neither half.
  check("onboarding's tail CTA states the consumer already has the whole product",
    onboarding.includes("You already have the full engine") &&
    onboarding.includes("held back behind a paid tier"));
  check("onboarding's tail CTA sells nothing and routes into the product, not /pricing",
    !/Want the full engine\?/.test(onboarding) &&
    !/\/pricing/.test(onboarding) &&
    !/View Pricing/.test(onboarding) &&
    /href="\/dashboard"/.test(onboarding));
}

// ── 8 — the login screen honours the return path ───────────────────────────
function testLoginPage() {
  const text = rendered("app/login/page.tsx");
  check("login reads callbackUrl", text.includes('params.get("callbackUrl")'));
  check("login validates it through the shared validator", /from "@\/lib\/callbackUrl"/.test(text) && text.includes("safeCallbackUrl("));
  check("login pushes the validated destination, not a hardcoded one", text.includes("router.push(returnTo)") && !text.includes('router.push("/dashboard")'));
  check("useSearchParams sits inside a Suspense boundary", text.includes("<Suspense") && text.includes("useSearchParams"));
  // Legacy uid-only sessions read as signed-out by design (S1); the copy must
  // not accuse the consumer of an error they did not make.
  check("expiry copy is a resumption, not a blame", text.includes("Your session ended, so please sign in again"));
  check("expiry copy states nothing in the file changed", text.includes("Nothing in your file has changed"));
  check("login offers a signed-out support route (A1-09)", text.includes("support@creditvector.app") && text.includes('href="/help"'));
}

// ── 9 — the mobile drawer's dialog contract (A1-08) ────────────────────────
// jsdom is not a dependency of this repo, so the drawer cannot be mounted here.
// These assertions pin the specific mechanisms the finding named missing.
function testSidebar() {
  const text = src("components/Sidebar.tsx");
  const shown = rendered("components/Sidebar.tsx");
  check("drawer still declares itself a modal dialog", text.includes('role="dialog"') && text.includes('aria-modal="true"'));
  check("the dialog is named for assistive technology", text.includes('aria-label="Navigation menu"'));
  check("Escape closes the drawer", text.includes('e.key === "Escape"') && text.includes("closeDrawer(true)"));
  check("the key handler runs on the capture phase", text.includes('document.addEventListener("keydown", onKeyDown, true)'));
  check("the handler is torn down with the drawer", text.includes('document.removeEventListener("keydown", onKeyDown, true)'));
  check("focus moves into the dialog on open", text.includes("FOCUSABLE_SELECTOR") && text.includes("initialFocus?.focus({ preventScroll: true })"));
  check("Tab is trapped at both ends", text.includes("e.shiftKey && active === first") && text.includes("!e.shiftKey && active === last"));
  check("focus that escaped the dialog is pulled back", text.includes("!drawer.contains(active)"));
  check("focus returns to the opener on dismissal", text.includes("const opener = openerRef.current;") && text.includes("restoreFocusRef.current) opener?.focus"));
  check("choosing a destination does not steal focus back", text.includes("closeDrawer(false)"));
  check("the page behind is scroll-locked while open", text.includes('document.body.style.overflow = "hidden"') && text.includes("previousOverflow"));
  check("the bar behind the dialog is hidden from assistive technology", text.includes("aria-hidden={open || undefined}"));
  check("the trigger advertises the dialog", text.includes('aria-haspopup="dialog"') && text.includes("aria-expanded={open}"));

  // Truthful auth control (P0-5, correction G).
  check("the auth control reads the real session state via the shared decision",
    text.includes('from "./useSignedOut"') && text.includes("useSignedOut()"));
  check("a signed-out visitor is offered Sign in, not Log out", text.includes("Sign in") && text.includes("loginPathFor(path ?? "));
  // Both navigations keep their own handler (scripts/kai-experience.test.ts:50
  // counts them), and both must offer the truthful alternative.
  check("both navigations still carry their own sign-out handler", (shown.match(/onClick=\{[^}]*signOut\(/g) ?? []).length === 2);
  check("every sign-out handler still clears the Kai cache first", (shown.match(/onClick=\{[^}]*clearKaiPresenceCache\(\)[^}]*signOut\(/g) ?? []).length === 2);
  check("both navigations offer Sign in when the session is resolved absent", (shown.match(/signedOut \? \(/g) ?? []).length === 2);

  // A1-09 reachability.
  check("/help is linked from the account navigation", text.includes('href: "/help", label: "Help"'));
}

// ── 10 — error surfaces, support, help, upload ─────────────────────────────
function testTruthfulSurfaces() {
  // not-found (A1-01): the primary action must be true for a signed-out reader.
  const notFound = rendered("app/not-found.tsx");
  check("404 offers a sign-in route", notFound.includes('href="/login"') && notFound.includes("Sign in"));
  check("404's primary action is the one true for everybody", /<Link href="\/" className="btn-primary/.test(notFound));
  check("404 no longer makes the dashboard the primary action", !/<Link href="\/dashboard" className="btn-primary/.test(notFound));
  check("404 says what the dashboard link will do when signed out", notFound.includes("will ask you to sign in first"));
  check("404 does not claim anything about the credit file changing", notFound.includes("Nothing in your file changed"));

  // A1-12 — adopted from snap/free (commit a130d2d), verbatim.
  const adopted = "We hit a technical error. If you were making a change, confirm its status before retrying.";
  for (const path of ["app/error.tsx", "app/global-error.tsx"]) {
    const text = rendered(path);
    check(`${path} adopts the free lane's truthful boundary copy`, text.includes(adopted));
    check(`${path} no longer claims nothing was lost`, !text.includes("nothing was lost"));
    check(`${path} states it is not a credit decision`, text.includes("is not a credit decision"));
  }

  // A1-09 — /support must work signed out.
  const support = rendered("app/support/page.tsx");
  check("support keeps a 401 as a fact instead of flattening it to an empty list",
    support.includes("r.status === 401") && support.includes("setSignedOut"));
  check("support shows a signed-out panel rather than the ticket desk", support.includes("You&apos;re signed out"));
  check("support offers sign-in with a return to /support", support.includes('loginPathFor("/support")'));
  check("support surfaces the no-account channel", support.includes("support@creditvector.app"));
  check("support tells the truth when a session dies mid-draft", support.includes("your draft is still here"));
  check("support promises no response time", !/within one business day/.test(support));

  // A1-09 — /help must be navigable.
  const help = rendered("app/help/page.tsx");
  check("/help carries the public site chrome", help.includes("<SiteNav />") && help.includes("<SiteFooter />"));
  check("/help offers the no-account support channel", help.includes("support@creditvector.app"));

  // Upload button-label handoff: the route caps the fan-out at 5.
  // Comment-stripped: this slice's own comments quote "No reports uploaded yet"
  // in order to explain why it must never reach an expired session.
  const upload = rendered("app/upload/page.tsx");
  const routeText = src("app/api/reports/analyze/route.ts");
  const cap = /const MAX_FANOUT = (\d+);/.exec(routeText);
  check("the analyze route still declares a fan-out cap", cap !== null);
  check("the button label is an upper bound, not a promise of 'all'",
    upload.includes("Re-analyze up to ${REANALYZE_BATCH}") && upload.includes("const REANALYZE_BATCH = 5"));
  check("the mirrored cap matches the route's own", cap !== null && Number(cap[1]) === 5);
  check("the result line still reads the server's own skipped/notice fields",
    upload.includes("j.skipped") && upload.includes("j.notice"));

  // Review MEDIUM-1: the /upload LIST load, not just the action path.
  check("upload keeps a 401 on the report list as a fact",
    upload.includes("res.status === 401 || res.status === 403") && upload.includes("setSessionEnded(true)"));
  check("upload never shows the empty state to an expired session",
    /\{sessionEnded \? \(/.test(upload) && upload.indexOf("sessionEnded ? (") < upload.indexOf("No reports uploaded yet"));
  check("upload states nothing was deleted and offers a return path",
    upload.includes("Nothing has been deleted") && upload.includes('loginPathFor("/upload")'));

  // Review MEDIUM-2: the app header must not contradict the signed-out panels
  // this slice authored — one shared decision, used by sidebar AND header.
  const hook = rendered("components/useSignedOut.ts");
  check("the signed-out decision lives in one shared client hook",
    hook.includes('status === "unauthenticated"') && hook.includes("export function useSignedOut"));
  const header = rendered("components/HeaderLogout.tsx");
  check("the header offers Sign in when the session is resolved absent",
    header.includes("useSignedOut()") && header.includes("Sign in") && header.includes("loginPathFor(path"));
  check("the header still offers Log out to a live session", header.includes("signOut({ callbackUrl: \"/login\" })"));
  const cta = rendered("components/NewDisputeCta.tsx");
  check("the header CTA does not promise a dispute a signed-out visitor cannot start",
    cta.includes("useSignedOut()") && cta.includes("loginPathFor(") && cta.includes("+ New Dispute"));
  const shell = rendered("components/AppShell.tsx");
  check("AppShell delegates the CTA rather than hardcoding it", shell.includes("<NewDisputeCta />") && !shell.includes('href="/upload"'));

  // Settings: the mid-visit expiry that the segment gate cannot catch.
  const settings = src("app/settings/page.tsx");
  check("settings tells the truth when the session dies mid-visit",
    settings.includes("sessionEnded") && settings.includes("Your session ended"));
  check("settings offers a return path rather than blank fields", settings.includes('loginPathFor("/settings")'));
  check("settings states nothing was removed", settings.includes("Nothing has"));
}

async function main() {
  testCallbackUrl();
  await testMiddleware();
  testMatcherConsistency();
  await testServerGates();
  testOwnedPagesWireTheGate();
  testLoginPage();
  testSidebar();
  testTruthfulSurfaces();

  console.log(`\nsession-recovery.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};
