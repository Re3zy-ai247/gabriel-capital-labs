// Guards for Sprint XI mail execution helpers + the queue-not-dispatch flow.
// Pure, no DB/network. Run: npx tsx scripts/mail-execution.test.ts
import { estimatePages, letterContentHash, bureauMailAddress, furnisherMailAddress, senderMailAddress, oneLine } from "../lib/mailExecution";
import { MailService, InMemoryMailStore, computePrice, canTransition } from "../lib/mail";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }
function eq(label: string, got: unknown, want: unknown) { ok(`${label} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want)); }
async function throws(label: string, fn: () => Promise<unknown>) {
  try { await fn(); failures++; console.error(`✗ ${label} (did not throw)`); } catch { ok(label, true); }
}

// ---- helpers ----
ok("single short letter → 1 page", estimatePages("Dear Sir,\nPlease investigate.\nThanks") === 1);
ok("long letter → multiple pages", estimatePages(Array(100).fill("line").join("\n")) >= 2);
ok("content hash is stable + 64-hex", /^[0-9a-f]{64}$/.test(letterContentHash("hello")) && letterContentHash("hello") === letterContentHash("hello"));
ok("content hash changes with content", letterContentHash("a") !== letterContentHash("b"));

const eq_ = bureauMailAddress("EQUIFAX");
ok("bureau address parses to structured fields", !!eq_ && eq_.state === "GA" && /^\d{5}/.test(eq_.zip) && !!eq_.line1);
const furn = furnisherMailAddress("Midland Funding", { line1: "PO Box 939069", city: "San Diego", state: "CA", zip: "92193" });
ok("furnisher w/ full address → structured", !!furn && furn.city === "San Diego");
ok("furnisher w/ partial address → null (never invented)", furnisherMailAddress("X", { line1: "PO Box 1" }) === null);
ok("sender needs full address", senderMailAddress({ addressLine1: "1 Main", city: "Austin", state: "TX", zip: "78701", fullName: "Rey" }) !== null);
ok("sender incomplete → null", senderMailAddress({ city: "Austin" }) === null);
ok("oneLine renders a mailing line", /Austin, TX 78701/.test(oneLine(senderMailAddress({ addressLine1: "1 Main", city: "Austin", state: "TX", zip: "78701", fullName: "Rey" })!)));

// ---- the queue-not-dispatch flow: reaches QUEUED, never a provider state ----
(async () => {
  const to = bureauMailAddress("EQUIFAX")!;
  const from = senderMailAddress({ addressLine1: "1 Main", city: "Austin", state: "TX", zip: "78701", fullName: "Rey" })!;
  const store = new InMemoryMailStore();
  let t = 0;
  const svc = new MailService({ store, now: () => `2026-07-14T00:00:0${t++}.000Z`, sink: async () => {} });
  const spec = { pages: 2, color: false, doubleSided: true, mailClass: "first_class" as const, certified: false };
  const price = computePrice({ estimate: { providerCostCents: 104, currency: "USD", breakdown: [] }, plan: "free", isAgency: false });

  const m0 = await svc.initiate({ mailId: "mail_L1", letterId: "L1", userId: "u1", recipient: to, spec, cost: price, contentHash: letterContentHash("body") });
  eq("initiate → IN_REVIEW", m0.status, "IN_REVIEW");
  ok("content hash recorded in audit (proof of intent)", m0.auditTrail.some((e) => (e.detail ?? "").includes(letterContentHash("body"))));

  // cannot queue before approval + payment
  await throws("queue before approval throws", () => svc.queueForProvider("mail_L1"));
  const approved = await svc.approve("mail_L1", { detail: "customer approved" });
  eq("approve → APPROVED (user actor)", [approved.status, approved.auditTrail.find((e) => e.toStatus === "APPROVED")?.actor], ["APPROVED", "user"]);
  await throws("queue before payment throws", () => svc.queueForProvider("mail_L1"));

  await svc.markPaid("mail_L1", "authorized:no-charge");
  const queued = await svc.queueForProvider("mail_L1");
  eq("queueForProvider → QUEUED and STOPS", queued.status, "QUEUED");

  // THE KEY GUARANTEE: no provider stage is ever reached without live dispatch.
  ok("no provider job id (no provider contacted)", queued.providerJobId === null);
  ok("never advanced past QUEUED", !queued.auditTrail.some((e) => ["PDF_GENERATED","PROVIDER_ACCEPTED","PRINTED","CARRIER_ACCEPTED","DELIVERED"].includes(e.toStatus ?? "")));
  ok("QUEUED can still forward-progress later (dispatch path intact)", canTransition("QUEUED", "PDF_GENERATED"));
  // identity preserved (pages carried from spec)
  eq("print spec persisted (pages=2)", [queued.pages, queued.doubleSided], [2, true]);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
