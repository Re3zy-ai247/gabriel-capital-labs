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
//   · (unmodified) **49 passed, 0 failed (exit 0)**.
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
  balance: number;
  dateOfFirstDelinquency: Date | null;
  bureauData: unknown;
}
interface AssertionRow {
  id: string;
  userId: string;
  tradelineId: string;
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
    create: async (args: { data: Partial<AssertionRow> }) => {
      this.calls.push("consumerAssertion.create");
      const row: AssertionRow = {
        id: this.id("ca"),
        userId: String(args.data.userId),
        tradelineId: String(args.data.tradelineId),
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
    findMany: async (args: { where: { userId?: string; tradelineId?: string } }) => {
      this.calls.push("letter.findMany");
      const w = args.where ?? {};
      return this.letters
        .filter((l) => (w.userId === undefined || l.userId === w.userId) && (w.tradelineId === undefined || l.tradelineId === w.tradelineId))
        .map((l) => ({ id: l.id, targetBureau: l.targetBureau, mailedAt: l.mailedAt }));
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
let aiCalls = 0;

mockModule("lib/prisma.ts", { prisma: db });
mockModule("lib/session.ts", { currentUserOrDemo: async () => sessionUser });
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => undefined });
mockModule("lib/events.ts", {
  track: async () => undefined,
  PRODUCT_EVENTS: { disputeCreated: "dispute_created", failure: "failure" },
});
mockModule("lib/docCrypto.ts", { encryptText: (s: string) => `enc:${s}` });
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
const assertionRoute = loadModule<{
  POST: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
  DELETE: (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
}>("app/api/tradelines/[id]/assertion/route.ts");

function seedTradeline(id: string, userId: string): TradelineRow {
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
  };
  db.tradelines.push(row);
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
    check("NOTHING was charged — no credit spend at all", spend.length === 0);
    check("no AI call was made", aiCalls === 0);
    check("the entitlement gate was never even reached (no letter lookup)", !db.calls.includes("letter.findMany"));
  }

  // ── 2. a withdrawn confirmation is not a confirmation ─────────────────────
  section("a WITHDRAWN confirmation does not unlock generation");
  {
    db.reset();
    spend.length = 0;
    seedTradeline("t1", "u1");
    db.assertions.push({
      id: "ca_w",
      userId: "u1",
      tradelineId: "t1",
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
    check("…and their own words, verbatim", letterBody.includes('In my own words: "Paid in full 3/2/2024 by cashier\'s check."'));
    check("…and NOT the old always-on Payment History concern", !letterBody.includes("The payment history associated with this account as reported."));
    check("…and NOT the old first-person fallback", !/I am unable to reconcile the reported status with my records/.test(letterBody));
    check("exactly one numbered concern (nothing padded in)", (letterBody.match(/^\d+\. /gm) ?? []).length === 1);
    check("no complaint intent is asserted", !/I am prepared to submit this record/.test(letterBody));
    check("the stored row is encrypted, not plaintext", db.letters[0].body.startsWith("enc:"));
    check("one letter was accounted for", spend.length === 1 && spend[0] === 1);
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

  // ── 8. bureau scope is honored end to end ────────────────────────────────
  section("a fact confirmed about one bureau's file is not told to another");
  {
    db.reset();
    seedTradeline("t1", "u1");
    await assertionRoute.POST(
      post("http://localhost/api/tradelines/t1/assertion", { assertionType: "inaccurate_status", bureauScope: "EXPERIAN" }),
      { params: { id: "t1" } }
    );
    const res = await generate.POST(
      post("http://localhost/api/letters/generate", { tradelineId: "t1", strategyId: "fcra_611", targetBureaus: ["EQUIFAX"] })
    );
    const body = await json(res);
    check("the letter to Equifax is still generated (the gate is per-tradeline)", res.status === 200);
    const letterBody = String((body.letter as Json | undefined)?.body ?? "");
    check("…but carries NO factual concern scoped to another bureau", !letterBody.includes("SUMMARY OF FACTUAL CONCERNS"));
    check("…and never names the other bureau", !/Experian/i.test(letterBody));
  }
});
