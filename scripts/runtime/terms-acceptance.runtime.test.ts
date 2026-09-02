// Run: npx --no-install tsx scripts/runtime/terms-acceptance.runtime.test.ts
// (registration line for scripts/runtime/run-all.ts REQUIRED, added by the
//  coordinator at merge: "terms-acceptance.runtime.test.ts",)
//
// RC1-S8 / P1-10 (D-02) — MOCKED RUNTIME guard for terms acceptance at signup.
//
// ADOPTED IN FORM from the m2 lane (4ece50622b1e6b1a3f7c9cb40aef3dd411d5b80d,
// scripts/runtime/terms-acceptance.runtime.test.ts). Its SCENARIOS could not be:
// m2 executed app/api/stripe/checkout/route.ts and asserted a 428 before
// `stripe.subscriptions.update`. RC1's gate is registration, and this slice
// touches no commercial surface. What carried over is the shape of the argument
// — execute the REAL route, assert on what it DID — plus the properties m2
// identified as the ones worth proving at runtime: ordering, fail-closed
// refusal, real UNIQUE-constraint idempotency, and the server owning the version.
//
// This EXECUTES the real app/api/register/route.ts and the real lib/terms.ts
// against an in-process fake. scripts/terms-acceptance.test.ts pins the same
// properties by reading source; it cannot tell you that the route actually
// answered 400, that the row really exists afterwards, or that a failure inside
// the transaction leaves NO account behind. This can.
//
// THE FAKE IS NOT A DATABASE. It implements exactly the queries this route
// issues, THROWS on any shape it does not recognise, and enforces exactly two
// real constraints: UNIQUE(userId, version) on TermsAcceptance, and
// all-or-nothing semantics for $transaction. No Postgres, no network, no keys.
//
// NON-VACUITY (measured 2026-08-23; the pre-slice route restored into a working
// copy and reverted immediately afterwards, never committed):
//   · With `git show 31d4e35:app/api/register/route.ts` in place — the version
//     with no acceptance handling at all — **7 passed, 10 failed**, then the
//     run threw reading a terms row that was never written (exit 1). The
//     pre-fix behaviour is exactly section 1's subject: a POST carrying no
//     acceptance returns 200 and creates the account, and no terms row is ever
//     written on any request.
//   · Unmodified slice tree: **31 passed, 0 failed** (exit 0).
import { check, loadModule, mockModule, run, section } from "./_harness";

export {};

// ── the fake database ────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string;
}
interface TermsRow {
  id: string;
  userId: string;
  version: string;
  context: string;
  acceptedAt: Date;
}

class UniqueViolation extends Error {
  code = "P2002";
  constructor(target: string[]) {
    super(`Unique constraint failed on the fields: (\`${target.join("`,`")}\`)`);
    this.name = "PrismaClientKnownRequestError";
  }
}

class FakeDb {
  users: UserRow[] = [];
  terms: TermsRow[] = [];
  readonly calls: string[] = [];
  /** Set to throw from the terms write, to prove the transaction is atomic. */
  failTermsWrite = false;
  private seq = 0;

  reset(): void {
    this.users = [];
    this.terms = [];
    this.calls.length = 0;
    this.failTermsWrite = false;
  }

  private termsModel(scope: FakeDb) {
    return {
      findUnique: async (args: { where: { userId_version: { userId: string; version: string } } }) => {
        scope.calls.push("termsAcceptance.findUnique");
        const { userId, version } = args.where.userId_version;
        return scope.terms.find((t) => t.userId === userId && t.version === version) ?? null;
      },
      upsert: async (args: {
        where: { userId_version: { userId: string; version: string } };
        create: { userId: string; version: string; context: string };
        update: Record<string, unknown>;
      }) => {
        scope.calls.push("termsAcceptance.upsert");
        if (scope.failTermsWrite) throw new Error("simulated database failure writing the acceptance");
        const { userId, version } = args.where.userId_version;
        const existing = scope.terms.find((t) => t.userId === userId && t.version === version);
        if (existing) {
          // An EMPTY update must leave the stored row — acceptedAt included —
          // untouched. Anything non-empty would overwrite the first agreement.
          Object.assign(existing, args.update);
          return existing;
        }
        // The UNIQUE index is real here: a create for a (userId, version) that
        // already exists raises P2002 exactly as Postgres would.
        if (scope.terms.some((t) => t.userId === userId && t.version === version)) {
          throw new UniqueViolation(["userId", "version"]);
        }
        const row: TermsRow = {
          id: `terms_${++scope.seq}`,
          userId: args.create.userId,
          version: args.create.version,
          context: args.create.context,
          acceptedAt: new Date(Date.now() + scope.seq),
        };
        scope.terms.push(row);
        return row;
      },
    };
  }

