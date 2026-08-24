// Run: npx --no-install tsx scripts/runtime/consumer-assertion.runtime.test.ts
// (registration line for scripts/runtime/run-all.ts REQUIRED, added by the
//  coordinator at merge: "consumer-assertion.runtime.test.ts",)
//
// RC1-S4 (P0-3 / L-02) — executes the REAL route handlers and asserts on what
// they DID: the status they returned, the rows that exist afterwards, and — the
// part a source-level guard cannot see — whether a letter was composed at all.
//
// A source guard can prove the refusal is written. Only this can prove that the
// refusal FIRES, that it fires before anything is charged or persisted, and that
// the letter which does get composed contains the consumer's confirmed sentence
// and nothing they did not confirm.
//
// Offline: no database, no network, no keys. `lib/letter.ts` and
// `lib/compliance.ts` are the REAL modules — they are the code under test.
// Only the I/O boundaries (Prisma, session, rate limit, entitlements, crypto,
// AI, analytics) are replaced.
//
// NON-VACUITY (recorded 2026-08-23, each mutation applied to a working copy and
// reverted immediately afterwards — never committed):
//   · Restore the pre-slice app/api/letters/generate/route.ts (`git show
//     HEAD:app/api/letters/generate/route.ts`, the version with no assertion
//     gate at all): **34 passed, 15 failed (exit 1)**. The pre-fix behaviour —
//     generate SUCCEEDS with zero confirmed facts, writes a letter row and
//     spends the allowance — is exactly what the first section below fails on.
//   · REMEDIATION round: restore `76d26c5`'s generate route (the per-tradeline
//     gate, before H-1): section 8 fails — the Experian-scoped/Equifax-target
//     scenario returned 200, wrote a letter and spent the allowance.
//   · REMEDIATION round: with the migration's Tradeline FK back at ON DELETE
//     CASCADE, `scripts/consumer-assertion.test.ts` fails the H-2 DDL checks that
//     this file's `reanalyze()` emulation depends on.
//     Measured: restoring `76d26c5:app/api/letters/generate/route.ts` gives
//     **71 passed, 14 failed (exit 1)**, every failure in section 8.
//   · (unmodified, remediated tree) **85 passed, 0 failed (exit 0)**.
import { check, loadModule, mockModule, run, section } from "./_harness";

export {};

type Json = Record<string, unknown>;

// ── the fake database ────────────────────────────────────────────────────────
// NOT a database. It implements exactly the queries these two routes issue, and
// THROWS on any query shape it does not recognize — a silent "no rows" would let
// a rewritten query pass unexamined. It has no transactions and no concurrency.
interface TradelineRow {
  id: string;
  userId: string;
  creditorName: string;
  originalCreditor: string | null;
  accountNumberMask: string | null;
  accountType: string;
  probability: string;
  balance: number;
  dateOfFirstDelinquency: Date | null;
  bureauData: unknown;
}
interface AssertionRow {
  id: string;
  userId: string;
  // NULLABLE — the FK is ON DELETE SET NULL (review H-2).
  tradelineId: string | null;
  tradelineCreditorName: string;
  tradelineAccountMask: string | null;
  tradelineAccountType: string | null;
  assertionType: string;
  consumerNote: string | null;
  bureauScope: string | null;
  status: string;
  createdAt: Date;
  withdrawnAt: Date | null;
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
  body: string;
  complianceFlags: string[];
  status: string;
  mailedAt: Date | null;
}

