// Run: npx tsx scripts/score-tracker-auth-runtime.test.ts
//
// REMEDIATION (review round): added a deterministic M-1 block inside
// testScoresRouteIsolation that POSTs the client's ACTUAL payload shape —
// a bare date-only string plus timezoneOffset — reproducing the reviewer's
// own Sydney/UTC+10 worked example via a mocked Date.now, so the case is
// deterministic regardless of when this suite runs. See
// lib/selfReportedScores.ts's isFutureLocalDate for the fix itself.
//
// RUNTIME guard for the Score Tracker's server-side auth gate (S-06) and the
// route's future-date rejection (S-02, server side). This executes the REAL
// app/scores/layout.tsx, the REAL app/api/scores/route.ts, and the REAL
// lib/session.ts (completely unmodified — outside this slice's owned paths)
// over in-file fakes for next-auth / prisma / next/headers. Nothing here is a
// source-text assertion; those live in scripts/score-tracker-self-reported.test.ts.
//
// Style follows the repo's existing scripts/disabled-cancellation-runtime.test.ts
// precedent: a module._load monkey-patch supplies fakes to lib/session.ts's own
// dependencies, then a SECOND patch layer hands the resulting real session
// instance to whatever next imports "@/lib/session" — so the route and layout
// under test run against the actual base auth logic (currentAccount /
// currentUser / currentUserOrDemo, including disabled-account and workspace/
// impersonation-cookie handling), not a stand-in.
//
// SCOPE NOTE (RC1 vs. the p0 source this was adapted from): the p0 lane's
// version of this file also exercised app/login/page.tsx's callback-URL login
// flow and a bespoke currentScoreEntryUserId() this repo does not have. Login
// page internals are outside this slice's owned paths and this base's login
// page does not read a callback URL at all, so that whole scenario is dropped
// rather than adapted. What remains — the layout gate, the client's 401
// handling, and the route's auth + ownership + future-date behavior — is
// exercised against this base's REAL lib/session.ts.

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) { pass++; console.log(`✓ ${label}`); }
  else { fail++; console.error(`✗ ${label}`); }
}

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const NodeModule = require("module") as { _load: Loader };

function clearModule(path: string) {
  delete require.cache[require.resolve(path)];
}

async function flushAsyncEffects() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ── Part 1 — the server layout, over the REAL lib/session.ts ────────────────
async function testServerLayout() {
  const realLoad = NodeModule._load;
  let sessionUserId: string | null = null;
  const users: Record<string, { id: string; role: string; disabled: boolean; isAgency: boolean }> = {
    u1: { id: "u1", role: "USER", disabled: false, isAgency: false },
  };
  const redirects: string[] = [];
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  mutableEnv.NODE_ENV = "production"; // demo-user fallback must not mask the gate

  NodeModule._load = function patched(this: unknown, request, parent, isMain) {
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
      };
    }
    return realLoad.apply(this, [request, parent, isMain]);
  } as Loader;

  try {
    clearModule("../lib/session");
    const session = require("../lib/session") as typeof import("../lib/session");
    const outerPatched = NodeModule._load;
    NodeModule._load = function patched2(this: unknown, request, parent, isMain) {
      if (request === "@/lib/session") return session;
      return outerPatched.apply(this, [request, parent, isMain]);
    } as Loader;

    clearModule("../app/scores/layout");
    const ScoresLayout = (require("../app/scores/layout") as {
      default: (input: { children: unknown }) => Promise<unknown>;
    }).default;

    sessionUserId = null;
    let redirected = false;
    try {
      await ScoresLayout({ children: "protected-score-page" });
    } catch (error) {
      redirected = (error as { digest?: string }).digest === "NEXT_REDIRECT";
    }
    check("server layout refuses a signed-out visitor (production, no demo fallback)", redirected);
    check("server layout redirects to the exact Score Tracker login callback", redirects[0] === "/login?callbackUrl=/scores");

    sessionUserId = "u1";
    redirects.length = 0;
    const rendered = await ScoresLayout({ children: "protected-score-page" });
    check("server layout renders the Score Tracker for a real resolved session", rendered === "protected-score-page" && redirects.length === 0);

    sessionUserId = "missing-row";
    redirects.length = 0;
    let redirectedForGhost = false;
    try {
      await ScoresLayout({ children: "protected-score-page" });
    } catch (error) {
      redirectedForGhost = (error as { digest?: string }).digest === "NEXT_REDIRECT";
    }
    check("server layout fails closed for a session id with no User row", redirectedForGhost);
  } finally {
    NodeModule._load = realLoad;
    clearModule("../app/scores/layout");
    clearModule("../lib/session");
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = previousNodeEnv;
  }
}

