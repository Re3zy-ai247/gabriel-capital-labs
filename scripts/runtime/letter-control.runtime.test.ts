// Run: npx --no-install tsx scripts/runtime/letter-control.runtime.test.ts
// (registration line for scripts/runtime/run-all.ts REQUIRED, added by the
//  coordinator at merge: "letter-control.runtime.test.ts",)
//
// RC1-S5 (P1-31 / A3 L-01, L-03, L-11) — executes the REAL route handlers and
// asserts on what they DID: the status they returned, the rows that exist
// afterwards, whether anything was charged, and — the part a source-level guard
// cannot see — whether the letter body actually changed.
//
// A source guard can prove a rule is written down. Only this can prove the rule
// FIRES: that a mailed letter is genuinely immutable, that a refused sentence
// leaves the stored body untouched, that "mark mailed" is unreachable before the
// consumer approves, that RESOLVED writes to the tradeline only when they say
// the item was corrected, and that a round-2 refusal costs no allowance.
//
// Offline: no database, no network, no keys. `lib/letter.ts` and
// `lib/compliance.ts` are the REAL modules — they are the code under test. Only
// the I/O boundaries (Prisma, session, rate limit, entitlements, crypto, AI,
// analytics, mail-date validation) are replaced.
//
// NON-VACUITY (measured 2026-08-24; each pre-fix file reverted and restored
// immediately afterwards, never committed):
//   · merged candidate `bd6cfbb` (lib/letter.ts, app/letters/page.tsx,
//     app/api/letters/generate/route.ts)                            → 160 passed, 13 failed (exit 1)
//     — NEW-2 (generate returned 200 and left two live round-1 letters on one
//       tradeline), AD-R2-1 (the identity correction letter could not be
//       approved, printed or mailed)
//   · release candidate `59f2afd` (route + page + lib files)        → 131 passed, 23 failed (exit 1)
//   · branch base `31d4e35:app/api/letters/[id]/route.ts`           →  75 passed, 40 failed (exit 1)
//   · branch base `31d4e35:app/api/letters/[id]/round2/route.ts`    → 102 passed, 13 failed (exit 1)
//   · branch base `31d4e35:app/api/letters/[id]/response/route.ts`  → 110 passed,  5 failed (exit 1)
//   · this tree                                                     → 173 passed,  0 failed (exit 0)
import { check, loadModule, mockModule, run, section } from "./_harness";
import { letterAuthorizationRevoked } from "../../lib/letter";

export {};

type Json = Record<string, unknown>;

// ── the fake database ────────────────────────────────────────────────────────
// NOT a database. It implements exactly the queries these two routes issue and
// THROWS on any shape it does not recognize — a silent "no rows" would let a
// rewritten query pass unexamined.
interface TradelineRow {
  id: string;
  userId: string;
  creditorName: string;
  originalCreditor: string | null;
  accountNumberMask: string | null;
  accountType: string;
  balance: number;
  dateOfFirstDelinquency: Date | null;
  bureauData: unknown;
  resolved: boolean;
}
interface AssertionRow {
  userId: string;
  tradelineId: string | null;
  assertionType: string;
  consumerNote: string | null;
  bureauScope: string | null;
  status: string;
  createdAt: Date;
}
interface LetterRow {
  id: string;
  userId: string;
  tradelineId: string | null;
  strategy: string;
  recipientType: string;
  recipientName: string;
  targetBureau: string | null;
  round: number;
  parentLetterId: string | null;
  body: string;
  complianceFlags: string[];
  status: string;
  createdAt: Date;
  mailedAt: Date | null;
  responseText: string | null;
  responseOutcome: string | null;
  responseAnalysis: string | null;
  responseAt: Date | null;
}

class FakeDb {
  tradelines: TradelineRow[] = [];
  assertions: AssertionRow[] = [];
  letters: LetterRow[] = [];
  readonly calls: string[] = [];
  private seq = 0;

  reset() {
    this.tradelines = [];
    this.assertions = [];
    this.letters = [];
    this.calls.length = 0;
  }

  letter = {
    // The regenerate planner reads `status` (S4's select, S5's rule). A fake
    // that dropped it is what let the AD-3 seam look live while it was inert.
    findMany: async (args: {
      where: { userId?: string; tradelineId?: string; strategy?: string; round?: number };
    }) => {
      this.calls.push("letter.findMany");
      const w = args.where ?? {};
      return this.letters
        .filter(
          (l) =>
            (w.userId === undefined || l.userId === w.userId) &&
            (w.tradelineId === undefined || l.tradelineId === w.tradelineId) &&
            (w.strategy === undefined || l.strategy === w.strategy) &&
            (w.round === undefined || l.round === w.round)
        )
        .map((l) => ({ id: l.id, targetBureau: l.targetBureau, mailedAt: l.mailedAt, status: l.status }));
    },
    findFirst: async (args: { where: { id: string; userId: string } }) => {
      this.calls.push("letter.findFirst");
      const w = args.where ?? ({} as { id: string; userId: string });
      if (!w.id || !w.userId) throw new Error("letter.findFirst must be scoped to id + userId (IDOR)");
      const row = this.letters.find((l) => l.id === w.id && l.userId === w.userId) ?? null;
      if (!row) return null;
      const tradeline = this.tradelines.find((t) => t.id === row.tradelineId) ?? null;
      return { ...row, tradeline };
    },
    update: async (args: { where: { id: string }; data: Partial<LetterRow> }) => {
      this.calls.push("letter.update");
      const row = this.letters.find((l) => l.id === args.where.id);
      if (!row) throw new Error("letter missing");
      Object.assign(row, args.data);
      return { ...row };
    },
    create: async (args: { data: Partial<LetterRow> }) => {
      this.calls.push("letter.create");
      this.seq += 1;
      const row: LetterRow = {
        id: `l_${this.seq}`,
        userId: String(args.data.userId),
        tradelineId: (args.data.tradelineId as string | null) ?? null,
        strategy: String(args.data.strategy),
        recipientType: String(args.data.recipientType),
        recipientName: String(args.data.recipientName),
        targetBureau: (args.data.targetBureau as string | null) ?? null,
        round: Number(args.data.round ?? 1),
        parentLetterId: (args.data.parentLetterId as string | null) ?? null,
        body: String(args.data.body),
        complianceFlags: (args.data.complianceFlags as string[]) ?? [],
        status: "GENERATED",
        createdAt: new Date(),
        mailedAt: null,
        responseText: null,
        responseOutcome: null,
        responseAnalysis: null,
        responseAt: null,
      };
      this.letters.push(row);
      return { ...row };
    },
    delete: async (args: { where: { id: string } }) => {
      this.calls.push("letter.delete");
      this.letters = this.letters.filter((l) => l.id !== args.where.id);
      return {};
    },
  };

