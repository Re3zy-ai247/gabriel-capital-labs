// Run: npx --no-install tsx scripts/runtime/self-heal-concurrency.runtime.test.ts
//
// S11 · NEW-4 — the runtime self-heal must survive concurrency, must not latch,
// and must never take a consumer surface blank.
//
// WHAT THE LIVE RUN SAW. The first /dashboard load of the session returned
// 46 138 bytes — AppShell chrome with the entire Mission Control body missing and
// no error text (a healthy load is ~280 KB) — while the log recorded ten
// `P2010 ... Key (typname, typnamespace)=(Campaign, 2200) already exists` and
// thirteen `relation "DecisionRegistry" does not exist`.
//
// THREE COMPOUNDING CAUSES, all fixed here:
//   1. `CREATE ... IF NOT EXISTS` is not atomic in Postgres — two sessions both
//      pass the existence check and one loses on the pg_type unique index. That
//      error means the object EXISTS, so treating it as a failure was the bug.
//   2. `let tableReady = false` was set only AFTER the await, so a burst of
//      concurrent first requests each issued the DDL and raced each other.
//   3. The memo latched SUCCESS for the life of the process, so a table that went
//      missing afterwards was never re-healed — every later request failed
//      identically on that lambda.
//
// Offline. No database, no network. The Prisma double records every statement so
// "one DDL, not N" is measured rather than assumed.
import { check, loadModule, mockModule, run, section } from "./_harness";

type Fault = null | "duplicate" | "missing" | "other";

const ddlStatements: string[] = [];
let ddlFault: Fault = null;
let queryFault: Fault = null;
let inFlightDdl = 0;
let maxConcurrentDdl = 0;

function faultError(kind: Exclude<Fault, null>): Error {
  if (kind === "duplicate") {
    // The shape Prisma surfaces for the pg_type race.
    return Object.assign(
      new Error(
        'Raw query failed. Code: `23505`. Message: `ERROR: duplicate key value violates unique constraint "pg_type_typname_nsp_index"\\nDETAIL: Key (typname, typnamespace)=(Campaign, 2200) already exists.`'
      ),
      { code: "P2010" }
    );
  }
  if (kind === "missing") {
    return Object.assign(new Error('relation "Campaign" does not exist'), { code: "P2010" });
  }
  return new Error("guard: connection reset");
}

mockModule("lib/prisma.ts", {
  prisma: {
    $executeRawUnsafe: async (sql: string) => {
      ddlStatements.push(sql);
      inFlightDdl++;
      maxConcurrentDdl = Math.max(maxConcurrentDdl, inFlightDdl);
      try {
        // Yield, so a non-single-flighted implementation really does overlap.
        await new Promise((r) => setTimeout(r, 5));
        if (ddlFault) throw faultError(ddlFault);
        return 0;
      } finally {
        inFlightDdl--;
      }
    },
    $executeRaw: async () => {
      if (queryFault) throw faultError(queryFault);
      return 1;
    },
    $queryRaw: async () => {
      if (queryFault) throw faultError(queryFault);
      return [];
    },
  },
});

const { PrismaCampaignStore, campaignDataUnavailable, resetCampaignAvailability } = loadModule<
  typeof import("../../lib/campaign/CampaignStore")
>("lib/campaign/CampaignStore.ts");
const registry = loadModule<typeof import("../../lib/decisionRegistry")>("lib/decisionRegistry.ts");

function resetProbe(): void {
  ddlStatements.length = 0;
  maxConcurrentDdl = 0;
  ddlFault = null;
  queryFault = null;
  resetCampaignAvailability();
  registry.resetDecisionAvailability();
}