class FakeDb {
  tradelines: TradelineRow[] = [];
  assertions: AssertionRow[] = [];
  letters: LetterRow[] = [];
  readonly calls: string[] = [];
  private seq = 0;
  private id(prefix: string) {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  reset() {
    this.tradelines = [];
    this.assertions = [];
    this.letters = [];
    this.calls.length = 0;
  }

  /**
   * Emulates `lib/analyze.ts:168` — the re-analysis transaction's
   * `tx.tradeline.deleteMany({ where: { reportId } })` — plus the database's own
   * ON DELETE SET NULL on ConsumerAssertion.tradelineId, then inserts the freshly
   * parsed replacement row.
   *
   * The emulation is only faithful if the migration really declares SET NULL, so
   * `scripts/consumer-assertion.test.ts` pins that DDL separately; with CASCADE
   * in the migration this method would be modelling the wrong database.
   */
  reanalyze(oldTradelineId: string, newTradelineId: string, userId: string): void {
    this.calls.push("tradeline.deleteMany(reanalysis)");
    this.tradelines = this.tradelines.filter((t) => t.id !== oldTradelineId);
    for (const a of this.assertions) if (a.tradelineId === oldTradelineId) a.tradelineId = null; // ON DELETE SET NULL
    seedTradelineInto(this, newTradelineId, userId);
  }

  tradeline = {
    findFirst: async (args: { where: { id?: string; userId?: string } }) => {
      this.calls.push("tradeline.findFirst");
      const { id, userId } = args.where;
      return this.tradelines.find((t) => (id ? t.id === id : true) && (userId ? t.userId === userId : true)) ?? null;
    },
  };

  consumerAssertion = {
    findMany: async (args: { where: { userId?: string; tradelineId?: string; status?: string } }) => {
      this.calls.push("consumerAssertion.findMany");
      const w = args.where ?? {};
      return this.assertions
        .filter(
          (a) =>
            (w.userId === undefined || a.userId === w.userId) &&
            (w.tradelineId === undefined || a.tradelineId === w.tradelineId) &&
            (w.status === undefined || a.status === w.status)
        )
        .map((a) => ({ ...a }));
    },
    findFirst: async (args: { where: { id?: string; userId?: string; tradelineId?: string } }) => {
      this.calls.push("consumerAssertion.findFirst");
      const w = args.where ?? {};
      return (
        this.assertions.find(
          (a) =>
            (w.id === undefined || a.id === w.id) &&
            (w.userId === undefined || a.userId === w.userId) &&
            (w.tradelineId === undefined || a.tradelineId === w.tradelineId)
        ) ?? null
      );
    },
    count: async (args: { where: { userId?: string; tradelineId?: string; status?: string } }) => {
      this.calls.push("consumerAssertion.count");
      const w = args.where ?? {};
      return this.assertions.filter(
        (a) =>
          (w.userId === undefined || a.userId === w.userId) &&
          (w.tradelineId === undefined || a.tradelineId === w.tradelineId) &&
          (w.status === undefined || a.status === w.status)
      ).length;
    },
    create: async (args: { data: Partial<AssertionRow> }) => {
      this.calls.push("consumerAssertion.create");
      const row: AssertionRow = {
        id: this.id("ca"),
        userId: String(args.data.userId),
        tradelineId: args.data.tradelineId === undefined ? null : (args.data.tradelineId as string | null),
        tradelineCreditorName: String(args.data.tradelineCreditorName ?? ""),
        tradelineAccountMask: (args.data.tradelineAccountMask as string | null) ?? null,
        tradelineAccountType: (args.data.tradelineAccountType as string | null) ?? null,
        assertionType: String(args.data.assertionType),
        consumerNote: (args.data.consumerNote as string | null) ?? null,
        bureauScope: (args.data.bureauScope as string | null) ?? null,
        status: String(args.data.status ?? "ACTIVE"),
        createdAt: new Date(),
        withdrawnAt: null,
      };
      this.assertions.push(row);
      return { ...row };
    },
    update: async (args: { where: { id: string }; data: Partial<AssertionRow> }) => {
      this.calls.push("consumerAssertion.update");
      const row = this.assertions.find((a) => a.id === args.where.id);
      if (!row) throw new Error("assertion missing");
      Object.assign(row, args.data);
      return { ...row };
    },
    // Present ONLY so that a route rewritten to hard-delete fails loudly here
    // rather than passing: withdrawal must be a status flip.
    delete: async () => {
      throw new Error("ConsumerAssertion must never be hard-deleted");
    },
    deleteMany: async () => {
      throw new Error("ConsumerAssertion must never be hard-deleted");
    },
  };

  letter = {
    findFirst: async (args: { where: { id?: string; userId?: string } }) => {
      this.calls.push("letter.findFirst");
      const w = args.where ?? {};
      return (
        this.letters.find(
          (l) => (w.id === undefined || l.id === w.id) && (w.userId === undefined || l.userId === w.userId)
        ) ?? null
      );
    },
    // S11 AD-3: this HONOURS THE `select` CLAUSE. planLetterRegeneration only
    // refuses to update-match an APPROVED letter if the caller actually asked
    // for `status`; a fake that hands back every column regardless would engage
    // the seam even for a route that never selected it, and the guard below
    // would pass against the very code it exists to catch.
    findMany: async (args: {
      where: { userId?: string; tradelineId?: string };
      select?: Record<string, boolean>;
    }) => {
      this.calls.push("letter.findMany");
      const w = args.where ?? {};
      const fields = args.select
        ? Object.entries(args.select).filter(([, on]) => on).map(([k]) => k)
        : ["id", "targetBureau", "mailedAt", "status"];
      return this.letters
        .filter((l) => (w.userId === undefined || l.userId === w.userId) && (w.tradelineId === undefined || l.tradelineId === w.tradelineId))
        .map((l) => Object.fromEntries(fields.map((f) => [f, (l as unknown as Record<string, unknown>)[f]])));
    },
    create: async (args: { data: Partial<LetterRow> }) => {
      this.calls.push("letter.create");
      const row: LetterRow = {
        id: this.id("l"),
        userId: String(args.data.userId),
        tradelineId: (args.data.tradelineId as string | null) ?? null,
        strategy: String(args.data.strategy),
        recipientType: String(args.data.recipientType),
        recipientName: String(args.data.recipientName),
        targetBureau: (args.data.targetBureau as string | null) ?? null,
        round: Number(args.data.round ?? 1),
        body: String(args.data.body),
        complianceFlags: (args.data.complianceFlags as string[]) ?? [],
        status: "GENERATED",
        mailedAt: null,
      };
      this.letters.push(row);
      return { ...row };
    },
    update: async (args: { where: { id: string }; data: Partial<LetterRow> }) => {
      this.calls.push("letter.update");
      const row = this.letters.find((l) => l.id === args.where.id);
      if (!row) throw new Error("letter missing");
      Object.assign(row, args.data);
      return { ...row };
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
let sessionUser: Json | null = USER;

const spend: number[] = [];
const tracked: { event: string; count: number }[] = [];
const ledgered = () => tracked.filter((t) => t.event === "dispute_created");
let aiCalls = 0;

mockModule("lib/prisma.ts", { prisma: db });
mockModule("lib/session.ts", { currentUserOrDemo: async () => sessionUser });
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => undefined });
mockModule("lib/events.ts", {
  // RC1-S6a: the ledger is now the ONLY accounting. `spend` can no longer move
  // (Founder D-3 froze purchased credits and the routes dropped the call), so
  // every "was this letter accounted for?" assertion reads the append-only
  // dispute_created event instead — and every surviving "nothing was charged"
  // assertion is paired with it, because `spend.length === 0` alone is now
  // structurally vacuous and would ship false coverage.
  track: async (event: string, opts?: { meta?: { count?: unknown } }) => {
    tracked.push({ event, count: Number(opts?.meta?.count ?? 0) });
  },
  PRODUCT_EVENTS: { disputeCreated: "dispute_created", failure: "failure" },
});
mockModule("lib/docCrypto.ts", {
  encryptText: (s: string) => `enc:${s}`,
  // The PATCH route reads a stored body back; the fake is its own inverse.
  decryptText: (s: string) => (s.startsWith("enc:") ? s.slice(4) : s),
});
mockModule("lib/entitlements.ts", {
  // Free tier, no AI refinement, ample allowance: the point of this guard is the
  // ASSERTION gate, so nothing else may be what refuses.
  getEntitlement: async () => ({ premium: false, aiRefinement: false, lettersRemaining: 3 }),
  spendLetterCredits: async (_u: string, _e: unknown, n: number) => {
    spend.push(n);
  },
});
mockModule("lib/furnisher.ts", {
  getFurnisherContact: async () => null,
  formatFurnisherAddress: () => null,
});
mockModule("lib/aiMeter.ts", {
  meteredMessage: async () => {
    aiCalls += 1;
    throw new Error("no AI call may happen in this guard");
  },
});

const generate = loadModule<{ POST: (req: Request) => Promise<Response> }>("app/api/letters/generate/route.ts");
const letterRoute = loadModule<{
  PATCH: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
}>("app/api/letters/[id]/route.ts");
const assertionRoute = loadModule<{
  POST: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
  DELETE: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
}>("app/api/tradelines/[id]/assertion/route.ts");

function seedTradelineInto(target: FakeDb, id: string, userId: string): TradelineRow {
  const row: TradelineRow = {
    id,
    userId,
    creditorName: "Midland Funding LLC",
    originalCreditor: "Synchrony Bank",
    accountNumberMask: "XXXX-1234",
    accountType: "COLLECTION",
    probability: "HIGH",
    balance: 128900,
    dateOfFirstDelinquency: new Date("2021-03-01"),
    bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 128900, dofd: "2021-03-01" } },
  };
  target.tradelines.push(row);
  return row;
}
const seedTradeline = (id: string, userId: string) => seedTradelineInto(db, id, userId);

