// Run: npx --no-install tsx scripts/runtime/free-entitlement.runtime.test.ts
//
// MOCKED RUNTIME guard for RC1-S6a: the free-consumer invariant, proven by
// EXECUTING the real product modules — the real lib/entitlements.ts, the real
// letter/identity/strategist routes, the real community routes and the real
// app/api/stripe/checkout/route.ts — against in-process fakes.
//
// WHAT IT PROVES THAT A SOURCE SCAN CANNOT:
//   · Five different payer shapes (free · legacy Professional · credit holder ·
//     agency-MANAGED consumer · agency PAYER) receive a byte-identical
//     capability object from the real resolver, and the managed consumer's
//     agency row is never even read.
//   · A full generation cycle leaves `letterCredits` byte-unchanged, and no
//     UPDATE against that column is ever issued. This is the D-3 trap: the
//     natural "free for all" implementation silently drains a historical payer's
//     prepaid balance, and only an executed write-log can catch it.
//   · No consumer request to the four assistance surfaces produces a 402.
//   · With the community switched off, an author can still delete their own
//     thread — and nobody else can read or post.
//   · Checkout answers 410 for all three products WITHOUT constructing a Stripe
//     client, creating a customer, or opening a session.
//
// WHAT IT IS NOT: an integration test. Nothing opens a socket, reaches Postgres,
// or talks to Stripe. See scripts/runtime/README.md.
//
// NON-VACUITY: measured against the branch base `0024873` — see the slice report.

export {};

import { check, section, loadModule, mockModule, mockPackage, requireActual, run } from "./_harness";

// ── the fake database ────────────────────────────────────────────────────────
// NOT a database. It implements exactly the queries the code under test issues
// and THROWS on any shape it does not recognize, so a rewritten query fails
// loudly instead of passing on a silent "no rows".
interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  role: string;
  plan: string;
  isAgency: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  letterCredits: number;
  managedByAgencyId: string | null;
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
  mailedAt: Date | null;
  responseText: string | null;
  responseOutcome: string | null;
  responseAnalysis: string | null;
  createdAt: Date;
}
interface ThreadRow {
  id: string;
  authorId: string | null;
  authorName: string;
  category: string;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
}
interface ReplyRow {
  id: string;
  threadId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  isKai: boolean;
  createdAt: Date;
}

/** Every write this guard must be able to prove did NOT happen. */
const writes: string[] = [];
const reads: string[] = [];

class FakeDb {
  users = new Map<string, UserRow>();
  letters: LetterRow[] = [];
  tradelines: Record<string, unknown>[] = [];
  assertions: Record<string, unknown>[] = [];
  threads: ThreadRow[] = [];
  replies: ReplyRow[] = [];
  private seq = 0;
  private id(p: string) {
    this.seq += 1;
    return `${p}_${this.seq}`;
  }

  seedUser(row: Partial<UserRow> & { id: string }): UserRow {
    const full: UserRow = {
      email: `${row.id}@runtime.test`,
      fullName: "Jane Q. Consumer",
      addressLine1: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      role: "USER",
      plan: "free",
      isAgency: false,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      stripeCustomerId: null,
      letterCredits: 0,
      managedByAgencyId: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      ...row,
    } as UserRow;
    this.users.set(full.id, full);
    return full;
  }

  user = {
    findUnique: async (args: { where: { id: string } }) => {
      reads.push("user.findUnique");
      return this.users.get(args.where.id) ?? null;
    },
    findFirst: async (args: { where: { id?: string } }) => {
      reads.push("user.findFirst");
      return (args.where.id && this.users.get(args.where.id)) || null;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      writes.push(`user.update:${Object.keys(args.data).join(",")}`);
      const row = this.users.get(args.where.id);
      if (!row) throw new Error("no user");
      Object.assign(row, args.data);
      return row;
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      writes.push(`user.updateMany:${Object.keys(args.data).join(",")}`);
      return { count: 0 };
    },
  };