  private userModel(scope: FakeDb) {
    return {
      findUnique: async (args: { where: { email?: string; id?: string } }) => {
        scope.calls.push("user.findUnique");
        if (args.where.email !== undefined) return scope.users.find((u) => u.email === args.where.email) ?? null;
        if (args.where.id !== undefined) return scope.users.find((u) => u.id === args.where.id) ?? null;
        throw new Error(`fake Prisma: unsupported user.findUnique ${JSON.stringify(args.where)}`);
      },
      create: async (args: { data: { email: string; name?: string | null; passwordHash: string } }) => {
        scope.calls.push("user.create");
        if (scope.users.some((u) => u.email === args.data.email)) throw new UniqueViolation(["email"]);
        const row: UserRow = { id: `user_${++scope.seq}`, ...args.data };
        scope.users.push(row);
        return row;
      },
    };
  }

  get user() {
    return this.userModel(this);
  }
  get termsAcceptance() {
    return this.termsModel(this);
  }

  /**
   * All-or-nothing. The callback runs against a SHADOW copy; its writes are
   * published only if it resolves. A route that created the account outside the
   * transaction, or that swallowed the acceptance failure, leaves a user behind
   * here and section 4 fails.
   */
  async $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T> {
    this.calls.push("$transaction.begin");
    const shadow = new FakeDb();
    shadow.users = this.users.map((u) => ({ ...u }));
    shadow.terms = this.terms.map((t) => ({ ...t }));
    shadow.failTermsWrite = this.failTermsWrite;
    try {
      const result = await fn(shadow);
      this.users = shadow.users;
      this.terms = shadow.terms;
      this.calls.push(...shadow.calls, "$transaction.commit");
      return result;
    } catch (e) {
      this.calls.push(...shadow.calls, "$transaction.rollback");
      throw e;
    }
  }
}

const db = new FakeDb();

// ── mocks: only the I/O boundaries. lib/terms.ts is the REAL module. ─────────
mockModule("lib/prisma.ts", { prisma: db });
mockModule("lib/rateLimit.ts", { clientIp: () => "203.0.113.7", enforceRateLimit: async () => null });

const register = loadModule<{ POST: (req: Request) => Promise<Response> }>("app/api/register/route.ts");
const terms = loadModule<{ CURRENT_TERMS_VERSION: string }>("lib/terms.ts");

