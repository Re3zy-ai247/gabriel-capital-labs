// Guards for CreditVector Mail (Sprint VIII). Pure logic only — no DB, no
// network (LetterStream runs dry-run). Run: npx tsx scripts/mail.test.ts
import { canTransition, nextStatuses, isTerminal, pipelineIndex, MAIL_PIPELINE, type MailStatus } from "../lib/mail/MailStatus";
import { computePrice, DEFAULT_PRICING_POLICY } from "../lib/mail/MailPricing";
import { appendAudit, validateAuditTrail } from "../lib/mail/MailAudit";
import { normalizeTracking } from "../lib/mail/MailTracking";
import { getMailProvider, listProviderIds, isProviderId } from "../lib/mail/providers";
import { MailProviderError } from "../lib/mail/MailProvider";
import { MailService, MailApprovalError } from "../lib/mail/MailService";
import { InMemoryMailStore } from "../lib/mail/MailStore";
import { LetterStreamProvider, mapLetterStreamStatus } from "../lib/mail/providers/LetterStreamProvider";

let failures = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}
function eq(label: string, got: unknown, want: unknown) {
  ok(`${label} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want));
}
async function throws(label: string, fn: () => Promise<unknown>, name?: string) {
  try { await fn(); failures++; console.error(`✗ ${label} (did not throw)`); }
  catch (e) { ok(label, !name || (e as Error).name === name || e instanceof MailProviderError); }
}

// ---- state machine ----
eq("pipeline order intact", MAIL_PIPELINE[0] + "→" + MAIL_PIPELINE[MAIL_PIPELINE.length - 1], "GENERATED→CLOSED");
ok("legal forward transition", canTransition("PAID", "QUEUED"));
ok("illegal skip rejected", !canTransition("APPROVED", "PRINTED"));
ok("FAILED reachable from active", nextStatuses("PRINTED").includes("FAILED"));
ok("CANCELED not offered after PRINTED", !nextStatuses("PRINTED").includes("CANCELED"));
ok("CANCELED offered pre-print", nextStatuses("QUEUED").includes("CANCELED"));
ok("carrier stage is provider-neutral (no USPS in enum)", canTransition("PRINTED", "CARRIER_ACCEPTED"));
ok("terminal has no exits", nextStatuses("CLOSED").length === 0 && isTerminal("CLOSED"));
ok("no self-transition", !canTransition("PAID", "PAID"));
ok("delivered may return", canTransition("DELIVERED", "RETURNED"));

// ---- pricing (composed, floored, order of ops) ----
const est = { providerCostCents: 100, currency: "USD" as const, breakdown: [] };
const base = computePrice({ estimate: est, plan: "free", isAgency: false });
// 100 provider + 99 fee + 15 markup(15%) = 214, no discount
eq("free plan total", base.totalCents, 214);
// RC1-S6a (Founder D-3, review M-3): the PLAN discount is neutralized — this
// used to assert 193 (a legacy Professional quoted 10% under a free consumer,
// with a literal "Premium discount" line on the send page). A plan must never
// buy a consumer a cheaper mailing, so the pin is now PARITY.
const prem = computePrice({ estimate: est, plan: "premium", isAgency: false });
eq("a legacy Professional is quoted exactly what a free consumer is quoted", prem.totalCents, 214);
ok("no plan discount is applied to anyone", prem.discountCents === 0 && base.discountCents === 0);
ok("no discount line item can render", !prem.lines.some((l) => /discount/i.test(l.label)));
// RC1-S11 (finding C-1): the agency markup does NOT stay. This asserted 204 —
// a 5% markup where a free consumer pays 15% — on the reasoning that it was a
// B2B cost input. It is not: /api/mail/prepare is the CONSUMER self-serve flow,
// and an Agency owner mailing their own dispute letter is a consumer of it, so
// the rate priced an account type rather than a wholesale channel. Parity now,
// at the CONSUMER's pre-existing rate, so no consumer's quote moved.
const agency = computePrice({ estimate: est, plan: "agency", isAgency: true });
eq("an agency account is quoted exactly what a free consumer is quoted", agency.totalCents, 214);
ok("no account type changes the markup", agency.markupCents === base.markupCents);
ok("the platform policy configures no reseller markup", DEFAULT_PRICING_POLICY.agencyMarkupRate == null);
ok("…but the engine still honours one when a policy supplies it",
  computePrice({ estimate: est, plan: "free", isAgency: true,
    policy: { ...DEFAULT_PRICING_POLICY, agencyMarkupRate: 0.05 } }).markupCents === 5);
// The ENGINE is intact — an explicitly supplied (e.g. white-label) policy can
// still express a discount; only the platform default carries none.
ok("the pricing engine still honours an explicitly supplied policy",
  computePrice({ estimate: est, plan: "premium", isAgency: false,
    policy: { ...DEFAULT_PRICING_POLICY, planDiscountRate: { premium: 0.5 } } }).discountCents > 0);
const coup = computePrice({ estimate: est, plan: "free", isAgency: false, coupon: { code: "HALF", kind: "percent", value: 0.5 } });
// 214 → coupon 50% of 214 = 107 → 107
eq("coupon after discount", coup.totalCents, 107);
const floored = computePrice({ estimate: est, plan: "free", isAgency: false, coupon: { code: "BIG", kind: "amount", value: 999999 } });
ok("total floors at 0", floored.totalCents === 0);
ok("provider cost never inflated by us in its own line", base.providerCostCents === 100);

// ---- audit trail (append-only, well-formed) ----
let trail = appendAudit([], { at: "2026-01-01T00:00:00Z", actor: "system", event: "a" });
trail = appendAudit(trail, { at: "2026-01-02T00:00:00Z", actor: "user", event: "b" });
eq("seq assigned monotonically", trail.map((e) => e.seq), [0, 1]);
ok("valid trail passes", validateAuditTrail(trail) === null);
ok("backwards time detected", validateAuditTrail([...trail, { seq: 2, at: "2020-01-01T00:00:00Z", actor: "system", event: "c" }]) !== null);

// ---- tracking normalization ----
const norm = normalizeTracking({
  status: { status: "IN_TRANSIT", raw: "in-transit" },
  milestones: [
    { status: "PROVIDER_ACCEPTED", raw: "received", at: "2026-01-01T00:00:00Z" },
    { status: "PRINTED", raw: "printed", at: "2026-01-02T00:00:00Z" },
    { status: "PROVIDER_ACCEPTED", raw: "received", at: "2026-01-03T00:00:00Z" }, // dup, later
  ],
});
eq("dedup keeps earliest + orders by pipeline", norm.milestones.map((m) => m.status), ["PROVIDER_ACCEPTED", "PRINTED", "IN_TRANSIT"]);
eq("current = furthest", norm.currentStatus, "IN_TRANSIT");

// ---- provider registry (single-config switch, provider-neutral) ----
ok("default provider is letterstream", getMailProvider().id === "letterstream");
ok("all 5 providers registered", listProviderIds().length === 5);
ok("unknown env id is not a provider id", !isProviderId("carrierpigeon"));
eq("LetterStream status mapping", mapLetterStreamStatus("Delivered"), "DELIVERED");
eq("unknown provider status → safe default", mapLetterStreamStatus("???"), "PROVIDER_ACCEPTED");

// ---- LetterStream dry-run (no network) ----
const ls = new LetterStreamProvider();
(async () => {
  const addr = { name: "Equifax", line1: "P.O. Box 740256", city: "Atlanta", state: "GA", zip: "30374" };
  const v = await ls.validateAddress(addr);
  ok("dry-run address validates structurally", v.valid === true);
  const bad = await ls.validateAddress({ ...addr, state: "Georgia", zip: "abc" });
  ok("bad address caught", bad.valid === false && bad.issues.length === 2);
  const c = await ls.estimateCost({ pages: 3, color: false, doubleSided: true, mailClass: "first_class", certified: true });
  ok("cost estimate positive + includes certified", c.providerCostCents > 495);

  // ---- end-to-end pipeline: the approval gate + immutability ----
  // Spy provider records the spec it actually receives, to prove the piece
  // dispatched matches the multi-page spec that was priced (not a hardcoded 1pp).
  let dispatchedSpec: unknown = null;
  const spy = new LetterStreamProvider();
  const origCreate = spy.createMailJob.bind(spy);
  spy.createMailJob = async (input) => { dispatchedSpec = input.spec; return origCreate(input); };

  const store = new InMemoryMailStore();
  let t = 0;
  const svc = new MailService({ store, provider: spy, now: () => `2026-03-01T00:00:0${t++}.000Z`, sink: async () => {} });
  const realSpec = { pages: 3, color: true, doubleSided: false, mailClass: "first_class" as const, certified: true };
  const priced = await svc.estimate({ spec: realSpec, plan: "premium", isAgency: false });
  const m0 = await svc.initiate({
    mailId: "mail_1", letterId: "ltr_1", userId: "u1", tradelineId: "tl_1",
    recipient: addr, spec: realSpec, cost: priced.price,
  });
  eq("initiate lands in IN_REVIEW", m0.status, "IN_REVIEW");
  eq("print spec persisted on the manifest", [m0.pages, m0.color, m0.doubleSided], [3, true, false]);

  // THE GATE: cannot dispatch before approval + payment.
  await throws("dispatch before approval throws", () => svc.dispatch("mail_1", { kind: "url", url: "https://x/y.pdf" }, addr), "MailApprovalError");
  await throws("payment before approval throws", () => svc.markPaid("mail_1", "pi_1"), "MailApprovalError");

  const approved = await svc.approve("mail_1");
  eq("user approval recorded by user actor", approved.auditTrail.find((e) => e.toStatus === "APPROVED")?.actor, "user");
  await svc.markPaid("mail_1", "pi_123");
  const sent = await svc.dispatch("mail_1", { kind: "url", url: "https://x/y.pdf" }, addr);
  eq("dispatch reaches PROVIDER_ACCEPTED", sent.status, "PROVIDER_ACCEPTED");
  ok("provider job id captured", sent.providerJobId === "ls_dry_mail_1");
  ok("audit trail is append-only + well-formed", validateAuditTrail(sent.auditTrail) === null && sent.auditTrail.length >= 6);

  // Identity immutability: provider/letterId/userId/cost never change across transitions.
  eq("identity preserved through pipeline", [sent.letterId, sent.userId, sent.provider, sent.cost.totalCents], ["ltr_1", "u1", "letterstream", m0.cost.totalCents]);

  // Kai cannot approve: initiate used actor 'kai' only to move to IN_REVIEW; the
  // APPROVED transition is always actor 'user'. Confirm no 'kai' actor ever set APPROVED/PAID.
  ok("no kai actor on approve/pay/send", !sent.auditTrail.some((e) => e.actor === "kai" && (e.toStatus === "APPROVED" || e.toStatus === "PAID" || e.toStatus === "PROVIDER_ACCEPTED")));

  // The dispatched piece matches the multi-page spec that was priced — NOT a
  // fabricated 1-page B/W literal (the HIGH bug the review caught).
  eq("dispatched spec = priced spec (pages/color/sides)", dispatchedSpec, { pages: 3, color: true, doubleSided: false, mailClass: "first_class", certified: true });

  // Append-only is enforced BY THE STORE, not just by convention: replaying a
  // rewritten trail is rejected.
  const tampered = { ...sent, auditTrail: sent.auditTrail.slice(0, 2).concat([{ ...sent.auditTrail[2], event: "FORGED" }]) };
  await throws("store rejects a rewritten audit trail", () => store.saveProgress(tampered as typeof sent), "MailAuditError");
  const truncated = { ...sent, auditTrail: sent.auditTrail.slice(0, 1) };
  await throws("store rejects a truncated audit trail", () => store.saveProgress(truncated as typeof sent), "MailAuditError");

  // Live mode is gated off — a live createMailJob refuses rather than silently no-op.
  process.env.MAIL_LIVE = "true";
  const liveLs = new LetterStreamProvider();
  await throws("live createMailJob not wired", () => liveLs.createMailJob({ mailId: "x", pdf: { kind: "url", url: "u" }, to: addr, from: addr, spec: { pages: 1, color: false, doubleSided: true, mailClass: "first_class", certified: false } }), "MailProviderError");
  delete process.env.MAIL_LIVE;

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