  letter = {
    count: async () => {
      reads.push("letter.count");
      return this.letters.length;
    },
    findMany: async (args: { where: Record<string, unknown> }) => {
      reads.push("letter.findMany");
      const w = args.where as { userId?: string; tradelineId?: string; strategy?: string; round?: number };
      return this.letters
        .filter(
          (l) =>
            (w.userId === undefined || l.userId === w.userId) &&
            (w.tradelineId === undefined || l.tradelineId === w.tradelineId) &&
            (w.strategy === undefined || l.strategy === w.strategy) &&
            (w.round === undefined || l.round === w.round)
        )
        .map((l) => ({ id: l.id, targetBureau: l.targetBureau, mailedAt: l.mailedAt }));
    },
    findFirst: async (args: { where: { id?: string; userId?: string } }) => {
      reads.push("letter.findFirst");
      const found = this.letters.find(
        (l) => (!args.where.id || l.id === args.where.id) && (!args.where.userId || l.userId === args.where.userId)
      );
      if (!found) return null;
      const tradeline = this.tradelines.find((t) => (t as { id: string }).id === found.tradelineId) ?? null;
      return { ...found, tradeline };
    },
    create: async (args: { data: Partial<LetterRow> }) => {
      writes.push("letter.create");
      const row: LetterRow = {
        id: this.id("l"),
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
        mailedAt: null,
        responseText: null,
        responseOutcome: null,
        responseAnalysis: null,
        createdAt: new Date(),
      };
      this.letters.push(row);
      return { ...row };
    },
    update: async (args: { where: { id: string }; data: Partial<LetterRow> }) => {
      writes.push("letter.update");
      const row = this.letters.find((l) => l.id === args.where.id);
      if (!row) throw new Error("no letter");
      Object.assign(row, args.data);
      return { ...row };
    },
  };

  tradeline = {
    findFirst: async (args: { where: { id?: string; userId?: string } }) => {
      reads.push("tradeline.findFirst");
      return (
        this.tradelines.find(
          (t) =>
            (!args.where.id || (t as { id: string }).id === args.where.id) &&
            (!args.where.userId || (t as { userId: string }).userId === args.where.userId)
        ) ?? null
      );
    },
    findMany: async () => {
      reads.push("tradeline.findMany");
      return this.tradelines;
    },
  };

  consumerAssertion = {
    findMany: async () => {
      reads.push("consumerAssertion.findMany");
      return this.assertions;
    },
  };

  communityThread = {
    findMany: async () => {
      reads.push("communityThread.findMany");
      return this.threads.map((t) => ({ ...t }));
    },
    findUnique: async (args: { where: { id: string }; include?: unknown }) => {
      reads.push("communityThread.findUnique");
      const t = this.threads.find((x) => x.id === args.where.id);
      if (!t) return null;
      return args.include
        ? { ...t, replies: this.replies.filter((r) => r.threadId === t.id) }
        : { ...t };
    },
    create: async (args: { data: Partial<ThreadRow> }) => {
      writes.push("communityThread.create");
      const row: ThreadRow = {
        id: this.id("t"),
        authorId: (args.data.authorId as string | null) ?? null,
        authorName: String(args.data.authorName),
        category: String(args.data.category ?? "general"),
        title: String(args.data.title),
        body: String(args.data.body),
        pinned: false,
        locked: false,
        replyCount: 0,
        lastActivityAt: new Date(),
        createdAt: new Date(),
      };
      this.threads.push(row);
      return { ...row };
    },
    update: async (args: { where: { id: string } }) => {
      writes.push("communityThread.update");
      return this.threads.find((t) => t.id === args.where.id)!;
    },
    delete: async (args: { where: { id: string } }) => {
      writes.push("communityThread.delete");
      const i = this.threads.findIndex((t) => t.id === args.where.id);
      if (i < 0) throw new Error("no thread");
      const [row] = this.threads.splice(i, 1);
      this.replies = this.replies.filter((r) => r.threadId !== row.id); // FK cascade
      return row;
    },
  };