  tradeline = {
    findFirst: async (args: { where: { id: string; userId: string } }) => {
      this.calls.push("tradeline.findFirst");
      const w = args.where ?? ({} as { id: string; userId: string });
      if (!w.userId) throw new Error("tradeline.findFirst must be scoped to the caller (IDOR)");
      return this.tradelines.find((t) => t.id === w.id && t.userId === w.userId) ?? null;
    },
    update: async (args: { where: { id: string }; data: Partial<TradelineRow> }) => {
      this.calls.push("tradeline.update");
      const row = this.tradelines.find((t) => t.id === args.where.id);
      if (!row) throw new Error("tradeline missing");
      Object.assign(row, args.data);
      return { ...row };
    },
  };

  consumerAssertion = {
    // S11 AD-2 (S4's cross-slice edit into the PATCH route): the authorization
    // check counts the ACTIVE confirmations still standing behind a letter.
    count: async (args: { where: { userId: string; tradelineId: string; status: string } }) => {
      this.calls.push("consumerAssertion.count");
      const w = args.where ?? ({} as { userId: string; tradelineId: string; status: string });
      if (!w.userId) throw new Error("assertion count must be scoped to the caller");
      return this.assertions.filter(
        (a) =>
          a.userId === w.userId &&
          (w.tradelineId === undefined || a.tradelineId === w.tradelineId) &&
          (w.status === undefined || a.status === w.status)
      ).length;
    },
    // Used by app/api/letters/route.ts (S4's AD-2 block, same retroactive grant).
    // That route is not loaded by this guard today; the method exists so the
    // harness covers every model call S4 added to the three files it edited,
    // instead of failing the next time one of them is executed here.
    groupBy: async (args: { by: string[]; where: { userId: string; status: string; tradelineId?: { in: string[] } } }) => {
      this.calls.push("consumerAssertion.groupBy");
      const w = args.where ?? ({} as { userId: string; status: string; tradelineId?: { in: string[] } });
      if (!w.userId) throw new Error("assertion groupBy must be scoped to the caller");
      if (args.by?.join(",") !== "tradelineId") throw new Error(`unrecognized groupBy: ${args.by?.join(",")}`);
      const counts = new Map<string | null, number>();
      for (const a of this.assertions) {
        if (a.userId !== w.userId) continue;
        if (w.status !== undefined && a.status !== w.status) continue;
        if (w.tradelineId?.in && !w.tradelineId.in.includes(a.tradelineId ?? "")) continue;
        counts.set(a.tradelineId, (counts.get(a.tradelineId) ?? 0) + 1);
      }
      return Array.from(counts, ([tradelineId, n]) => ({ tradelineId, _count: { _all: n } }));
    },
    findMany: async (args: { where: { userId: string; tradelineId: string; status: string } }) => {
      this.calls.push("consumerAssertion.findMany");
      const w = args.where ?? ({} as { userId: string; tradelineId: string; status: string });
      if (!w.userId) throw new Error("assertion lookup must be scoped to the caller");
      return this.assertions
        .filter(
          (a) =>
            a.userId === w.userId &&
            (w.tradelineId === undefined || a.tradelineId === w.tradelineId) &&
            (w.status === undefined || a.status === w.status)
        )
        .map((a) => ({
          assertionType: a.assertionType,
          consumerNote: a.consumerNote,
          bureauScope: a.bureauScope,
          status: a.status,
        }));
    },
  };
}

const db = new FakeDb();
const USER = {
  id: "u1",
  fullName: "Jane Q. Consumer",
  addressLine1: "1 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
};
const OTHER_USER = { ...USER, id: "u2", fullName: "Someone Else" };
let sessionUser: Json | null = USER;

// RC1-S6a: `spend` can no longer move — Founder D-3 froze purchased credits and
// the routes dropped the call — so a bare `spend.length === 0` is structurally
// vacuous and would ship false coverage. Every such assertion below is paired
// with the append-only ledger, which is the only accounting left.
const spend: number[] = [];
/** Every consumer id the route declared to the AI meter, in order (review B-1). */
const aiPrincipals: string[] = [];
let budgetExhausted = false;
const ledgered = () => tracked.filter((t) => t.event === "dispute_created");
const kaiEvents: { type: string; payload: Json }[] = [];
const tracked: { event: string; meta: Json }[] = [];
let aiCalls = 0;

mockModule("lib/prisma.ts", { prisma: db });
mockModule("lib/session.ts", { currentUserOrDemo: async () => sessionUser });
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/kaiEvents.ts", {
  recordKaiEvent: async (_u: string, type: string, opts: { payload?: Json }) => {
    kaiEvents.push({ type, payload: opts?.payload ?? {} });
  },
});
mockModule("lib/events.ts", {
  track: async (event: string, opts: { meta?: Json }) => {
    tracked.push({ event, meta: opts?.meta ?? {} });
  },
  PRODUCT_EVENTS: { disputeCreated: "dispute_created", disputeCompleted: "dispute_completed", failure: "failure" },
});
// Deliberately transparent so a stored body can be inspected: anything the route
// persists must be `enc:`-prefixed, and anything it returns must not be.
mockModule("lib/docCrypto.ts", {
  encryptText: (s: string) => `enc:${s}`,
  decryptText: (s: string) => (s.startsWith("enc:") ? s.slice(4) : s),
});
mockModule("lib/mailCenter.ts", {
  validateMailedAtInput: (v: unknown) => ({ ok: true, date: typeof v === "string" && v ? new Date(`${v}T12:00:00Z`) : null }),
});
mockModule("lib/entitlements.ts", {
  getEntitlement: async () => ({ premium: false, aiRefinement: false, lettersRemaining: 3 }),
  canGenerateLetter: () => ({ allowed: true }),
  spendLetterCredits: async (_u: string, _e: unknown, n: number) => {
    spend.push(n);
  },
});
// RC1-S11 (review B-1): the meter boundary. `withAiPrincipal` is the control
// under test here — the route must OPEN a principal around the response
// analysis, because with none lib/aiMeter.ts skips reserveDailyBudget entirely
// and the spend lands unattributed and unbudgeted. The fake records who was
// declared and can simulate the refusal the real reservation raises.
class FakeAiSpendRefusal extends Error {
  constructor(readonly reason: string, message: string) {
    super(message);
    this.name = "AiSpendRefusal";
  }
}
mockModule("lib/aiMeter.ts", {
  meteredMessage: async (label: string) => {
    aiCalls += 1;
    // The identity correction letter is the ONE surface here that is composed by
    // the model rather than the template, so a canned draft stands in for it.
    // Everything else must still never reach a provider.
    if (label === "identity-letter") {
      return {
        content: [
          {
            type: "text",
            text: [
              "Jane Q. Consumer",
              "1 Main St",
              "Austin, TX 78701",
              "",
              "RE: Correction of personal information",
              "",
              "To Whom It May Concern,",
              "",
              "The mailing address reported on my file is not correct. I ask that it be corrected to the address above.",
              "",
              "Respectfully,",
              "Jane Q. Consumer",
            ].join("\n"),
          },
        ],
      };
    }
    throw new Error("no AI call may happen in this guard");
  },
  AiSpendRefusal: FakeAiSpendRefusal,
  withAiPrincipal: async <T>(userId: string, fn: () => Promise<T>): Promise<T> => {
    aiPrincipals.push(userId);
    if (budgetExhausted) {
      throw new FakeAiSpendRefusal("budget-exhausted", "You have used today's AI budget on this account.");
    }
    return fn();
  },
});
// The response route's own I/O boundaries. `lib/round2.ts` is NOT mocked:
// analyzeResponse returns null with no ANTHROPIC_API_KEY, which is the offline
// path, and the round-2 route needs the real buildRound2UserPrompt.
mockModule("lib/pdf.ts", { extractPdfText: async () => "" });
mockModule("lib/furnisher.ts", {
  getFurnisherContact: async () => null,
  formatFurnisherAddress: () => null,
});
mockModule("lib/outcomeLedger.ts", { recordVerifiedOutcome: async () => undefined });