run("self-heal-concurrency.runtime.test.ts", async () => {
  const store = new PrismaCampaignStore();

  section("parallel first-hits issue ONE set of DDL, not one per caller");
  resetProbe();
  const burst = await Promise.all(Array.from({ length: 12 }, () => store.listByUser("user_1")));
  check("every concurrent caller is served", burst.length === 12 && burst.every((r) => Array.isArray(r)));
  check(
    `the DDL ran once, not once per caller (${ddlStatements.length} statements)`,
    ddlStatements.length === 2 // CREATE TABLE + CREATE INDEX, exactly one pass
  );
  check("no two DDL statements were ever in flight together", maxConcurrentDdl === 1);
  check("none of them errored, so no consumer saw a failure", !campaignDataUnavailable());

  section("the pg_type race is treated as SUCCESS — the object exists either way");
  resetProbe();
  ddlFault = "duplicate";
  const raced = await Promise.all(Array.from({ length: 8 }, () => store.listByUser("user_1")));
  check("every caller is still served", raced.every((r) => Array.isArray(r)));
  check(
    "an 'already exists' failure does not degrade the read",
    !campaignDataUnavailable()
  );

  section("a GENUINE failure degrades, and is retried rather than latched");
  resetProbe();
  // Clear the memo the way production would: a read that finds the relation gone.
  // (Without this the store legitimately short-circuits — the table IS known
  // created — and the DDL fault below would never be reached, which would make
  // the assertions that follow vacuous.)
  queryFault = "missing";
  await store.listByUser("user_1");
  queryFault = null;
  resetCampaignAvailability();
  ddlStatements.length = 0;
  ddlFault = "other";
  const failed = await store.listByUser("user_1");
  check("the read returns an empty list instead of throwing", Array.isArray(failed) && failed.length === 0);
  check("and the degradation is recorded, not silently swallowed", campaignDataUnavailable());
  const attemptsAfterFailure = ddlStatements.length;
  ddlFault = null;
  const recovered = await store.listByUser("user_1");
  check("the very next call RETRIES the self-heal (no failure latch)", ddlStatements.length > attemptsAfterFailure);
  check("and it succeeds", Array.isArray(recovered));
  check("the availability signal clears once the read works", !campaignDataUnavailable());

  section("a table that goes missing AFTER a success is re-healed (no success latch)");
  resetProbe();
  await store.listByUser("user_1"); // warm the memo
  const afterWarm = ddlStatements.length;
  queryFault = "missing";
  const gone = await store.listByUser("user_1");
  check("the read degrades rather than throwing", Array.isArray(gone) && gone.length === 0);
  check("the consumer-visible state is 'unavailable', not 'you have none'", campaignDataUnavailable());
  queryFault = null;
  await store.listByUser("user_1");
  check(
    "the dropped table is re-created on the next call — the success memo did not latch",
    ddlStatements.length > afterWarm
  );

  section("WRITES still fail loudly — a dropped campaign must never be silent");
  resetProbe();
  queryFault = "other"; // the INSERT itself fails
  let writeThrew = false;
  try {
    await store.create({
      id: "c1", userId: "user_1", sequence: 1, status: "DRAFT", strategyFamily: "x",
      rationale: "", userDecision: null, items: [], warnings: [], nextUnlock: [],
      snapshot: null, createdAt: new Date().toISOString(), approvedAt: null, startedAt: null,
      completedAt: null, canceledAt: null, auditTrail: [],
    } as unknown as Parameters<typeof store.create>[0]);
  } catch {
    writeThrew = true;
  }
  check("create() propagates the failure to its caller", writeThrew);

  section("lib/decisionRegistry.ts — same three properties");
  resetProbe();
  const decisions = await Promise.all(Array.from({ length: 10 }, () => registry.listDecisions("user_1")));
  check("concurrent first-hits are all served", decisions.every((d) => Array.isArray(d)));
  check(`the DDL ran once (${ddlStatements.length} statements)`, ddlStatements.length === 2);
  check("no two DDL statements overlapped", maxConcurrentDdl === 1);

  resetProbe();
  ddlFault = "duplicate";
  const racedDecisions = await registry.listDecisions("user_1");
  check("an 'already exists' race is not a failure here either", Array.isArray(racedDecisions) && !registry.decisionDataUnavailable());

  resetProbe();
  queryFault = "missing";
  const missing = await registry.listDecisions("user_1");
  check("a missing relation degrades to empty, never throws", Array.isArray(missing) && missing.length === 0);
  check("and is reported as unavailable rather than as 'no decisions'", registry.decisionDataUnavailable());
  const afterMissing = ddlStatements.length;
  queryFault = null;
  await registry.listDecisions("user_1");
  check("the next call re-runs the self-heal", ddlStatements.length > afterMissing);
  check("recordDecision never throws either (audit must not break the product)", await registry.recordDecision({
    userId: "user_1", tradelineId: null, strategyId: null, confidence: "Strong", basis: [],
  }).then(() => true, () => false));
});