  communityReply = {
    findMany: async () => {
      reads.push("communityReply.findMany");
      return this.replies.map((r) => ({ ...r }));
    },
    create: async (args: { data: Partial<ReplyRow> }) => {
      writes.push("communityReply.create");
      const row: ReplyRow = {
        id: this.id("r"),
        threadId: String(args.data.threadId),
        authorId: (args.data.authorId as string | null) ?? null,
        authorName: String(args.data.authorName),
        body: String(args.data.body),
        isKai: Boolean(args.data.isKai),
        createdAt: new Date(),
      };
      this.replies.push(row);
      return { ...row };
    },
  };

  communityReport = {
    updateMany: async () => {
      writes.push("communityReport.updateMany");
      return { count: 0 };
    },
  };

  async $executeRawUnsafe(sql: string): Promise<number> {
    if (/^\s*CREATE (TABLE|INDEX)/i.test(sql)) return 0;
    throw new Error(`fake db: unsupported statement: ${sql.slice(0, 80)}`);
  }

  async $queryRawUnsafe<T>(sql: string): Promise<T> {
    if (/FROM "ProductEvent"/.test(sql)) {
      reads.push("productEvent.select");
      return [] as unknown as T;
    }
    throw new Error(`fake db: unsupported query: ${sql.slice(0, 80)}`);
  }
}

const db = new FakeDb();

// ── session + I/O boundaries ─────────────────────────────────────────────────
let sessionUserId: string | null = "u_free";
const currentRow = () => (sessionUserId ? db.users.get(sessionUserId) ?? null : null);

mockModule("lib/prisma.ts", { prisma: db });
mockModule("lib/session.ts", {
  currentUser: async () => currentRow(),
  currentUserOrDemo: async () => currentRow(),
  currentAccount: async () => currentRow(),
});
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/events.ts", {
  ...(requireActual("lib/events.ts") as Record<string, unknown>),
  track: async () => undefined,
});
mockModule("lib/docCrypto.ts", {
  encryptText: (s: string) => `enc:${s}`,
  decryptText: (s: string) => (s.startsWith("enc:") ? s.slice(4) : s),
});
mockModule("lib/aiMeter.ts", {
  meteredMessage: async () => ({
    content: [{ type: "text", text: "A".repeat(400) }],
  }),
});
mockModule("lib/kai.ts", { askKai: async () => ({ text: "Kai answer.", usedAI: false }) });
mockModule("lib/attachments.ts", {
  filesFromForm: () => [],
  validateFiles: async () => ({ ok: [], error: null }),
  saveAttachments: async () => [],
  listAttachments: async () => ({}),
  deleteAttachmentsFor: async () => undefined,
});
mockModule("lib/admin.ts", { requireAdmin: async () => null, logAudit: async () => undefined });
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => undefined });
mockModule("lib/furnisher.ts", { getFurnisherContact: async () => null, formatFurnisherAddress: () => null });
mockModule("lib/intelligence/snapshot.ts", {
  disputeQueue: () => [
    {
      creditorName: "Midland Funding LLC",
      accountType: "collection",
      isDebtBuyer: true,
      balance: 120000,
      probability: "high",
      score: 80,
      reasons: ["charged off"],
      disputeAngles: ["debt buyer"],
    },
  ],
});
mockModule("lib/observability.ts", { reportError: () => undefined });

// Stripe: the client must never be constructed on a closed sale.
let stripeConstructed = 0;
let stripeCustomerCalls = 0;
const stripeCalls: string[] = [];
mockModule("lib/stripe.ts", {
  ...(requireActual("lib/stripe.ts") as Record<string, unknown>),
  getStripe: () => {
    stripeConstructed += 1;
    return {
      checkout: { sessions: { create: async () => { stripeCalls.push("sessions.create"); return { url: "x" }; } } },
      subscriptions: {
        list: async () => { stripeCalls.push("subscriptions.list"); return { data: [] }; },
        update: async () => { stripeCalls.push("subscriptions.update"); return { id: "s", status: "active" }; },
      },
    };
  },
});
mockModule("lib/billing.ts", {
  ...(requireActual("lib/billing.ts") as Record<string, unknown>),
  getOrCreateStripeCustomer: async () => {
    stripeCustomerCalls += 1;
    return "cus_fake";
  },
});
mockPackage("next-auth/next", { getServerSession: async () => ({ user: { id: sessionUserId } }) });
mockModule("lib/auth.ts", { authOptions: {} });