// ── Part 2 — the client page's 401 handling on load and submit ──────────────
type ElementLike = { type?: unknown; props?: { children?: unknown; onSubmit?: (event: { preventDefault(): void }) => Promise<void> } };
function findElement(node: unknown, predicate: (element: ElementLike) => boolean): ElementLike | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  const element = node as ElementLike;
  if (predicate(element)) return element;
  return findElement(element.props?.children, predicate);
}

async function testScoresClient401s() {
  const actualReact = require("react") as Record<string, unknown>;
  const globals = globalThis as unknown as Record<string, unknown>;
  const priorReact = globals.React;
  const priorWindow = globals.window;
  const priorFetch = globals.fetch;
  const realLoad = NodeModule._load;

  let hookIndex = 0;
  let stateOverrides = new Map<number, unknown>();
  let setterCalls: Array<{ index: number; value: unknown }> = [];
  let fetchCalls: Array<{ url: string; method: string }> = [];
  let replacements: string[] = [];
  let jsonCalls = 0;
  let fetchImpl: (url: string, init?: { method?: string }) => Promise<unknown>;

  const fakeReact = {
    ...actualReact,
    useState(initial: unknown) {
      const index = hookIndex++;
      const value = stateOverrides.has(index) ? stateOverrides.get(index) : initial;
      return [value, (next: unknown) => setterCalls.push({ index, value: next })];
    },
    useCallback<T>(fn: T) { return fn; },
    useEffect(fn: () => unknown) { fn(); },
    useMemo<T>(fn: () => T) { return fn(); },
  };
  const Icon = () => null;
  const lucide = new Proxy({}, { get: () => Icon });

  NodeModule._load = function patched(this: unknown, request, parent, isMain) {
    if (request === "react") return fakeReact;
    if (request === "lucide-react") return lucide;
    if (request === "@/components/AppShell") return { AppShell: function AppShell() {} };
    if (request === "@/components/Disclaimer") return { EduBanner: function EduBanner() {} };
    return realLoad.apply(this, [request, parent, isMain]);
  } as Loader;

  globals.React = actualReact;
  globals.window = { location: { replace: (path: string) => replacements.push(path) } };
  globals.fetch = (url: string, init?: { method?: string }) => fetchImpl(url, init);

  function reset() {
    hookIndex = 0; stateOverrides = new Map(); setterCalls = []; fetchCalls = []; replacements = []; jsonCalls = 0;
  }

  try {
    clearModule("../app/scores/page");
    const ScoresPage = (require("../app/scores/page") as { default: () => unknown }).default;

    reset();
    fetchImpl = async (url, init) => {
      fetchCalls.push({ url, method: init?.method ?? "GET" });
      return { status: 401, ok: false, json: async () => { jsonCalls++; throw new Error("A 401 body must not be parsed as score data."); } };
    };
    ScoresPage();
    await flushAsyncEffects();
    check("client performs the real score-history GET", fetchCalls.length === 1 && fetchCalls[0]?.url === "/api/scores" && fetchCalls[0]?.method === "GET");
    check("GET 401 sends the browser to the exact login callback", replacements.length === 1 && replacements[0] === "/login?callbackUrl=/scores");
    check("GET 401 is not parsed as a score-history payload", jsonCalls === 0);
    check("GET 401 never renders the generic score-history load error", !setterCalls.some((call) => typeof call.value === "string" && call.value.includes("could not be loaded")));

    reset();
    // Hook 3 is `score` and hook 4 is `date` in app/scores/page.tsx (0-indexed:
    // entries, loading, bureau, score, date, today, busy, error, loadError,
    // confirmation).
    stateOverrides.set(3, "700");
    stateOverrides.set(4, "2026-08-13");
    fetchImpl = async (url, init) => {
      const method = init?.method ?? "GET";
      fetchCalls.push({ url, method });
      if (method === "POST") return { status: 401, ok: false, json: async () => { jsonCalls++; throw new Error("A POST 401 body must not become a form error."); } };
      return { status: 200, ok: true, json: async () => ({ entries: [] }) };
    };
    const tree = ScoresPage();
    await flushAsyncEffects();
    const form = findElement(tree, (element) => element.type === "form");
    if (!form?.props?.onSubmit) throw new Error("Score entry form was not found in the real page tree.");
    await form.props.onSubmit({ preventDefault() {} });
    check("client performs the real visible-form POST after a successful history load", fetchCalls.some((call) => call.url === "/api/scores" && call.method === "POST"));
    check("POST 401 sends the browser to the exact login callback", replacements.length === 1 && replacements[0] === "/login?callbackUrl=/scores");
    check("POST 401 is not parsed as a score-entry error payload", jsonCalls === 0);
    // Hook 7 is `error`.
    check("POST 401 never renders raw Unauthorized text in the visible form", !setterCalls.some((call) => call.index === 7 && typeof call.value === "string"));
  } finally {
    NodeModule._load = realLoad;
    clearModule("../app/scores/page");
    if (priorReact === undefined) delete globals.React; else globals.React = priorReact;
    if (priorWindow === undefined) delete globals.window; else globals.window = priorWindow;
    if (priorFetch === undefined) delete globals.fetch; else globals.fetch = priorFetch;
  }
}