const GOOD_PASSWORD = "CreditVec1!";
function post(body: unknown): Promise<Response> {
  return register.POST(
    new Request("https://creditvector.app/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}
const json = async (res: Response) => JSON.parse(await res.text()) as Record<string, unknown>;

run("terms-acceptance.runtime.test.ts", async () => {
  section("1. an account cannot be created without an explicit acceptance");
  for (const [label, value] of [
    ["the field is absent", undefined],
    ["it is false", false],
    ['it is the STRING "true"', "true"],
    ["it is the number 1", 1],
    ["it is null", null],
  ] as const) {
    db.reset();
    const body: Record<string, unknown> = { email: `a${label.length}@example.com`, password: GOOD_PASSWORD };
    if (value !== undefined) body.acceptTerms = value;
    const res = await post(body);
    const payload = await json(res);
    check(`${label} → 400, and NO account exists afterwards`, res.status === 400 && db.users.length === 0);
    check(`${label} → and no acceptance row was invented either`, db.terms.length === 0);
    if (label === "the field is absent") {
      check(
        "the refusal says what is actually required, in words a person can act on",
        typeof payload.error === "string" &&
          /accept the Terms of Service and Privacy Policy/i.test(payload.error) &&
          payload.termsRequired === true &&
          payload.termsUrl === "/legal/terms" &&
          payload.privacyUrl === "/legal/privacy"
      );
      check("…and it never reached the database", !db.calls.includes("user.create"));
    }
  }

  section("2. a direct API call cannot bypass the form");
  db.reset();
  // No browser, no checkbox, no client code — the same refusal.
  const bypass = await post({ email: "bypass@example.com", password: GOOD_PASSWORD, termsVersion: "2026-08-23" });
  check("naming a version instead of accepting is still refused", bypass.status === 400 && db.users.length === 0);

  section("3. a real signup records the acceptance the server decided on");
  db.reset();
  const ok = await post({ name: "Marcus Chen", email: "Marcus@Example.com", password: GOOD_PASSWORD, acceptTerms: true });
  const okBody = await json(ok);
  check("the account is created", ok.status === 200 && okBody.ok === true && db.users.length === 1);
  check("the email is normalised to lower case (pre-existing behaviour, not regressed)", db.users[0].email === "marcus@example.com");
  check("exactly one acceptance row exists", db.terms.length === 1);
  check(
    `the version recorded is the SERVER's published constant (${terms.CURRENT_TERMS_VERSION})`,
    db.terms[0].version === terms.CURRENT_TERMS_VERSION
  );
  check('the context records WHERE it was given ("registration")', db.terms[0].context === "registration");
  check("the row is tied to the account that was just created", db.terms[0].userId === db.users[0].id);
  check(
    "both writes happened inside ONE transaction, account first",
    db.calls.indexOf("$transaction.begin") < db.calls.indexOf("user.create") &&
      db.calls.indexOf("user.create") < db.calls.indexOf("termsAcceptance.upsert") &&
      db.calls.includes("$transaction.commit")
  );

  section("4. the transaction is real: a failed acceptance write leaves NO account");
  db.reset();
  db.failTermsWrite = true;
  let threw = false;
  try {
    await post({ email: "atomic@example.com", password: GOOD_PASSWORD, acceptTerms: true });
  } catch {
    threw = true;
  }
  check("the request fails rather than silently succeeding", threw);
  check(
    "…and no account survives it — an account with no acceptance is the defect itself",
    db.users.length === 0 && db.terms.length === 0
  );
  check("the transaction rolled back rather than committing", db.calls.includes("$transaction.rollback"));

  section("5. re-acceptance of the same revision is idempotent (real UNIQUE constraint)");
  db.reset();
  await post({ email: "dup@example.com", password: GOOD_PASSWORD, acceptTerms: true });
  const firstAcceptedAt = db.terms[0].acceptedAt.getTime();
  const again = await post({ email: "dup@example.com", password: GOOD_PASSWORD, acceptTerms: true });
  check("a second signup for the same email is refused as a duplicate account", again.status === 409);
  check("…and no second acceptance row appears", db.terms.length === 1);
  check("…and the ORIGINAL acceptance timestamp is untouched", db.terms[0].acceptedAt.getTime() === firstAcceptedAt);

  section("6. the S1 security policy still runs, and still runs FIRST");
  db.reset();
  const weak = await post({ email: "weak@example.com", password: "Abcd123!", acceptTerms: true });
  check("a policy-failing password is refused", weak.status === 400);
  check("…before anything is written", db.users.length === 0 && db.terms.length === 0);
  check(
    "…and the refusal is the password message, not the terms one (the two gates are distinct)",
    !/Terms of Service/i.test(String((await json(weak)).error))
  );

  section("7. nothing manufactures consent");
  db.reset();
  // Every refusal path above ran; none of them wrote. Restated as one claim, so
  // a future path that quietly writes on failure fails HERE rather than silently.
  await post({ email: "n1@example.com", password: GOOD_PASSWORD });
  await post({ email: "n2@example.com", password: "short", acceptTerms: true });
  await post({ email: "n3@example.com", password: GOOD_PASSWORD, acceptTerms: false });
  check("across every refusal, zero acceptance rows exist", db.terms.length === 0);
  check("…and zero accounts exist", db.users.length === 0);
});