process.env.ANTHROPIC_API_KEY = "sk-runtime-test-placeholder";
delete process.env.COMMUNITY_ENABLED;

// ── real code under test ─────────────────────────────────────────────────────
const entitlements = loadModule<{
  getEntitlement(u: { id: string; letterCredits?: number | null }): Promise<Record<string, unknown>>;
  spendLetterCredits(id: string, e: { premium: boolean; freeMonthlyRemaining: number; letterCredits: number }, n: number): Promise<void>;
}>("lib/entitlements.ts");
const generate = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/letters/generate/route.ts");
const round2 = loadModule<{ POST(req: Request, c: { params: { id: string } }): Promise<Response> }>(
  "app/api/letters/[id]/round2/route.ts"
);
const identityLetter = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/identity/letter/route.ts");
const strategist = loadModule<{ POST(): Promise<Response> }>("app/api/strategist/plan/route.ts");
const checkout = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/stripe/checkout/route.ts");
const threads = loadModule<{ GET(req: Request): Promise<Response>; POST(req: Request): Promise<Response> }>(
  "app/api/community/threads/route.ts"
);
const thread = loadModule<{
  GET(req: Request, c: { params: { id: string } }): Promise<Response>;
  DELETE(req: Request, c: { params: { id: string } }): Promise<Response>;
}>("app/api/community/threads/[id]/route.ts");
const askKaiRoute = loadModule<{ POST(req: Request, c: { params: { id: string } }): Promise<Response> }>(
  "app/api/community/threads/[id]/ask-kai/route.ts"
);

// ── fixtures ─────────────────────────────────────────────────────────────────
const TRADELINE = {
  id: "tl1",
  userId: "",
  creditorName: "Midland Funding LLC",
  originalCreditor: null,
  accountNumberMask: "XXXX-1234",
  accountType: "collection",
  balance: 120000,
  dateOfFirstDelinquency: null,
  bureauData: {
    EQUIFAX: { status: "collection" },
    EXPERIAN: { status: "collection" },
    TRANSUNION: { status: "collection" },
  },
};

/** The five payer shapes the invariant names. */
const SHAPES = [
  { id: "u_free", label: "a free consumer", row: {} as Partial<UserRow> },
  {
    id: "u_legacy_pro",
    label: "a legacy Professional",
    row: { plan: "premium", subscriptionStatus: "active", stripeCustomerId: "cus_pro" } as Partial<UserRow>,
  },
  { id: "u_credits", label: "a letterCredits holder", row: { letterCredits: 5 } as Partial<UserRow> },
  { id: "u_managed", label: "an Agency-MANAGED consumer", row: { managedByAgencyId: "u_agency" } as Partial<UserRow> },
  { id: "u_agency", label: "an Agency payer", row: { isAgency: true, plan: "agency", subscriptionStatus: "active" } as Partial<UserRow> },
];

function seedAll(): void {
  db.users.clear();
  for (const s of SHAPES) db.seedUser({ id: s.id, ...s.row });
}

function seedTradelineFor(userId: string): void {
  db.tradelines = [{ ...TRADELINE, userId }];
  db.assertions = [
    {
      assertionType: "inaccurate_balance",
      consumerNote: "The balance is not mine.",
      bureauScope: null,
      status: "ACTIVE",
      createdAt: new Date(),
    },
  ];
}