const letterRoute = loadModule<{
  GET: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
  PATCH: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
  DELETE: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
}>("app/api/letters/[id]/route.ts");
const round2 = loadModule<{ POST: (req: Request, ctx: { params: { id: string } }) => Promise<Response> }>(
  "app/api/letters/[id]/round2/route.ts"
);
const responseRoute = loadModule<{ POST: (req: Request, ctx: { params: { id: string } }) => Promise<Response> }>(
  "app/api/letters/[id]/response/route.ts"
);
const generate = loadModule<{ POST: (req: Request) => Promise<Response> }>("app/api/letters/generate/route.ts");
const identityLetter = loadModule<{ POST: (req: Request) => Promise<Response> }>("app/api/identity/letter/route.ts");

const TEMPLATE_BODY = [
  "Jane Q. Consumer",
  "1 Main St",
  "Austin, TX 78701",
  "",
  "RE: Dispute of Midland Funding LLC account XXXX-1234",
  "",
  "To Whom It May Concern,",
  "",
  "I have reviewed the information associated with the above account.",
  "",
  "Respectfully,",
].join("\n");

function seedTradeline(id = "t1", userId = "u1"): TradelineRow {
  const row: TradelineRow = {
    id,
    userId,
    creditorName: "Midland Funding LLC",
    originalCreditor: "Synchrony Bank",
    accountNumberMask: "XXXX-1234",
    accountType: "COLLECTION",
    balance: 128900,
    dateOfFirstDelinquency: new Date("2021-03-01"),
    bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 128900, dofd: "2021-03-01" } },
    resolved: false,
  };
  db.tradelines.push(row);
  return row;
}

function seedLetter(over: Partial<LetterRow> = {}): LetterRow {
  const row: LetterRow = {
    id: over.id ?? "l1",
    userId: over.userId ?? "u1",
    tradelineId: over.tradelineId === undefined ? "t1" : over.tradelineId,
    strategy: over.strategy ?? "fcra_611",
    recipientType: "bureau",
    recipientName: "Equifax Information Services LLC",
    targetBureau: over.targetBureau === undefined ? "EQUIFAX" : over.targetBureau,
    round: over.round ?? 1,
    parentLetterId: null,
    body: over.body ?? `enc:${TEMPLATE_BODY}`,
    complianceFlags: [],
    status: over.status ?? "GENERATED",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    mailedAt: over.mailedAt ?? null,
    responseText: over.responseText ?? null,
    responseOutcome: over.responseOutcome ?? null,
    responseAnalysis: null,
    responseAt: null,
  };
  db.letters.push(row);
  return row;
}

function seedAssertion(over: Partial<AssertionRow> = {}): void {
  db.assertions.push({
    userId: over.userId ?? "u1",
    tradelineId: over.tradelineId === undefined ? "t1" : over.tradelineId,
    assertionType: over.assertionType ?? "paid_settled",
    consumerNote: over.consumerNote ?? null,
    bureauScope: over.bureauScope ?? null,
    status: over.status ?? "ACTIVE",
    createdAt: new Date(),
  });
}

const patch = (id: string, body: Json) =>
  new Request(`http://localhost/api/letters/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const post = (id: string, body?: Json) =>
  new Request(`http://localhost/api/letters/${id}/round2`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const logResponse = (id: string, text: string, init?: RequestInit) =>
  new Request(`http://localhost/api/letters/${id}/response`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    ...init,
  });

async function json(res: Response): Promise<Json> {
  try {
    return (await res.json()) as Json;
  } catch {
    return {};
  }
}
const stored = (id: string) => db.letters.find((l) => l.id === id)!.body;

function resetAll() {
  db.reset();
  spend.length = 0;
  aiPrincipals.length = 0;
  budgetExhausted = false;
  kaiEvents.length = 0;
  tracked.length = 0;
  aiCalls = 0;
  sessionUser = USER;
}