function seedSetAside(id: string, userId: string): TradelineRow {
  const row = seedTradelineInto(db, id, userId);
  row.accountType = "GOVERNMENT";
  row.probability = "NOT_RECOMMENDED";
  row.creditorName = "State Tax Lien";
  return row;
}

function seedInquiry(id: string, userId: string): TradelineRow {
  const row = seedTradelineInto(db, id, userId);
  row.accountType = "INQUIRY";
  row.balance = 0;
  row.creditorName = "Some Lender";
  row.dateOfFirstDelinquency = null;
  row.bureauData = { EQUIFAX: { presence: "PRESENT" } };
  return row;
}

const post = (url: string, body: Json) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function json(res: Response): Promise<Json> {
  try {
    return (await res.json()) as Json;
  } catch {
    return {};
  }
}

run("consumer-assertion.runtime", async () => {
  // ── 1. no confirmed fact ⇒ no letter ──────────────────────────────────────
  section("generate refuses when the consumer has confirmed nothing");
  {
    db.reset();
    spend.length = 0;
    tracked.length = 0;
    sessionUser = USER;
    seedTradeline("t1", "u1");
    const res = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611" }));
    const body = await json(res);
    check("status is 400 (a refusal, not a server error and not a paywall)", res.status === 400);
    check("the response says which item needs confirming", body.needsAssertion === true && body.tradelineId === "t1");
    check("the message tells the consumer what to do, in plain language", typeof body.error === "string" && /confirm/i.test(body.error as string));
    check("the message is not an upsell", !/upgrade|professional|\$|credit/i.test(String(body.error)));
    check("no upgrade flag is set on the refusal", body.upgrade === undefined);
    check("NO letter row was written", db.letters.length === 0);
    check("NOTHING was charged and nothing was accounted for",
      spend.length === 0 && !tracked.some((t) => t.event === "dispute_created"));
    check("no AI call was made", aiCalls === 0);
    check("the entitlement gate was never even reached (no letter lookup)", !db.calls.includes("letter.findMany"));
  }

  // ── 2. a withdrawn confirmation is not a confirmation ─────────────────────
  section("a WITHDRAWN confirmation does not unlock generation");
  {
    db.reset();
    spend.length = 0;
    tracked.length = 0;
    seedTradeline("t1", "u1");
    db.assertions.push({
      id: "ca_w",
      userId: "u1",
      tradelineId: "t1",
      tradelineCreditorName: "Midland Funding LLC",
      tradelineAccountMask: "XXXX-1234",
      tradelineAccountType: "COLLECTION",
      assertionType: "not_mine",
      consumerNote: null,
      bureauScope: null,
      status: "WITHDRAWN",
      createdAt: new Date(),
      withdrawnAt: new Date(),
    });
    const res = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611" }));
    check("still 400", res.status === 400);
    check("still no letter", db.letters.length === 0);
  }

  // ── 3. another user's confirmation is not this user's ─────────────────────
  section("a confirmation belonging to someone else does not unlock generation");
  {
    db.reset();
    seedTradeline("t1", "u1");
    db.assertions.push({
      id: "ca_other",
      userId: "u2",
      tradelineId: "t1",
      tradelineCreditorName: "Midland Funding LLC",
      tradelineAccountMask: "XXXX-1234",
      tradelineAccountType: "COLLECTION",
      assertionType: "not_mine",
      consumerNote: null,
      bureauScope: null,
      status: "ACTIVE",
      createdAt: new Date(),
      withdrawnAt: null,
    });
    const res = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611" }));
    check("still 400 — the query is scoped to the caller", res.status === 400);
    check("still no letter", db.letters.length === 0);
  }

  // ── 4. confirmed ⇒ the letter says exactly what they confirmed ────────────
  section("with a confirmed fact, the letter composes from it and nothing else");
  {
    db.reset();
    spend.length = 0;
    tracked.length = 0;
    seedTradeline("t1", "u1");
    const created = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t1/assertion", {
        assertionType: "paid_settled",
        consumerNote: "Paid in full 3/2/2024 by cashier's check.",
      }),
      { params: { id: "t1" } }
    );
    check("POST /assertion returns 201", created.status === 201);
    check("an ACTIVE row exists", db.assertions.length === 1 && db.assertions[0].status === "ACTIVE");

    const res = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    const body = await json(res);
    check("generation now succeeds (200)", res.status === 200);
    check("exactly one letter row was written", db.letters.length === 1);
    const letterBody = String((body.letter as Json | undefined)?.body ?? "");
    check("the letter carries the consumer's confirmed claim", /I state that this account was paid or settled/.test(letterBody));
    check(
      "…and their own words, verbatim (typographic attribution delimiters, review L-2)",
      letterBody.includes("In my own words: \u201CPaid in full 3/2/2024 by cashier's check.\u201D")
    );
    check("…and NOT the old always-on Payment History concern", !letterBody.includes("The payment history associated with this account as reported."));
    check("…and NOT the old first-person fallback", !/I am unable to reconcile the reported status with my records/.test(letterBody));
    check("exactly one numbered concern (nothing padded in)", (letterBody.match(/^\d+\. /gm) ?? []).length === 1);
    check("no complaint intent is asserted", !/I am prepared to submit this record/.test(letterBody));
    check("the stored row is encrypted, not plaintext", db.letters[0].body.startsWith("enc:"));
    check("one letter was accounted for", ledgered().length === 1 && ledgered()[0].count === 1);
  }

  // ── 5. withdrawal ─────────────────────────────────────────────────────────
  section("withdrawal flips status and re-closes the gate");
  {
    const id = db.assertions[0].id;
    const res = await assertionRoute.DELETE(
      new Request(`http://localhost/api/tradelines/t1/assertion?assertionId=${id}`, { method: "DELETE" }),
      { params: { id: "t1" } }
    );
    check("DELETE returns 200", res.status === 200);
    check("the row still EXISTS (append-only: nothing was deleted)", db.assertions.length === 1);
    check("…with status WITHDRAWN and a withdrawnAt stamp", db.assertions[0].status === "WITHDRAWN" && db.assertions[0].withdrawnAt !== null);

    const again = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611" }));
    check("generation refuses again once the confirmation is withdrawn", again.status === 400);

    const repeat = await assertionRoute.DELETE(
      new Request(`http://localhost/api/tradelines/t1/assertion?assertionId=${id}`, { method: "DELETE" }),
      { params: { id: "t1" } }
    );
    check("withdrawing twice is idempotent, not an error", repeat.status === 200 && (await json(repeat)).alreadyWithdrawn === true);
  }

  // ── 6. authorization ──────────────────────────────────────────────────────
  section("authorization and IDOR");
  {
    db.reset();
    sessionUser = USER;
    seedTradeline("t1", "u1");
    seedTradeline("t_other", "u2"); // someone else's account

    const foreign = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t_other/assertion", { assertionType: "not_mine" }),
      { params: { id: "t_other" } }
    );
    check("confirming a fact on ANOTHER user's tradeline is 404", foreign.status === 404);
    check("…and wrote nothing", db.assertions.length === 0);

    const missing = await assertionRoute.POST(
      post("http://localhost/api/tradelines/nope/assertion", { assertionType: "not_mine" }),
      { params: { id: "nope" } }
    );
    check("a nonexistent tradeline is the SAME 404 (no existence oracle)", missing.status === 404);

    // A real assertion of this user's, then an attempt to withdraw it via a
    // tradeline it does not belong to.
    await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "not_mine" }), { params: { id: "t1" } });
    const mine = db.assertions[0].id;
    const crossed = await assertionRoute.DELETE(
      new Request(`http://localhost/api/tradelines/t_other/assertion?assertionId=${mine}`, { method: "DELETE" }),
      { params: { id: "t_other" } }
    );
    check("withdrawing via a tradeline that isn't yours is 404", crossed.status === 404);
    check("…and the assertion is untouched", db.assertions[0].status === "ACTIVE");

    const unknownAssertion = await assertionRoute.DELETE(
      new Request("http://localhost/api/tradelines/t1/assertion?assertionId=ca_does_not_exist", { method: "DELETE" }),
      { params: { id: "t1" } }
    );
    check("withdrawing an assertion that does not exist is 404", unknownAssertion.status === 404);

    sessionUser = null;
    const anonPost = await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "not_mine" }), {
      params: { id: "t1" },
    });
    const anonDelete = await assertionRoute.DELETE(
      new Request(`http://localhost/api/tradelines/t1/assertion?assertionId=${mine}`, { method: "DELETE" }),
      { params: { id: "t1" } }
    );
    const anonGenerate = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611" }));
    check("signed out: POST /assertion is 401", anonPost.status === 401);
    check("signed out: DELETE /assertion is 401", anonDelete.status === 401);
    check("signed out: generate is 401", anonGenerate.status === 401);
    sessionUser = USER;
  }

  // ── 7. input validation on the confirmation itself ────────────────────────
  section("the confirmation vocabulary is closed, and 'other' must say something");
  {
    db.reset();
    seedTradeline("t1", "u1");
    const bogus = await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "delete_it_all" }), {
      params: { id: "t1" },
    });
    check("an unrecognized assertion type is 400", bogus.status === 400);

    const noteless = await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "other" }), {
      params: { id: "t1" },
    });
    check("`other` with no words is 400 — it asserts nothing", noteless.status === 400);

    const tooLong = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t1/assertion", { assertionType: "other", consumerNote: "z".repeat(700) }),
      { params: { id: "t1" } }
    );
    check("an over-long note is REFUSED, never silently truncated", tooLong.status === 400);

    const badScope = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t1/assertion", { assertionType: "not_mine", bureauScope: "INNOVIS" }),
      { params: { id: "t1" } }
    );
    check("an unrecognized bureau scope is 400", badScope.status === 400);
    check("none of the invalid attempts wrote a row", db.assertions.length === 0);

    const good = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t1/assertion", { assertionType: "other", consumerNote: "  The\n\naccount number is not mine.  " }),
      { params: { id: "t1" } }
    );
    check("a valid `other` with words is accepted (control)", good.status === 201);
    check("…and the stored note is whitespace-normalized, not rewritten", db.assertions[0].consumerNote === "The account number is not mine.");
  }

  // ── 8. bureau scope: the gate and the composer agree (REMEDIATION H-1) ────
  section("a fact confirmed about one bureau's file does not buy a letter to another");
  {
    db.reset();
    spend.length = 0;
    tracked.length = 0;
    seedTradeline("t1", "u1");
    await assertionRoute.POST(
      post("http://localhost/api/tradelines/t1/assertion", { assertionType: "inaccurate_balance", bureauScope: "EXPERIAN" }),
      { params: { id: "t1" } }
    );

    // THE REVIEWER'S SCENARIO, exactly: Experian-scoped confirmation, Equifax
    // target. This previously returned 200, wrote a claim-free letter whose
    // demand referred to "each disputed item", and spent the allowance.
    const single = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    const singleBody = await json(single);
    check("Equifax-only target with an Experian-scoped fact is REFUSED (400)", single.status === 400);
    check("…the refusal names the mismatch, not a generic error", /Experian/.test(String(singleBody.error)) && /Equifax/.test(String(singleBody.error)));
    check("…it says nothing was used up", /Nothing was used up/i.test(String(singleBody.error)));
    check("…and reports which targets were unsupported", Array.isArray(singleBody.skippedBureaus) && (singleBody.skippedBureaus as string[]).includes("EQUIFAX"));
    check("NO letter row was written", db.letters.length === 0);
    check("NOTHING was charged and nothing was accounted for",
      spend.length === 0 && !tracked.some((t) => t.event === "dispute_created"));
    check("the entitlement gate was never reached", !db.calls.includes("letter.findMany"));

    // All three bureaus: only Experian is supported. The other two are skipped,
    // disclosed, and uncharged — never written as content-free letters.
    const multi = await generate.POST(
      post("http://localhost/api/letters/generate", {
        tradelineId: "t1",
        strategyId: "fcra_611",
        targetBureaus: ["EQUIFAX", "EXPERIAN", "TRANSUNION"],
      })
    );
    const multiBody = await json(multi);
    check("a mixed request succeeds for the supported bureau only", multi.status === 200);
    check("exactly ONE letter was written, not three", db.letters.length === 1);
    check("…and it is the Experian one", db.letters[0].targetBureau === "EXPERIAN");
    check("…the two unsupported targets are disclosed", ((multiBody.skippedBureaus as string[]) ?? []).sort().join() === "EQUIFAX,TRANSUNION");
    check("…with a plain-language reason", /No confirmed fact of yours applies to/.test(String(multiBody.skippedReason)));
    check("…and only ONE letter was accounted for", ledgered().length === 1 && ledgered()[0].count === 1);
    const written = String((multiBody.letters as Json[])?.[0]?.body ?? "");
    check("the letter that WAS written carries the confirmed claim", /I state that this balance is not accurate/.test(written));
    check("…and no letter anywhere refers to disputed items it does not list", !db.letters.some((l) => !/SUMMARY OF FACTUAL CONCERNS/.test(l.body) && /each disputed item/.test(l.body)));
    check("…and never names a bureau other than its target", !/Equifax|TransUnion/i.test(written));

    // Unscoped confirmations still reach every bureau (control).
    db.reset();
    spend.length = 0;
    tracked.length = 0;
    seedTradeline("t2", "u1");
    await assertionRoute.POST(post("http://localhost/api/tradelines/t2/assertion", { assertionType: "not_mine" }), { params: { id: "t2" } });
    const all3 = await generate.POST(
      post("http://localhost/api/letters/generate", {
        tradelineId: "t2",
        strategyId: "fcra_611",
        targetBureaus: ["EQUIFAX", "EXPERIAN", "TRANSUNION"],
      })
    );
    check("an UNSCOPED confirmation still generates for all three (control)", all3.status === 200 && db.letters.length === 3);
    check("…and every one of them states the confirmed claim", db.letters.every((l) => /I do not recognize this account/.test(l.body)));
    check("…accounted for once, for exactly the letters written", ledgered().length === 1 && ledgered()[0].count === 3);
  }

  // ── 9. the record survives re-analysis (REMEDIATION H-2) ──────────────────
  section("a confirmation survives the re-analysis that replaces its tradeline");
  {
    db.reset();
    spend.length = 0;
    tracked.length = 0;
    seedTradeline("t_old", "u1");
    await assertionRoute.POST(
      post("http://localhost/api/tradelines/t_old/assertion", { assertionType: "not_mine", consumerNote: "Never had an account here." }),
      { params: { id: "t_old" } }
    );
    check("the snapshot is captured at creation", db.assertions[0].tradelineCreditorName === "Midland Funding LLC" && db.assertions[0].tradelineAccountMask === "XXXX-1234");

    const before = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t_old", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] }));
    check("a letter is generated from it (control)", before.status === 200 && db.letters.length === 1);

    // lib/analyze.ts:168 — the whole tradeline set is replaced on re-upload.
    db.reanalyze("t_old", "t_new", "u1");

    check("the consumer's confirmation still EXISTS after re-analysis", db.assertions.length === 1);
    check("…with its tradeline link set to NULL, not the row deleted", db.assertions[0].tradelineId === null);
    check("…and the snapshot still says WHICH account it was about", db.assertions[0].tradelineCreditorName === "Midland Funding LLC");
    check("…and their own words are intact", db.assertions[0].consumerNote === "Never had an account here.");
    check("…so the already-mailed letter still has its authorization evidence", db.letters.length === 1 && /I do not recognize this account/.test(db.letters[0].body));

    // The freshly parsed row is a new set of facts: it must be re-confirmed.
    const after = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t_new", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] }));
    check("generation on the NEW tradeline refuses until it is re-confirmed", after.status === 400);
    check("…and wrote nothing", db.letters.length === 1);
    check("…and the refusal itself added nothing to the ledger", ledgered().length === 1);

    await assertionRoute.POST(post("http://localhost/api/tradelines/t_new/assertion", { assertionType: "not_mine" }), { params: { id: "t_new" } });
    const reconfirmed = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t_new", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] }));
    check("…and succeeds once the consumer confirms against the new data", reconfirmed.status === 200 && db.letters.length === 2);
    check("the orphaned row was never resurrected into the new letter's evidence", db.assertions.filter((a) => a.tradelineId === "t_new").length === 1);
  }

  // ── 10. an inquiry can only say what an inquiry can say (M-3) ─────────────
  section("INQUIRY rows are offered — and accept — only applicable claims");
  {
    db.reset();
    seedInquiry("t_inq", "u1");
    const wrong = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t_inq/assertion", { assertionType: "inaccurate_balance" }),
      { params: { id: "t_inq" } }
    );
    const wrongBody = await json(wrong);
    check("'the balance is wrong' on an inquiry is refused (400)", wrong.status === 400);
    check("…with the applicable choices returned", ((wrongBody.allowed as string[]) ?? []).includes("inquiry_not_authorized"));
    check("…and nothing written", db.assertions.length === 0);

    const right = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t_inq/assertion", { assertionType: "inquiry_not_authorized" }),
      { params: { id: "t_inq" } }
    );
    check("'I did not authorize this inquiry' is accepted (control)", right.status === 201);

    const res = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t_inq", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] }));
    const body = await json(res);
    const letterBody = String((body.letter as Json | undefined)?.body ?? "");
    check("a letter about the inquiry generates", res.status === 200);
    check("…in the consumer's own voice", /I do not recognize any application or transaction that would authorize this inquiry/.test(letterBody));
    check("…and never asserts a balance about an inquiry", !/balance is not accurate/.test(letterBody));

    // The account vocabulary is still refused the other way round.
    seedTradeline("t_acct", "u1");
    const inqOnAccount = await assertionRoute.POST(
      post("http://localhost/api/tradelines/t_acct/assertion", { assertionType: "inquiry_not_authorized" }),
      { params: { id: "t_acct" } }
    );
    check("the inquiry claim is refused on a normal account", inqOnAccount.status === 400);
  }

  // ── 11. S11 AD-1: a set-aside row is refused with the TRUE reason ─────────
  section("a government / set-aside row gets a true reason, not an instruction it cannot follow");
  {
    db.reset();
    seedSetAside("t_gov", "u1");
    const res = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t_gov", strategyId: "fcra_611" }));
    const body = await json(res);
    check("refused (400)", res.status === 400);
    check("…flagged as set aside, not as a missing confirmation", body.setAside === true && body.needsAssertion === undefined);
    check("…and says WHY, in the consumer's terms", /government or statutory debt/i.test(String(body.error)));
    check(
      "…and does NOT tell them to use a panel their row does not have",
      !/Review the facts/.test(String(body.error))
    );
    check("…nothing was used up", /Nothing was used up/i.test(String(body.error)) && db.letters.length === 0);
  }

  // ── 12. S11 AD-2: withdrawal reaches an unmailed letter ──────────────────
  section("a withdrawn confirmation blocks approval of the letter it authorized");
  {
    db.reset();
    seedTradeline("t1", "u1");
    await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "not_mine" }), {
      params: { id: "t1" },
    });
    const gen = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("a letter exists, drafted from a standing confirmation (control)", gen.status === 200 && db.letters.length === 1);
    const letterId = db.letters[0].id;

    // Control: while the confirmation stands, approval goes through.
    const approvedOk = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${letterId}`, { status: "PRINTED" }),
      { params: { id: letterId } }
    );
    check("approval succeeds while the confirmation stands (control)", approvedOk.status === 200);
    check("…and the row really moved", db.letters[0].status === "PRINTED");

    // The consumer changes their mind.
    const assertionId = db.assertions[0].id;
    await assertionRoute.DELETE(
      new Request(`http://localhost/api/tradelines/t1/assertion?assertionId=${encodeURIComponent(assertionId)}`, { method: "DELETE" }),
      { params: { id: "t1" } }
    );
    check("the confirmation is WITHDRAWN, not deleted", db.assertions.length === 1 && db.assertions[0].status === "WITHDRAWN");

    const mailAfterWithdraw = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${letterId}`, { status: "MAILED" }),
      { params: { id: letterId } }
    );
    const mailBody = await json(mailAfterWithdraw);
    check("marking it MAILED is now refused (409)", mailAfterWithdraw.status === 409);
    check("…flagged machine-readably for the letters page", mailBody.authorizationRevoked === true && mailBody.tradelineId === "t1");
    check("…with a truthful message that does not claim anything was deleted", /withdrawn/i.test(String(mailBody.error)) && /Nothing has been deleted/.test(String(mailBody.error)));
    check("…and the letter was NOT mailed", db.letters[0].mailedAt === null && db.letters[0].status === "PRINTED");

    const reApprove = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${letterId}`, { status: "PRINTED" }),
      { params: { id: letterId } }
    );
    check("re-approving is refused on the same grounds", reApprove.status === 409);

    // Re-confirming restores the path — the block is a state, not a one-way door.
    await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "not_mine" }), {
      params: { id: "t1" },
    });
    const afterReconfirm = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${letterId}`, { status: "MAILED" }),
      { params: { id: letterId } }
    );
    check("…and succeeds again once the consumer re-confirms", afterReconfirm.status === 200);
    check("…the letter is mailed", db.letters[0].mailedAt !== null);
  }

  // ── 13. S11 AD-2 (other half): a MAILED record is never re-judged ────────
  section("a mailed letter keeps its evidence and its lifecycle, whatever happens later");
  {
    // The letter from section 12 is MAILED. Withdraw its confirmation again.
    const active = db.assertions.filter((a) => a.status === "ACTIVE");
    for (const a of active) {
      await assertionRoute.DELETE(
        new Request(`http://localhost/api/tradelines/t1/assertion?assertionId=${encodeURIComponent(a.id)}`, { method: "DELETE" }),
        { params: { id: "t1" } }
      );
    }
    check("no ACTIVE confirmation remains", db.assertions.every((a) => a.status === "WITHDRAWN"));

    const mailedLetter = db.letters[0];
    check("the mailed letter still exists, mailed", mailedLetter.mailedAt !== null && mailedLetter.status === "MAILED");
    check("…its body is untouched — the record of what was sent", /I do not recognize this account/.test(mailedLetter.body));
    check(
      "…the withdrawn confirmations survive as its authorization evidence",
      db.assertions.length >= 1 && db.assertions.every((a) => a.tradelineCreditorName === "Midland Funding LLC")
    );

    // A post-mail lifecycle step must still work: the block is for pending
    // action only, never for a record.
    const logResponse = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${mailedLetter.id}`, { status: "RESPONSE_RECEIVED" }),
      { params: { id: mailedLetter.id } }
    );
    check("a MAILED letter's lifecycle continues normally after withdrawal", logResponse.status === 200);
    check("…it was never blocked as revoked", (await json(logResponse)).authorizationRevoked === undefined);
    check("…and the mailedAt stamp is unchanged", db.letters[0].mailedAt !== null);
  }

  // ── 14. S11 AD-3 / NEW-2: regeneration over an APPROVED letter ───────────
  section("regenerating over an approved, consumer-edited letter is refused server-side");
  {
    db.reset();
    seedTradeline("t1", "u1");
    await assertionRoute.POST(post("http://localhost/api/tradelines/t1/assertion", { assertionType: "not_mine" }), {
      params: { id: "t1" },
    });
    const first = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("a letter is generated (control)", first.status === 200 && db.letters.length === 1);
    const original = db.letters[0];

    // The consumer edits it and approves it. (Both are S5 surfaces; what
    // matters to this guard is the row state the generator will meet.)
    original.body = "enc:MY OWN WORDS — the letter I read, corrected and approved.";
    original.status = "PRINTED"; // LETTER_APPROVED_STATUS

    // A DIRECT API call — no page, so no two-press confirmation in the way.
    const regen = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    const regenBody = await json(regen);
    // S11 journey NEW-2 corrected this. The first cut SKIPPED an approved
    // candidate, which stopped the overwrite but returned 200 and CREATED a
    // second letter — leaving two live round-1 EQUIFAX letters on one tradeline,
    // both approvable and both mailable. Not destroying the consumer's letter is
    // necessary; quietly duplicating it is not the alternative. The rule is now
    // report-and-refuse, and the outcome is ONE letter either way.
    check("the request is REFUSED (409), not answered with a second letter", regen.status === 409);
    check("…and says which letter is in the way, machine-readably", regenBody.approvedLetterExists === true && (regenBody.blockedLetterIds as string[])?.includes(original.id));
    check("…naming the bureau it belongs to", ((regenBody.blockedBureaus as (string | null)[]) ?? []).includes("EQUIFAX"));
    check("…and offering the consumer the choice, without taking it for them", /confirm that you want the approved letter replaced/i.test(String(regenBody.error)));
    check("…stating that nothing was consumed", /nothing was used up/i.test(String(regenBody.error)));
    check("the approved letter's body is UNTOUCHED — the consumer's words survive", original.body === "enc:MY OWN WORDS — the letter I read, corrected and approved.");
    check("…and it is still approved (not silently reset to a fresh draft)", original.status === "PRINTED");
    check("NOTHING was composed or written — no second live letter", db.letters.length === 1);
    check("…so the tradeline never carries two round-1 letters to the same bureau", db.letters.filter((l) => l.tradelineId === "t1" && l.targetBureau === "EQUIFAX" && l.round === 1 && !l.mailedAt).length === 1);

    // With the consumer's explicit instruction, the approved row is REPLACED in
    // place — still one letter, never two.
    const replaced = await generate.POST(
      post("http://localhost/api/letters/generate", {
        tradelineId: "t1",
        strategyId: "fcra_611",
        targetBureaus: ["EQUIFAX"],
        replaceApproved: true,
      })
    );
    const replacedBody = await json(replaced);
    check("with the consumer's explicit go-ahead the regeneration proceeds (200)", replaced.status === 200);
    check("…updating the approved row in place, not creating a rival", replacedBody.updatedCount === 1 && replacedBody.createdCount === 0);
    check("…leaving exactly one round-1 EQUIFAX letter", db.letters.length === 1);
    check("…now carrying the freshly composed text", /SUMMARY OF FACTUAL CONCERNS/.test(db.letters[0].body));
    check("…and no longer standing as approved", db.letters[0].status !== "PRINTED");
    check("a truthy-but-not-true flag does NOT count as consent", (await (async () => {
      db.letters[0].status = "PRINTED";
      const sneaky = await generate.POST(
        post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"], replaceApproved: "yes" })
      );
      return sneaky.status;
    })()) === 409);

    // Control: an UNAPPROVED draft is still updated in place — RB-6's whole
    // point (correcting a draft must not spawn duplicates) is not regressed.
    db.reset();
    seedTradeline("t2", "u1");
    await assertionRoute.POST(post("http://localhost/api/tradelines/t2/assertion", { assertionType: "not_mine" }), {
      params: { id: "t2" },
    });
    await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: "t2", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] }));
    const before = db.letters.length;
    const again = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t2", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    const againBody = await json(again);
    check("an unapproved draft is still updated in place (RB-6 control)", againBody.updatedCount === 1 && againBody.createdCount === 0);
    check("…with no duplicate row", db.letters.length === before);

    // Control: a MAILED letter was already never matched — unchanged.
    db.letters[0].mailedAt = new Date();
    db.letters[0].status = "MAILED";
    const afterMail = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t2", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("a mailed letter is still never update-matched", (await json(afterMail)).createdCount === 1);
  }

  // ── 15. S11 NEW-5: the account must be named, and the query is scoped ─────
  section("generate refuses an unnamed account, and cannot reach another user's row");
  {
    db.reset();
    sessionUser = USER;
    seedTradeline("t_mine", "u1");
    seedTradeline("t_theirs", "u2"); // another consumer's account
    await assertionRoute.POST(post("http://localhost/api/tradelines/t_mine/assertion", { assertionType: "not_mine" }), {
      params: { id: "t_mine" },
    });

    // The reported defect: an EMPTY body used to draft a real letter about an
    // arbitrary account, because Prisma drops an `undefined` filter value.
    const empty = await generate.POST(post("http://localhost/api/letters/generate", {}));
    const emptyBody = await json(empty);
    check("an empty body is refused (400), not answered with a letter", empty.status === 400);
    check("…and says which input is missing", emptyBody.needsTradeline === true);
    check("…and drafts nothing", db.letters.length === 0);

    for (const [label, value] of [["null", null], ["a number", 7], ["an object", {}], ["blank", "   "]] as const) {
      const res = await generate.POST(post("http://localhost/api/letters/generate", { tradelineId: value, strategyId: "fcra_611" }));
      check(`a tradelineId that is ${label} is refused (400)`, res.status === 400);
    }
    check("none of the malformed attempts drafted anything", db.letters.length === 0);

    // THE OWNERSHIP QUESTION, answered by execution rather than by reading.
    const foreign = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t_theirs", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("another user's tradeline id is 404, never resolved", foreign.status === 404);
    check("…and no letter was written for it", db.letters.length === 0);
    check("…and no letter exists on that account at all", !db.letters.some((l) => l.tradelineId === "t_theirs"));

    // The ownership predicate is what does that work: prove the widened-query
    // shape (id undefined) still cannot cross accounts, by asking the fake the
    // same question the route's `where` clause asks.
    const widened = await db.tradeline.findFirst({ where: { id: undefined, userId: "u1" } });
    check("with the id filter dropped, the query still cannot leave the caller's rows", widened !== null && widened.userId === "u1");
    const widenedOther = await db.tradeline.findFirst({ where: { id: undefined, userId: "u2" } });
    check("…and a different caller sees only their own", widenedOther !== null && widenedOther.userId === "u2");

    // Control: naming the account properly still works.
    const good = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t_mine", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("naming your own account still generates (control)", good.status === 200 && db.letters.length === 1);
    check("…for that account, not another", db.letters[0].tradelineId === "t_mine");
  }

  // ── 16. S11 AD-R2-1: a letter with no tradeline is judged by no tradeline rule
  section("an identity-correction letter (no tradeline) is authorized and approvable");
  {
    db.reset();
    sessionUser = USER;
    // The Personal Information correction letter disputes the consumer's own
    // name, address and employer. Those facts have no tradeline row, so it is
    // persisted with tradelineId null. Under the first cut of the authorization
    // rule EVERY one of these was REVOKED at birth — un-approvable and
    // un-printable after a metered model call, under a message telling the
    // consumer to confirm facts on a page where those facts do not exist.
    const identity = await db.letter.create({
      data: {
        userId: "u1",
        tradelineId: null,
        strategy: "fcra_611",
        recipientType: "bureau",
        recipientName: "Equifax Information Services LLC",
        targetBureau: "EQUIFAX",
        round: 1,
        body: "enc:PERSONAL INFORMATION CORRECTION — my correct address is 1 Main St.",
        complianceFlags: [],
      },
    });
    check("it exists with no tradeline (control)", identity.tradelineId === null);
    check("there is no ACTIVE assertion anywhere for this user (control)", db.assertions.length === 0);

    const approve = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${identity.id}`, { status: "PRINTED" }),
      { params: { id: identity.id } }
    );
    check("approving it is NOT refused as revoked", approve.status === 200);
    check("…and it really moved to approved", db.letters.find((l) => l.id === identity.id)?.status === "PRINTED");

    const mail = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${identity.id}`, { status: "MAILED" }),
      { params: { id: identity.id } }
    );
    check("…and it can be mailed", mail.status === 200);

    // THE COMPANION PROTECTION, in the same section so the two cannot drift:
    // a letter that DOES have a tradeline, whose confirmations are withdrawn,
    // is still refused. AD-2's actual scenario is untouched by AD-R2-1.
    seedTradeline("t_w", "u1");
    await assertionRoute.POST(post("http://localhost/api/tradelines/t_w/assertion", { assertionType: "not_mine" }), {
      params: { id: "t_w" },
    });
    const gen = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t_w", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("a tradeline letter is generated (control)", gen.status === 200);
    const tlLetter = db.letters.find((l) => l.tradelineId === "t_w")!;
    await assertionRoute.DELETE(
      new Request(`http://localhost/api/tradelines/t_w/assertion?assertionId=${encodeURIComponent(db.assertions[0].id)}`, { method: "DELETE" }),
      { params: { id: "t_w" } }
    );
    const blocked = await letterRoute.PATCH(
      post(`http://localhost/api/letters/${tlLetter.id}`, { status: "PRINTED" }),
      { params: { id: tlLetter.id } }
    );
    check("a TRADELINE letter whose confirmations are withdrawn is still REFUSED", blocked.status === 409);
    check("…as revoked, specifically", (await json(blocked)).authorizationRevoked === true);
    check("…and it was not approved", db.letters.find((l) => l.id === tlLetter.id)?.status !== "PRINTED");
  }

  // ── 17. S11: the discriminator cannot be forged onto a tradeline letter ───
  section("a tradeline letter can never be assigned the personal-information strategy");
  {
    db.reset();
    sessionUser = USER;
    seedTradeline("t_pi", "u1");
    await assertionRoute.POST(post("http://localhost/api/tradelines/t_pi/assertion", { assertionType: "not_mine" }), {
      params: { id: "t_pi" },
    });

    const forged = await generate.POST(
      post("http://localhost/api/letters/generate", {
        tradelineId: "t_pi",
        strategyId: "personal_info",
        targetBureaus: ["EQUIFAX"],
      })
    );
    const forgedBody = await json(forged);
    check("a direct API call naming the non-tradeline strategy is refused (400)", forged.status === 400);
    check("…flagged machine-readably", forgedBody.invalidStrategyForTradeline === true);
    check("…explaining what that letter type actually does", /corrects the personal details on your file/i.test(String(forgedBody.error)));
    check("…and NOTHING was written", db.letters.length === 0);
    check(
      "…so no letter anywhere carries a tradelineId AND the identity strategy",
      !db.letters.some((l) => l.tradelineId !== null && l.strategy === "personal_info")
    );

    // Control: an ordinary dispute strategy on the same account still works.
    const ok200 = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t_pi", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    check("a real dispute strategy still generates (control)", ok200.status === 200 && db.letters.length === 1);
    check("…recording the strategy it was asked for", db.letters[0].strategy === "fcra_611");
  }
});