function genReq(bureaus: string[] = ["EQUIFAX"]): Request {
  return new Request("https://runtime.test/api/letters/generate", {
    method: "POST",
    body: JSON.stringify({ tradelineId: "tl1", strategyId: "fcra_611", targetBureaus: bureaus }),
  });
}

const ALL_BUREAUS = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

function reset(): void {
  writes.length = 0;
  reads.length = 0;
  stripeCalls.length = 0;
  stripeConstructed = 0;
  stripeCustomerCalls = 0;
  db.letters = [];
  db.threads = [];
  db.replies = [];
}

run("free-entitlement.runtime.test.ts", async () => {
  // ── 1 · one capability, five payers ───────────────────────────────────────
  section("1. the real resolver answers identically for every payer shape");
  seedAll();
  reset();
  const results: Array<{ label: string; ent: Record<string, unknown> }> = [];
  for (const s of SHAPES) {
    results.push({ label: s.label, ent: await entitlements.getEntitlement(db.users.get(s.id)!) });
  }
  // letterCredits is a HISTORICAL FACT about the row, not a capability, so it is
  // compared separately: the capability object must not vary at all.
  const capability = results.map(({ ent }) => {
    const { letterCredits, ...rest } = ent;
    void letterCredits;
    return JSON.stringify(rest);
  });
  for (const { label, ent } of results) {
    check(`${label}: premium is false`, ent.premium === false);
    check(`${label}: plan is "free"`, ent.plan === "free");
    check(`${label}: AI refinement is off (D-2)`, ent.aiRefinement === false);
    check(`${label}: letters are unbounded`, ent.letterLimit === null && ent.lettersRemaining === null);
  }
  check(`all five capability objects are byte-identical (${capability[0]})`, new Set(capability).size === 1);
  check("the legacy paid field freeMonthlyRemaining is gone from the shape",
    results.every(({ ent }) => !("freeMonthlyRemaining" in ent)));
  check("a credit holder's balance is still REPORTED (history is visible)",
    results.find((r) => r.label.includes("Credits"))?.ent.letterCredits === 5);
  check(`the managed consumer's AGENCY ROW WAS NEVER READ — P1-26 (reads: ${reads.join(",")})`,
    !reads.includes("user.findUnique") && !reads.includes("user.findFirst"));
  check(`resolving an entitlement writes nothing at all (writes: ${writes.join(",") || "none"})`, writes.length === 0);

  // ── 2 · the D-3 credit freeze ─────────────────────────────────────────────
  section("2. a generation cycle leaves letterCredits byte-unchanged");
  reset();
  sessionUserId = "u_credits";
  seedTradelineFor("u_credits");
  const before = db.users.get("u_credits")!.letterCredits;

  // Six net-new letters in a month, from an account holding 5 purchased credits.
  // Under the pre-slice rules this is exactly the burn scenario: the first three
  // consume the free monthly allowance, and the next three fall "beyond free" and
  // decrement letterCredits 5 → 2. The second batch is forced to CREATE rather
  // than regenerate by marking the first batch mailed (lib/letter.ts never
  // matches a mailed letter for in-place regeneration).
  const first = await generate.POST(genReq(ALL_BUREAUS));
  check(`the first three letters were written (status ${first.status})`, first.status === 200);
  check(`…three rows, one per bureau (got ${db.letters.length})`, db.letters.length === 3);
  for (const l of db.letters) l.mailedAt = new Date();

  const second = await generate.POST(genReq(ALL_BUREAUS));
  check(`a fourth-through-sixth letter is NOT refused (status ${second.status})`, second.status === 200);
  const secondBody = (await second.json()) as Record<string, unknown>;
  check(`…all three were created, none silently dropped (createdCount=${JSON.stringify(secondBody.createdCount)})`,
    secondBody.createdCount === 3);
  check(`six letters exist beyond any former monthly allowance (got ${db.letters.length})`, db.letters.length === 6);
  check("the credit balance is byte-unchanged", db.users.get("u_credits")!.letterCredits === before && before === 5);
  check(`no UPDATE was ever issued against letterCredits (writes: ${writes.join(",") || "none"})`,
    !writes.some((w) => w.includes("letterCredits")));
  check(`no user row was written at all during generation (writes: ${writes.join(",") || "none"})`,
    !writes.some((w) => w.startsWith("user.")));

  section("2b. even a direct call to the spend path writes nothing (belt and braces)");
  reset();
  await entitlements.spendLetterCredits("u_credits", { premium: false, freeMonthlyRemaining: 0, letterCredits: 5 }, 3);
  check(`the frozen spend path issues no write (writes: ${writes.join(",") || "none"})`, writes.length === 0);
  check("…and the balance is still 5", db.users.get("u_credits")!.letterCredits === 5);

  // ── 3 · zero 402 on the four assistance surfaces ──────────────────────────
  section("3. no payer shape can reach a payment-required refusal");
  for (const s of SHAPES) {
    reset();
    sessionUserId = s.id;
    seedTradelineFor(s.id);

    const gen = await generate.POST(genReq());
    const genBody = (await gen.clone().json()) as Record<string, unknown>;
    check(`${s.label} · generate: not 402 (got ${gen.status})`, gen.status !== 402);
    check(`${s.label} · generate: no upgrade nudge on the response`,
      !("upgrade" in genBody) && !("capped" in genBody));
    check(`${s.label} · generate: nothing in the body mentions upgrading`,
      !/upgrade|Professional|letter pack/i.test(JSON.stringify(genBody)));

    // Round 2 needs a parent letter carrying a logged response.
    check(`${s.label} · generate wrote a letter to escalate from`, db.letters.length > 0);
    const parent = db.letters[0];
    parent.responseText = "enc:The bureau verified the account as accurate.";
    parent.responseOutcome = "verified";
    const r2 = await round2.POST(
      new Request("https://runtime.test/r2", { method: "POST", body: JSON.stringify({}) }),
      { params: { id: parent.id } }
    );
    check(`${s.label} · round 2: not 402 (got ${r2.status})`, r2.status !== 402);

    const idl = await identityLetter.POST(
      new Request("https://runtime.test/identity", {
        method: "POST",
        body: JSON.stringify({
          bureau: "EQUIFAX",
          discrepancies: [
            { category: "address", reportValue: "9 Old Rd", yourValue: "1 Main St", severity: "high", explanation: "moved", confirmed: true },
          ],
        }),
      })
    );
    check(`${s.label} · identity letter: not 402 (got ${idl.status})`, idl.status !== 402);
    check(`${s.label} · identity letter: the draft is produced for everyone`, idl.status === 200);

    const plan = await strategist.POST();
    check(`${s.label} · action plan: not 402 (got ${plan.status})`, plan.status !== 402);
    check(`${s.label} · action plan: produced for everyone`, plan.status === 200);
  }

  // ── 4 · community is off, but an author keeps control ─────────────────────
  section("4. community switched OFF refuses truthfully — and never with a paywall");
  reset();
  delete process.env.COMMUNITY_ENABLED;
  sessionUserId = "u_legacy_pro"; // the account that USED to be let in by payment
  const list = await threads.GET(new Request("https://runtime.test/api/community/threads"));
  const listBody = (await list.json()) as Record<string, unknown>;
  check("a former paying member is refused too (payment is not the axis)", list.status === 403);
  check("the refusal is the availability message", listBody.error === "Community is not available right now.");
  check("…and is machine-readable as a feature state", listBody.communityUnavailable === true);
  check("the words \"Members only\" are gone", !/Members only/.test(JSON.stringify(listBody)));
  check("nothing in the refusal mentions a plan or a price",
    !/member|plan|upgrade|\$|paid/i.test(String(listBody.error)));

  const create = await threads.POST(new Request("https://runtime.test/api/community/threads", { method: "POST" }));
  check("posting is refused while the feature is off", create.status === 403);
  check("…and nothing was written", !writes.some((w) => w.startsWith("communityThread.create")));

  db.threads.push({
    id: "t_own", authorId: "u_legacy_pro", authorName: "Member", category: "general",
    title: "My post", body: "My words", pinned: false, locked: false, replyCount: 0,
    lastActivityAt: new Date(), createdAt: new Date(),
  });
  db.threads.push({
    id: "t_other", authorId: "u_free", authorName: "Someone", category: "general",
    title: "Their post", body: "Their words", pinned: false, locked: false, replyCount: 0,
    lastActivityAt: new Date(), createdAt: new Date(),
  });

  const kai = await askKaiRoute.POST(new Request("https://runtime.test/ask-kai", { method: "POST" }), {
    params: { id: "t_own" },
  });
  check("Kai-in-community refuses cleanly while the feature is off", kai.status === 403);
  check("…and no Kai reply was written", !writes.includes("communityReply.create"));

  const readOwn = await thread.GET(new Request("https://runtime.test/t"), { params: { id: "t_own" } });
  check("even your OWN thread is not readable while the feature is off", readOwn.status === 403);

  const delOther = await thread.DELETE(new Request("https://runtime.test/t", { method: "DELETE" }), {
    params: { id: "t_other" },
  });
  check("someone else's thread cannot be deleted", delOther.status === 403);
  check("…and it is still there", db.threads.some((t) => t.id === "t_other"));

  const delOwn = await thread.DELETE(new Request("https://runtime.test/t", { method: "DELETE" }), {
    params: { id: "t_own" },
  });
  check("THE AUTHOR CAN STILL DELETE THEIR OWN THREAD with the feature off", delOwn.status === 200);
  check("…and it is really gone", !db.threads.some((t) => t.id === "t_own"));

  section("4b. switched ON, a never-paid consumer has the same access as anyone");
  reset();
  process.env.COMMUNITY_ENABLED = "true";
  sessionUserId = "u_free";
  const openList = await threads.GET(new Request("https://runtime.test/api/community/threads"));
  check("a free account can read the network when it is on", openList.status === 200);
  sessionUserId = "u_legacy_pro";
  const paidList = await threads.GET(new Request("https://runtime.test/api/community/threads"));
  check("a former payer gets the same status, not a better one", paidList.status === openList.status);
  delete process.env.COMMUNITY_ENABLED;

  // ── 5 · checkout refuses before Stripe ────────────────────────────────────
  section("5. every purchase is refused 410, pre-Stripe");
  for (const [label, body] of [
    ["letter pack (D-3)", { product: "letters_5" }],
    ["Professional (D-3)", { plan: "premium" }],
    ["Professional by omission (D-3)", {}],
    ["Agency (D-4)", { plan: "agency" }],
    ["an unrecognized plan", { plan: "agency_pro" }],
  ] as const) {
    reset();
    sessionUserId = "u_free";
    const res = await checkout.POST(
      new Request("https://runtime.test/api/stripe/checkout", { method: "POST", body: JSON.stringify(body) })
    );
    const json = (await res.json()) as Record<string, unknown>;
    check(`${label}: 410 Gone (got ${res.status})`, res.status === 410);
    check(`${label}: no Stripe client was constructed`, stripeConstructed === 0);
    check(`${label}: no Stripe customer was created or looked up`, stripeCustomerCalls === 0);
    check(`${label}: no Stripe call of any kind (${stripeCalls.join(",") || "none"})`, stripeCalls.length === 0);
    check(`${label}: the refusal is machine-readable`, json.salesClosed === true);
    check(`${label}: the copy quotes no price and pitches nothing`,
      !/\$\d|upgrade|pricing/i.test(String(json.error)));
  }
  reset();
  sessionUserId = "u_agency";
  const agencyBuy = await checkout.POST(
    new Request("https://runtime.test/api/stripe/checkout", { method: "POST", body: JSON.stringify({ plan: "agency" }) })
  );
  check("an Agency operator is told the pause does not affect their account",
    /Existing Agency accounts are unaffected/.test(String(((await agencyBuy.json()) as Record<string, unknown>).error)));
});