run("letter-control.runtime", async () => {
  // ── 1. authentication and ownership ───────────────────────────────────────
  section("a letter is reachable only by the person it belongs to");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    sessionUser = null;
    check("GET is 401 signed out", (await letterRoute.GET(patch("l1", {}), { params: { id: "l1" } })).status === 401);
    check("PATCH is 401 signed out", (await letterRoute.PATCH(patch("l1", { status: "PRINTED" }), { params: { id: "l1" } })).status === 401);
    check("DELETE is 401 signed out", (await letterRoute.DELETE(patch("l1", {}), { params: { id: "l1" } })).status === 401);
    check("round 2 is 401 signed out", (await round2.POST(post("l1"), { params: { id: "l1" } })).status === 401);
    check("nothing was written while signed out", db.letters.length === 1 && db.letters[0].status === "GENERATED");

    sessionUser = OTHER_USER;
    const idor = await letterRoute.PATCH(patch("l1", { body: "Someone else's letter, rewritten by me." }), { params: { id: "l1" } });
    check("IDOR: another user's letter is 404, not 403 (existence is not disclosed)", idor.status === 404);
    check("IDOR: the body was not touched", stored("l1") === `enc:${TEMPLATE_BODY}`);
    const idorRound2 = await round2.POST(post("l1"), { params: { id: "l1" } });
    check("IDOR: round 2 on another user's letter is 404", idorRound2.status === 404);
    check("IDOR: nothing was charged and nothing was accounted for",
      spend.length === 0 && ledgered().length === 0);
    sessionUser = USER;
  }

  // ── 2. the consumer can edit the letter they will sign (A3 L-01) ──────────
  section("editing a draft");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    const edited = `${TEMPLATE_BODY}\n\nP.S. The balance shown is not the amount I owed when this account closed.`;
    const res = await letterRoute.PATCH(patch("l1", { body: edited }), { params: { id: "l1" } });
    const body = await json(res);
    check("the edit is accepted (200)", res.status === 200);
    check("the stored body is EXACTLY what the consumer wrote", stored("l1") === `enc:${edited}`);
    check("…and is stored encrypted, not plaintext", stored("l1").startsWith("enc:"));
    check("the response returns the saved body in plaintext for immediate render", ((body.letter as Json)?.body as string) === edited);
    check("an edited letter becomes the consumer's own draft", db.letters[0].status === "DRAFT");
    check("nothing was adjusted — no rule fired on ordinary prose", body.adjusted === false);
    check("no AI call happened anywhere in the edit path", aiCalls === 0);
    check("editing costs no letter allowance and adds nothing to the ledger",
      spend.length === 0 && ledgered().length === 0);
  }

  section("the edit is bounded and sanitized, never silently reformatted");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    const short = await letterRoute.PATCH(patch("l1", { body: "Delete it." }), { params: { id: "l1" } });
    check("an empty-ish letter is refused (400)", short.status === 400);
    check("…and nothing was saved", stored("l1") === `enc:${TEMPLATE_BODY}`);

    const huge = await letterRoute.PATCH(patch("l1", { body: "A".repeat(20_001) }), { params: { id: "l1" } });
    check("an unbounded body is refused (400)", huge.status === 400);
    check("…and nothing was saved", stored("l1") === `enc:${TEMPLATE_BODY}`);

    const spaced = "Line one.\n\n   Indented, on purpose.\n\tTabbed line.\n\nEnd of my letter.";
    const keep = await letterRoute.PATCH(patch("l1", { body: spaced }), { params: { id: "l1" } });
    check("whitespace-heavy text is accepted", keep.status === 200);
    check("their indentation, tabs and blank lines survive exactly", stored("l1") === `enc:${spaced}`);

    const crlf = await letterRoute.PATCH(patch("l1", { body: "First line.\r\nSecond line.\r\nThird line is here." }), { params: { id: "l1" } });
    check("CRLF is normalized to one line-ending convention", crlf.status === 200 && stored("l1") === "enc:First line.\nSecond line.\nThird line is here.");

    // Written with escapes on purpose: a literal NUL or bidi override in this
    // source file would make the guard itself binary to grep (the same reason
    // lib/letter.ts writes its class that way).
    const hostile = "A letter with a \u0000 null and a \u202E bidi override in it, which cannot print.";
    const ctrl = await letterRoute.PATCH(patch("l1", { body: hostile }), { params: { id: "l1" } });
    check("control and bidi-override characters are stripped", ctrl.status === 200 && !/[\u0000\u202E]/.test(stored("l1")));
    check("…and the rest of their sentence is left alone", /A letter with a\s+null and a\s+bidi override in it, which cannot print\./.test(stored("l1")));
  }

  // ── 3. the compliance bar runs on the consumer's own words (S4 M-4) ───────
  section("a refused sentence is refused — never silently rewritten");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    const withThreat = `${TEMPLATE_BODY}\n\nYou are legally obligated to delete this account or I will sue for $1,000.`;
    const res = await letterRoute.PATCH(patch("l1", { body: withThreat }), { params: { id: "l1" } });
    const body = await json(res);
    check("the save is refused (400)", res.status === 400);
    check("NOTHING was saved — their words are still theirs to fix", stored("l1") === `enc:${TEMPLATE_BODY}`);
    const refusals = (body.complianceRefusals as { sentence: string; why: string }[]) ?? [];
    check("the refusal names the exact sentence", refusals.length >= 1 && /legally obligated/.test(refusals[0].sentence));
    check("…and explains why, in plain language", refusals.every((r) => typeof r.why === "string" && r.why.length > 40));
    check("the letter status did not change", db.letters[0].status === "GENERATED");
  }

  section("a whole-sentence rewrite is saved, and the adjustment is shown");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    // The rule's match IS the sentence: replacing it drops nothing the consumer
    // wrote, so it saves and the change is shown before approval.
    const demand = `${TEMPLATE_BODY}\n\nThis account must be deleted.`;
    const res = await letterRoute.PATCH(patch("l1", { body: demand }), { params: { id: "l1" } });
    const body = await json(res);
    check("the save succeeds (200)", res.status === 200);
    check("the stored letter no longer carries the demand", !/This account must be deleted\./.test(stored("l1")));
    check("…and carries the coherent replacement instead", /I request that this account be deleted or corrected if it cannot be verified/.test(stored("l1")));
    check("the mangling defects are gone (no lower-case fragment, no doubled article)", /^[A-Z]/.test(stored("l1").split("\n").pop()!.trim()) && !/ the the /i.test(stored("l1")));
    check("the response flags that something changed", body.adjusted === true);
    const adj = (body.complianceAdjustments as { sentence: string; replacedWith: string; why: string }[]) ?? [];
    check("…and shows the before, the after and the reason", adj.length === 1 && /must be deleted/i.test(adj[0].sentence) && adj[0].replacedWith.length > 40 && adj[0].why.length > 40);
    check("the returned body is the SAVED body, so the editor shows what will print", ((body.letter as Json)?.body as string) === stored("l1").slice(4));
    check("the adjustment is recorded on the row for the compliance record", db.letters[0].complianceFlags.length === 1);
  }

  // ── 3b. REVIEW H-1 — a partial match never destroys the consumer's facts ──
  section("a sentence carrying the consumer's own evidence is refused, not rewritten");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    // The reviewer's measured case: the prohibited claim is welded to the
    // payment date the whole dispute rests on.
    const mixed = `${TEMPLATE_BODY}\n\nI paid this account in full in March 2023 and you failed to investigate my dispute.`;
    const res = await letterRoute.PATCH(patch("l1", { body: mixed }), { params: { id: "l1" } });
    const body = await json(res);
    check("the save is refused (400)", res.status === 400);
    check("NOTHING was saved — the consumer's payment date is not destroyed", stored("l1") === `enc:${TEMPLATE_BODY}`);
    check("…and the stored body never contains words they did not write", !/does not appear to reflect a reasonable reinvestigation/.test(stored("l1")));
    const refusals = (body.complianceRefusals as { sentence: string; why: string; suggestion: string; partial: boolean }[]) ?? [];
    check("the refusal quotes their whole sentence back, payment fact included", refusals.length === 1 && /I paid this account in full in March 2023/.test(refusals[0].sentence));
    check("…marked as a partial match", refusals[0]?.partial === true);
    check("…with a suggested compliant wording for them to adopt", (refusals[0]?.suggestion ?? "").length > 40);
    check("…and a plain-language reason", (refusals[0]?.why ?? "").length > 40);
    check("the letter status did not change", db.letters[0].status === "GENERATED");
  }

  // ── 4. approval, and what it gates ────────────────────────────────────────
  section("approve before mail — and a mailed letter is a record, not a draft");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    // S11 AD-2 (S4): a letter only exists because a confirmation authorized it,
    // and approval is now gated on that confirmation still standing. Seeding it
    // is what makes this fixture a real letter rather than an orphan.
    seedAssertion();
    const early = await letterRoute.PATCH(patch("l1", { status: "MAILED", mailedAt: "2026-08-02" }), { params: { id: "l1" } });
    check("marking an unapproved letter mailed is refused (409)", early.status === 409);
    check("…and it was NOT mailed", db.letters[0].mailedAt === null && db.letters[0].status === "GENERATED");
    check("…and the refusal says what to do first", /approve/i.test(String((await json(early)).error)));

    const approve = await letterRoute.PATCH(patch("l1", { status: "PRINTED" }), { params: { id: "l1" } });
    check("approval is accepted (200)", approve.status === 200 && db.letters[0].status === "PRINTED");

    const editApproved = await letterRoute.PATCH(patch("l1", { body: `${TEMPLATE_BODY}\n\nAdded after approval.` }), { params: { id: "l1" } });
    check("an approved letter cannot be edited underneath the approval (409)", editApproved.status === 409);
    check("…and the body is unchanged", stored("l1") === `enc:${TEMPLATE_BODY}`);

    const reopen = await letterRoute.PATCH(patch("l1", { status: "DRAFT" }), { params: { id: "l1" } });
    check("approval is reversible — re-open for editing (200)", reopen.status === 200 && db.letters[0].status === "DRAFT");
    const reApprove = await letterRoute.PATCH(patch("l1", { status: "PRINTED" }), { params: { id: "l1" } });
    check("…and re-approvable", reApprove.status === 200);

    const mailed = await letterRoute.PATCH(patch("l1", { status: "MAILED", mailedAt: "2026-08-02" }), { params: { id: "l1" } });
    check("an approved letter can be marked mailed (200)", mailed.status === 200);
    check("…and the mailing date is stamped", db.letters[0].mailedAt !== null);
    check("…and the event records it once", kaiEvents.filter((e) => e.type === "letter.mailed").length === 1);

    const editMailed = await letterRoute.PATCH(patch("l1", { body: "Rewriting history." }), { params: { id: "l1" } });
    check("a MAILED letter's body is immutable (409)", editMailed.status === 409);
    check("…and the stored record still says what was mailed", stored("l1") === `enc:${TEMPLATE_BODY}`);
    check("…and the refusal says it is the record of what was sent", /already been mailed/i.test(String((await json(editMailed)).error)));

    const backwards = await letterRoute.PATCH(patch("l1", { status: "DRAFT" }), { params: { id: "l1" } });
    check("a mailed letter cannot be walked back to a draft (409)", backwards.status === 409 && db.letters[0].status === "MAILED");
  }

  section("the transition guard rejects jumps that skip the process");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    const straightToResolved = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "corrected_or_deleted" }), { params: { id: "l1" } });
    check("a never-mailed letter cannot be marked resolved (409)", straightToResolved.status === 409);
    check("…and the tradeline was not touched", db.tradelines[0].resolved === false && !db.calls.includes("tradeline.update"));

    const nonsense = await letterRoute.PATCH(patch("l1", { status: "NOT_A_STATUS" }), { params: { id: "l1" } });
    check("an unknown status is still rejected (400)", nonsense.status === 400);
  }

  // ── 5. RESOLVED states a claim, so the consumer makes it (A3 L-11) ────────
  section("closing a dispute out records what the consumer actually said");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    const bare = await letterRoute.PATCH(patch("l1", { status: "RESOLVED" }), { params: { id: "l1" } });
    check("RESOLVED with no stated outcome is refused (400)", bare.status === 400);
    check("…and the tradeline is untouched — the old code flipped it here", db.tradelines[0].resolved === false);
    const bareBody = await json(bare);
    check("…and the refusal offers the actual choices", Array.isArray(bareBody.options) && (bareBody.options as unknown[]).length === 2);

    const stillReported = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "closed_no_change" }), { params: { id: "l1" } });
    check("closing out with the item still reported is accepted (200)", stillReported.status === 200 && db.letters[0].status === "RESOLVED");
    check("…and does NOT claim the item was resolved", db.tradelines[0].resolved === false);
    check("…and the recorded event says what happened and that the consumer said it", kaiEvents.some((e) => e.type === "dispute.resolved" && e.payload.outcome === "closed_no_change" && e.payload.selfReported === true && e.payload.tradelineMarkedResolved === false));
    check("…and the dispute still counts as completed once", tracked.filter((t) => t.event === "dispute_completed").length === 1);

    const again = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "corrected_or_deleted" }), { params: { id: "l1" } });
    check("re-PATCHing an already-resolved letter changes nothing (idempotent)", again.status === 200);
    check("…the funnel metric is not inflated", tracked.filter((t) => t.event === "dispute_completed").length === 1);
    check("…and it cannot retroactively flip the tradeline", db.tradelines[0].resolved === false);
  }
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    const fixed = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "corrected_or_deleted" }), { params: { id: "l1" } });
    check("stating the item was corrected or removed is accepted (200)", fixed.status === 200);
    check("…and only THAT writes resolved to the tradeline", db.tradelines[0].resolved === true);
    check("…recorded as the consumer's own report", kaiEvents.some((e) => e.type === "dispute.resolved" && e.payload.selfReported === true && e.payload.tradelineMarkedResolved === true));
  }

  // ── 5b. REVIEW M-5 — every writer of a status answers to one lifecycle ────
  section("a response cannot be logged against a letter that never went out");
  {
    resetAll();
    seedTradeline();
    seedLetter(); // GENERATED: never approved, never mailed
    const logged = await responseRoute.POST(
      new Request("http://localhost/api/letters/l1/response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "We have completed our reinvestigation and verified the item as accurate." }),
      }),
      { params: { id: "l1" } }
    );
    check("logging a response on an unmailed letter is refused (409)", logged.status === 409);
    check("…and says what to do first", /mailed first/i.test(String((await json(logged)).error)));
    check("…the letter is untouched", db.letters[0].status === "GENERATED" && db.letters[0].responseText === null);

    // …which closes the path to a resolved dispute on a letter nobody sent.
    const resolve = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "corrected_or_deleted" }), { params: { id: "l1" } });
    check("RESOLVED is therefore unreachable (409)", resolve.status === 409);
    check("…and tradeline.resolved was never written", db.tradelines[0].resolved === false && !db.calls.includes("tradeline.update"));
  }
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    const logged = await responseRoute.POST(
      new Request("http://localhost/api/letters/l1/response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "We have completed our reinvestigation and verified the item as accurate." }),
      }),
      { params: { id: "l1" } }
    );
    check("a response on a MAILED letter is accepted (200)", logged.status === 200);
    check("…and the letter advances", db.letters[0].status === "RESPONSE_RECEIVED" && db.letters[0].responseText !== null);
    check("…offline, with no assessment claimed", (await json(logged)).needsAI === true);
    const resolve = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "corrected_or_deleted" }), { params: { id: "l1" } });
    check("and RESOLVED is reachable from a real mailing lineage", resolve.status === 200 && db.tradelines[0].resolved === true);
  }

  // ── 6. round 2 answers to round 1's rule (S4 handoff) ─────────────────────
  section("round 2 refuses to escalate on facts nobody confirmed — at no cost");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02"), responseText: "enc:We verified the item as accurate.", responseOutcome: "verified" });
    const res = await round2.POST(post("l1"), { params: { id: "l1" } });
    const body = await json(res);
    check("the refusal is 400 (not a server error, not a paywall)", res.status === 400);
    check("it names the item to confirm", body.needsAssertion === true && body.tradelineId === "t1");
    check("the message is not an upsell", !/upgrade|professional|\$|pack/i.test(String(body.error)));
    check("NO letter row was written", db.letters.length === 1);
    check("NOTHING was charged and nothing was accounted for",
      spend.length === 0 && ledgered().length === 0);
    check("no AI call was made", aiCalls === 0);
    check("the entitlement gate was never reached", spend.length === 0 && !tracked.some((t) => t.event === "dispute_created"));
  }

  section("a withdrawn confirmation, or one scoped to another bureau, is not a confirmation");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02"), responseText: "enc:Verified.", responseOutcome: "verified" });
    seedAssertion({ status: "WITHDRAWN" });
    check("withdrawn ⇒ still 400", (await round2.POST(post("l1"), { params: { id: "l1" } })).status === 400);
    check("…and still nothing charged or accounted for",
      spend.length === 0 && ledgered().length === 0 && db.letters.length === 1);

    db.assertions.length = 0;
    seedAssertion({ bureauScope: "EXPERIAN" });
    const crossBureau = await round2.POST(post("l1"), { params: { id: "l1" } });
    check("an Experian-scoped fact does not unlock an Equifax escalation (400)", crossBureau.status === 400);
    check("…and nothing was charged or accounted for",
      spend.length === 0 && ledgered().length === 0 && db.letters.length === 1);

    db.assertions.length = 0;
    seedAssertion({ userId: "u2" });
    check("someone else's confirmation does not unlock it either", (await round2.POST(post("l1"), { params: { id: "l1" } })).status === 400);
  }

  section("with a confirmed fact, round 2 composes — and says only what was opted into");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02"), responseText: "enc:Verified.", responseOutcome: "verified", round: 3 });
    seedAssertion({ assertionType: "paid_settled", consumerNote: "Paid in full 3/2/2024." });

    const res = await round2.POST(post("l1"), { params: { id: "l1" } });
    const body = await json(res);
    check("generation succeeds (200)", res.status === 200);
    check("exactly one new letter row exists", db.letters.length === 2);
    const composed = String((body.letter as Json)?.body ?? "");
    check("it carries the consumer's confirmed claim", /paid or settled/i.test(composed));
    check("…and their own words", /Paid in full 3\/2\/2024\./.test(composed));
    check("the round advanced", db.letters[1].round === 4 && db.letters[1].parentLetterId === "l1");
    check("one letter was accounted for", ledgered().length === 1 && (ledgered()[0].meta as { count?: number })?.count === 1);
    check("NO complaint intent is asserted by default", !/I am prepared to submit this record/.test(composed));
    check("…the reservation-of-rights framing is used instead", /I reserve the right to seek review/.test(composed));
    check("the stored body is encrypted", db.letters[1].body.startsWith("enc:"));
    check("the printed letter has somewhere to sign and somewhere to date (A3 L-07)", /_{10,}/.test(composed) && /Signature/.test(composed) && /Date signed/.test(composed));
  }

  section("the complaint intent is stated only when the consumer ticks the box");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02"), responseText: "enc:Verified.", responseOutcome: "verified", round: 3 });
    seedAssertion();
    const optedIn = await round2.POST(post("l1", { complaintIntent: true }), { params: { id: "l1" } });
    const composed = String(((await json(optedIn)).letter as Json)?.body ?? "");
    check("opted in ⇒ the letter states it", /I am prepared to submit this record to the Consumer Financial Protection Bureau/.test(composed));

    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02"), responseText: "enc:Verified.", responseOutcome: "verified", round: 3 });
    seedAssertion();
    const truthy = await round2.POST(post("l1", { complaintIntent: "yes" }), { params: { id: "l1" } });
    const truthyBody = String(((await json(truthy)).letter as Json)?.body ?? "");
    check("a merely TRUTHY value never asserts it for them (strict === true)", !/I am prepared to submit this record/.test(truthyBody));
  }

  // ── RC1-S11 · review B-1 — the paid analysis is budgeted, and not replayable
  section("the response analysis runs under the consumer's own AI principal");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    const res = await responseRoute.POST(logResponse("l1", "We have completed our reinvestigation and verified the item."), { params: { id: "l1" } });
    const body = await json(res);
    check("the response is logged (200)", res.status === 200);
    check("a principal was opened — without one the call skips the daily budget entirely", aiPrincipals.length === 1);
    check("…and it is THIS consumer, so the spend lands on their ceiling and their usage row", aiPrincipals[0] === "u1");
    check("nothing was refused on a healthy budget", body.budgetRefused === false);
  }

  section("a refused budget does not cost the consumer their logged response");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    budgetExhausted = true;
    const res = await responseRoute.POST(logResponse("l1", "We have completed our reinvestigation and verified the item."), { params: { id: "l1" } });
    const body = await json(res);
    check("the reply is still saved (200) — the refusal is about spend, not about their evidence", res.status === 200);
    check("…and it is on the row", db.letters[0].responseText !== null && db.letters[0].status === "RESPONSE_RECEIVED");
    check("the outcome is not guessed at", db.letters[0].responseOutcome === "unknown");
    check("the page is told no assessment happened", body.needsAI === true && body.budgetRefused === true);
  }

  section("one response, one analysis — the call cannot be replayed on the same letter");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    const first = await responseRoute.POST(logResponse("l1", "We verified the item as accurate and it will remain."), { params: { id: "l1" } });
    check("the first log succeeds", first.status === 200);
    const storedFirst = db.letters[0].responseText;

    const second = await responseRoute.POST(logResponse("l1", "A second copy of the same reply, pasted again."), { params: { id: "l1" } });
    const body = await json(second);
    check("the second log is refused (409)", second.status === 409);
    check("…identified as an already-logged response, not a lifecycle error", body.alreadyLogged === true);
    check("…the message points at the next round instead", /next round/i.test(String(body.error)));
    check("NO second principal was opened — the paid call did not run again", aiPrincipals.length === 1);
    check("…and the stored reply is untouched", db.letters[0].responseText === storedFirst);
    // The status self-transition stays legal: this guard is on the DATA, so a
    // PATCH to a status the letter already holds is still idempotent.
    check("re-PATCHing RESPONSE_RECEIVED is still allowed", (await letterRoute.PATCH(patch("l1", { status: "RESPONSE_RECEIVED" }), { params: { id: "l1" } })).status === 200);
  }

  // ── S11 AD-2 × S5 — the two contracts hold together ───────────────────────
  section("a withdrawn confirmation stops the letter, but never re-judges a mailed one");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    seedAssertion();
    check("with a live confirmation the letter can be approved", (await letterRoute.PATCH(patch("l1", { status: "PRINTED" }), { params: { id: "l1" } })).status === 200);

    // The consumer withdraws it. The letter is still unmailed, so it is now
    // unauthorized — and every step toward the envelope must refuse.
    db.assertions[0].status = "WITHDRAWN";
    const reApprove = await letterRoute.PATCH(patch("l1", { status: "PRINTED" }), { params: { id: "l1" } });
    check("a withdrawn confirmation blocks re-approval (409)", reApprove.status === 409);
    check("…identified as an authorization problem, with the account to fix", (await json(reApprove)).authorizationRevoked === true);
    const mail = await letterRoute.PATCH(patch("l1", { status: "MAILED", mailedAt: "2026-08-02" }), { params: { id: "l1" } });
    check("…and mailing is refused too", mail.status === 409 && db.letters[0].mailedAt === null);

    // …while reading and editing the draft stay open (S4's rule), and S5's own
    // edit path still refuses to save it into an APPROVED state.
    const reopen = await letterRoute.PATCH(patch("l1", { status: "DRAFT" }), { params: { id: "l1" } });
    check("returning it to a draft is still allowed", reopen.status === 200 && db.letters[0].status === "DRAFT");
    const edit = await letterRoute.PATCH(patch("l1", { body: `${TEMPLATE_BODY}\n\nStill my letter to read and change.` }), { params: { id: "l1" } });
    check("…and the consumer can still edit what it says in their name", edit.status === 200);
  }
  {
    // HISTORICAL is terminal: a MAILED letter is never re-judged, its evidence
    // is never touched, and S5's immutability still holds over the top of it.
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    seedAssertion({ status: "WITHDRAWN" });
    const bodyBefore = stored("l1");
    const resolve = await letterRoute.PATCH(patch("l1", { status: "RESOLVED", outcome: "corrected_or_deleted" }), { params: { id: "l1" } });
    check("a mailed letter can still be closed out after a withdrawal", resolve.status === 200);
    check("…its body is untouched — the record of what was sent", stored("l1") === bodyBefore);
    const edit = await letterRoute.PATCH(patch("l1", { body: "Rewriting a mailed letter." }), { params: { id: "l1" } });
    check("…and it is still immutable", edit.status === 409 && stored("l1") === bodyBefore);
  }

  // ── RC1-S11 · journey NEW-2 — through the ROUTE, not just the planner ─────
  section("regenerating over an approved letter is refused, and never duplicates it");
  {
    resetAll();
    seedTradeline();
    seedAssertion();
    const approved = seedLetter({ id: "l_app", status: "PRINTED", body: "enc:the letter I read, edited and approved" });

    const res = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    const body = await json(res);
    check("the API REFUSES (409) — it used to return 200", res.status === 409);
    check("…identified machine-readably", body.approvedLetterExists === true);
    check("…naming the bureau and the letter it would have replaced", Array.isArray(body.blockedBureaus) && (body.blockedBureaus as string[])[0] === "EQUIFAX" && (body.blockedLetterIds as string[])[0] === "l_app");
    check("…and it says nothing was used up", /nothing was used up/i.test(String(body.error)));
    check("NO second letter exists — the tradeline does not end up with two live round-1 letters", db.letters.length === 1);
    check("…and the approved letter is untouched, still approved", approved.body === "enc:the letter I read, edited and approved" && approved.status === "PRINTED");
    check("…nothing was composed or charged", spend.length === 0 && aiCalls === 0);

    // With the consumer's explicit instruction the approved row is REPLACED —
    // updated in place, so the outcome is one letter either way.
    const confirmed = await generate.POST(
      post("http://localhost/api/letters/generate", {
        tradelineId: "t1",
        strategyId: "fcra_611",
        targetBureaus: ["EQUIFAX"],
        replaceApproved: true,
      })
    );
    check("with the explicit instruction it succeeds (200)", confirmed.status === 200);
    check("…still exactly ONE letter for this tradeline + bureau", db.letters.length === 1);
    check("…the approved row was rewritten in place", db.letters[0].id === "l_app" && db.letters[0].body !== "enc:the letter I read, edited and approved");
    check("…and it is no longer approved, because it is no longer the letter they read", db.letters[0].status === "GENERATED");

    // A truthy-but-not-true value must not count as the instruction.
    db.letters[0].status = "PRINTED";
    const truthy = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"], replaceApproved: "yes" })
    );
    check("a merely TRUTHY replaceApproved is not the consumer's instruction", truthy.status === 409 && db.letters.length === 1);
  }

  // ── RC1-S11 · review AD-R2-1 — the identity letter, draft → approve → print ─
  section("a Personal Information correction letter is authorized at birth");
  {
    resetAll();
    process.env.ANTHROPIC_API_KEY = "test-key-not-used-offline";
    const drafted = await identityLetter.POST(
      post("http://localhost/api/identity/letter", {
        bureau: "EQUIFAX",
        discrepancies: [
          {
            category: "Address",
            reportValue: "9 Old Rd, Austin, TX 78701",
            yourValue: "1 Main St, Austin, TX 78701",
            severity: "medium",
            explanation: "I have never lived at the reported address.",
            confirmed: true,
          },
        ],
      })
    );
    if (drafted.status !== 200) console.error(`    (identity draft said: ${String((await json(drafted)).error ?? "")})`);
    check("the correction letter drafts (200)", drafted.status === 200);
    check("…and it carries NO tradeline, because these facts have none", db.letters.length === 1 && db.letters[0].tradelineId === null);

    const id = db.letters[0].id;
    const approve = await letterRoute.PATCH(patch(id, { status: "PRINTED" }), { params: { id } });
    if (approve.status !== 200) console.error(`    (approve said: ${String((await json(approve)).error ?? "")})`);
    check("AD-R2-1: it can be APPROVED — every one of these used to 409 at birth", approve.status === 200);
    check("…and the letter is approved", db.letters[0].status === "PRINTED");
    // The print page branches on exactly this predicate.
    check("…and the print gate lets it through", letterAuthorizationRevoked({ mailedAt: null, tradelineId: null, activeAssertionCount: 0 }) === false);
    const mailed = await letterRoute.PATCH(patch(id, { status: "MAILED", mailedAt: "2026-08-24" }), { params: { id } });
    check("…and it can be mailed", mailed.status === 200 && db.letters[0].mailedAt !== null);

    // The tradeline protection is undiminished by the same change.
    resetAll();
    seedTradeline();
    seedLetter();
    const noConfirmation = await letterRoute.PATCH(patch("l1", { status: "PRINTED" }), { params: { id: "l1" } });
    check("a TRADELINE letter with no confirmation behind it is still refused", noConfirmation.status === 409 && (await json(noConfirmation)).authorizationRevoked === true);
    delete process.env.ANTHROPIC_API_KEY;
  }

  // ── RC1-S11 · review B-2 — the body is bounded before it is buffered ───────
  section("an oversized response body is refused before it is read");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    const declared = new Request("http://localhost/api/letters/l1/response", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=zz", "content-length": String(64 * 1024 * 1024) },
      body: "--zz--",
    });
    const res = await responseRoute.POST(declared, { params: { id: "l1" } });
    check("a declared 64 MB body is 413", res.status === 413);
    check("…with the same message the other upload point uses", /max 15 MB/.test(String((await json(res)).error)));
    check("…and nothing was written", db.letters[0].responseText === null);

    // The chunked case: no content-length at all, so the header cannot refuse it
    // and the stream itself has to be metered.
    let pushed = 0;
    const chunked = new Request("http://localhost/api/letters/l1/response", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=zz" },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          pushed += 1;
          if (pushed > 512) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(1024 * 1024)); // 1 MB per pull
        },
      }),
      duplex: "half",
    } as RequestInit);
    const res2 = await responseRoute.POST(chunked, { params: { id: "l1" } });
    check("a chunked body with no content-length is still 413", res2.status === 413);
    if (pushed >= 64) console.error(`    (metered stream read ${pushed} MB before aborting)`);
    check("…aborted mid-transfer, not after buffering all 512 MB", pushed < 64);
    check("…and still nothing was written", db.letters[0].responseText === null);
  }

  // ── RC1-S11 · review AD-7 — two tabs cannot silently overwrite each other ──
  section("a stale editor cannot overwrite an edit it never saw");
  {
    resetAll();
    seedTradeline();
    seedLetter();
    const opened = TEMPLATE_BODY; // what both tabs loaded

    const tabA = await letterRoute.PATCH(patch("l1", { body: `${TEMPLATE_BODY}\n\nTab A: I paid this on 3 March 2024.`, baseBody: opened }), { params: { id: "l1" } });
    check("the first tab saves (200)", tabA.status === 200);
    check("…and its sentence is stored", /Tab A: I paid this on 3 March 2024\./.test(stored("l1")));

    const tabB = await letterRoute.PATCH(patch("l1", { body: `${TEMPLATE_BODY}\n\nTab B: something else entirely.`, baseBody: opened }), { params: { id: "l1" } });
    const body = await json(tabB);
    check("the second tab, holding the pre-edit copy, is refused (409)", tabB.status === 409);
    check("…identified as a stale edit", body.staleEdit === true);
    check("…and tab A's sentence survives", /Tab A: I paid this on 3 March 2024\./.test(stored("l1")));
    check("…and tab B's text was not stored", !/Tab B/.test(stored("l1")));
    check("the refusal says nothing was lost", /nothing you wrote is lost/i.test(String(body.error)));

    const current = stored("l1").slice(4);
    const retry = await letterRoute.PATCH(patch("l1", { body: `${current}\n\nTab B, reapplied.`, baseBody: current }), { params: { id: "l1" } });
    check("reloading and reapplying works", retry.status === 200 && /Tab B, reapplied\./.test(stored("l1")));

    const noToken = await letterRoute.PATCH(patch("l1", { body: `${TEMPLATE_BODY}\n\nA caller that sends no token.` }), { params: { id: "l1" } });
    check("a caller that sends no token behaves exactly as before", noToken.status === 200);
  }

  section("round 2 still refuses on its own preconditions");
  {
    resetAll();
    seedTradeline();
    seedLetter({ status: "MAILED", mailedAt: new Date("2026-08-02") });
    seedAssertion();
    const noResponse = await round2.POST(post("l1"), { params: { id: "l1" } });
    check("no logged response ⇒ 400", noResponse.status === 400);
    check("…and nothing charged or accounted for", spend.length === 0 && ledgered().length === 0);

    db.letters[0].responseText = "enc:We deleted the item.";
    db.letters[0].responseOutcome = "deleted";
    const alreadyDeleted = await round2.POST(post("l1"), { params: { id: "l1" } });
    check("an item already reported deleted ⇒ 400 (no escalation needed)", alreadyDeleted.status === 400);
    check("…and nothing charged or accounted for",
      spend.length === 0 && ledgered().length === 0 && db.letters.length === 1);
  }
});