// ── Part 3 — the route: auth, per-user isolation, and future-date rejection ─
interface FakeUser { id: string; role: "USER" | "ADMIN"; disabled: boolean; isAgency: boolean; managedByAgencyId: string | null; }
interface FakeScoreEntry { id: string; userId: string; bureau: string; score: number; recordedAt: Date; createdAt: Date; }

async function testScoresRouteIsolation() {
  const realLoad = NodeModule._load;
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  let sessionUserId: string | null = null;
  const users: Record<string, FakeUser> = {
    a: { id: "a", role: "USER", disabled: false, isAgency: false, managedByAgencyId: null },
    b: { id: "b", role: "USER", disabled: false, isAgency: false, managedByAgencyId: null },
    disabled: { id: "disabled", role: "USER", disabled: true, isAgency: false, managedByAgencyId: null },
  };
  const entries: FakeScoreEntry[] = [];
  let scoreReads = 0;

  const fakePrisma = {
    user: {
      findUnique: async ({ where }: { where: { id?: string } }) => (where.id ? users[where.id] ?? null : null),
      findFirst: async ({ where }: { where: { id?: string; managedByAgencyId?: string } }) => {
        const user = where.id ? users[where.id] : null;
        if (!user) return null;
        if (where.managedByAgencyId && user.managedByAgencyId !== where.managedByAgencyId) return null;
        return user;
      },
    },
    scoreEntry: {
      findMany: async ({ where }: { where: { userId: string } }) => {
        scoreReads++;
        return entries.filter((entry) => entry.userId === where.userId);
      },
      create: async ({ data }: { data: Omit<FakeScoreEntry, "id" | "createdAt"> }) => {
        const entry: FakeScoreEntry = { ...data, id: `score-${entries.length + 1}`, createdAt: new Date("2026-08-13T12:00:00.000Z") };
        entries.push(entry);
        return entry;
      },
    },
  };

  NodeModule._load = function patched(this: unknown, request, parent, isMain) {
    if (request === "next-auth") return { getServerSession: async () => (sessionUserId ? { user: { id: sessionUserId } } : null) };
    if (request === "next/headers") return { cookies: () => ({ get: () => undefined }) };
    if (request === "./auth" || request === "@/lib/auth") return { authOptions: {} };
    if (request === "./prisma" || request === "@/lib/prisma") return { prisma: fakePrisma };
    return realLoad.apply(this, [request, parent, isMain]);
  } as Loader;

  mutableEnv.NODE_ENV = "production"; // demo-user fallback must not mask a 401
  try {
    clearModule("../lib/session");
    clearModule("../app/api/scores/route");
    const sessionModule = require("../lib/session") as typeof import("../lib/session");
    const outerPatched = NodeModule._load;
    NodeModule._load = function patched2(this: unknown, request, parent, isMain) {
      if (request === "@/lib/session") return sessionModule;
      return outerPatched.apply(this, [request, parent, isMain]);
    } as Loader;

    const route = require("../app/api/scores/route") as {
      GET: () => Promise<Response>;
      POST: (request: Request) => Promise<Response>;
    };

    const readsBeforeAnonymous = scoreReads;
    const anonymous = await route.GET();
    check("an unauthenticated API read fails closed with 401", anonymous.status === 401);
    check("an unauthenticated API read never queries ScoreEntry", scoreReads === readsBeforeAnonymous);
    const anonymousPost = await route.POST(new Request("https://app.test/api/scores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bureau: "EQUIFAX", score: 700, recordedAt: "2026-08-01" }),
    }));
    check("an unauthenticated API write fails closed with 401", anonymousPost.status === 401);

    sessionUserId = "a";
    const createA = await route.POST(new Request("https://app.test/api/scores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "b", bureau: "EQUIFAX", score: 620, recordedAt: "2026-08-01" }),
    }));
    const createABody = await createA.json() as { entry?: { userId?: string } };
    check("user A can create a ScoreEntry through the real route", createA.status === 200);
    check("a caller-supplied userId cannot redirect A's write to another account", createABody.entry?.userId === "a" && entries[0]?.userId === "a");

    const readA = await (await route.GET()).json() as { entries?: Array<{ userId?: string }> };
    check("user A reads only A's persisted ScoreEntry", readA.entries?.length === 1 && readA.entries.every((entry) => entry.userId === "a"));

    sessionUserId = "b";
    const readBBefore = await (await route.GET()).json() as { entries?: Array<{ userId?: string }> };
    check("user B cannot read user A's ScoreEntry", readBBefore.entries?.length === 0);
    const createB = await route.POST(new Request("https://app.test/api/scores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "a", bureau: "EXPERIAN", score: 700, recordedAt: "2026-08-02" }),
    }));
    const createBBody = await createB.json() as { entry?: { userId?: string } };
    check("a caller-supplied userId cannot redirect B's write to another account", createB.status === 200 && createBBody.entry?.userId === "b");

    sessionUserId = "disabled";
    check("a disabled session user is refused with 401 (fails through the real lib/session.ts)", (await route.GET()).status === 401);
    sessionUserId = "ghost-no-row";
    check("a session id with no User row is refused with 401", (await route.GET()).status === 401);

    // ── S-02 ADDED: server-side future-date rejection, exercised at runtime ──
    sessionUserId = "a";
    const entriesBeforeFuture = entries.length;
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 days
    const futurePost = await route.POST(new Request("https://app.test/api/scores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bureau: "EQUIFAX", score: 700, recordedAt: farFuture }),
    }));
    const futureBody = await futurePost.json() as { error?: string };
    check("a future-dated POST is rejected with 400", futurePost.status === 400);
    check("the future-date rejection uses the documented message", futureBody.error === "Date recorded cannot be in the future.");
    check("a rejected future-dated POST creates no ScoreEntry row", entries.length === entriesBeforeFuture);

    // A date that is "today" up to the instant of the request must still be
    // accepted — the check is `> Date.now()`, not `>= startOfToday`.
    const entriesBeforeNow = entries.length;
    const rightNow = new Date().toISOString();
    const nowPost = await route.POST(new Request("https://app.test/api/scores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bureau: "TRANSUNION", score: 650, recordedAt: rightNow }),
    }));
    check("a recordedAt at the current instant is accepted, not rejected as future", nowPost.status === 200);
    check("the accepted just-now entry was persisted", entries.length === entriesBeforeNow + 1);

    // One day in the past must remain unaffected by the future-date guard.
    const entriesBeforePast = entries.length;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pastPost = await route.POST(new Request("https://app.test/api/scores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bureau: "EXPERIAN", score: 690, recordedAt: yesterday }),
    }));
    check("a past-dated POST is unaffected by the future-date guard", pastPost.status === 200 && entries.length === entriesBeforePast + 1);

    // ── M-1 (review remediation): the CLIENT's actual payload shape ─────────
    // Every prior future-date case above sends a FULL ISO datetime
    // (`.toISOString()`) — a shape the real client never sends. The real
    // client (app/scores/page.tsx) always sends a bare "YYYY-MM-DD" string
    // plus its own timezoneOffset. Reproduces the review's own worked
    // example verbatim: server "now" = 2026-08-23T20:00:00.000Z (still
    // 2026-08-23 in UTC) while Sydney (UTC+10, getTimezoneOffset() === -600)
    // is already 2026-08-24 — on the pre-fix code this 200 was a 400.
    // Date.now is mocked for exactly this block so the scenario is
    // deterministic regardless of when this suite actually runs.
    sessionUserId = "a";
    const realDateNow = Date.now;
    (Date as { now: () => number }).now = () => new Date("2026-08-23T20:00:00.000Z").getTime();
    try {
      const entriesBeforeSydneyToday = entries.length;
      const sydneyTodayPost = await route.POST(new Request("https://app.test/api/scores", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bureau: "EQUIFAX", score: 705, recordedAt: "2026-08-24", timezoneOffset: -600 }),
      }));
      check("M-1: Sydney's own local today (date-only + its offset) is accepted, not rejected as future", sydneyTodayPost.status === 200);
      check("M-1: the accepted Sydney-today entry was persisted", entries.length === entriesBeforeSydneyToday + 1);

      const entriesBeforeSydneyTomorrow = entries.length;
      const sydneyTomorrowPost = await route.POST(new Request("https://app.test/api/scores", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bureau: "EQUIFAX", score: 706, recordedAt: "2026-08-25", timezoneOffset: -600 }),
      }));
      const sydneyTomorrowBody = await sydneyTomorrowPost.json() as { error?: string };
      check("M-1: a date genuinely beyond Sydney's own today is still rejected with 400", sydneyTomorrowPost.status === 400);
      check("M-1: that rejection uses the documented message", sydneyTomorrowBody.error === "Date recorded cannot be in the future.");
      check("M-1: the rejected beyond-today entry was not persisted", entries.length === entriesBeforeSydneyTomorrow);

      // Fail-closed: the SAME date-only string, with NO timezoneOffset sent,
      // falls back to the strict prior check and IS rejected — proving the
      // fix does not weaken the guard for a caller that omits the offset.
      const entriesBeforeNoOffset = entries.length;
      const noOffsetPost = await route.POST(new Request("https://app.test/api/scores", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bureau: "EQUIFAX", score: 707, recordedAt: "2026-08-24" }),
      }));
      check("M-1: the identical date-only string with NO offset fails closed to 400", noOffsetPost.status === 400);
      check("M-1: the fail-closed rejection persisted nothing", entries.length === entriesBeforeNoOffset);

      // Clamp: an absurd offset cannot buy more than 14h of leniency — two
      // calendar days beyond the server's own UTC date is still refused even
      // though the claimed offset implies "far ahead of UTC".
      const entriesBeforeAbuse = entries.length;
      const clampAbusePost = await route.POST(new Request("https://app.test/api/scores", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bureau: "EQUIFAX", score: 708, recordedAt: "2026-08-25", timezoneOffset: -999999 }),
      }));
      check("M-1: an absurd offset is clamped to 14h, not trusted verbatim — two days out is still refused", clampAbusePost.status === 400);
      check("M-1: the clamp-bounded rejection persisted nothing", entries.length === entriesBeforeAbuse);
    } finally {
      Date.now = realDateNow;
    }
  } finally {
    NodeModule._load = realLoad;
    clearModule("../app/api/scores/route");
    clearModule("../lib/session");
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = previousNodeEnv;
  }
}

async function main() {
  await testServerLayout();
  await testScoresClient401s();
  await testScoresRouteIsolation();
  console.log(`\nscore-tracker-auth-runtime.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error("score-tracker-auth-runtime.test.ts harness failure", error);
  process.exit(1);
});
