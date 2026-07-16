// D-02 — GIOS kernel performance harness. MEASURES, never estimates. Instruments the kernel
// dispatch path externally (host-side wall clock — the kernel core stays pure, no Date.now inside).
// Measurable locally (in-memory path, no DB): warm dispatch latency (p50/p95/p99/max), write
// amplification (audit/event/version ops per dispatch), heap delta. NOT measurable here (honestly
// reported as prod-only, never fabricated): serverless COLD START and the durable-Postgres path —
// they require a real Vercel invocation + DB (KERNEL_DURABLE), per ADR-0028 §5 / D-02.
// Run: npx tsx scripts/perf-harness.ts
import { performance } from "perf_hooks";
import { Kernel, inMemoryMemory, memoryClock, type CapabilityKey, type KernelPorts, type AuditEntry, type KaiEvent, type Version } from "../lib/os/kernel";
import { creditModule } from "../lib/os/modules/credit";
import { notifyModule } from "../lib/os/modules/notify";
import { actorFromSession } from "../lib/os/host/identity";
import { entitlementSnapshot } from "../lib/os/host/entitlements";

const NOTIFY = "notify.plan.compose" as CapabilityKey;
const OBS = "credit.obsolescence.window" as CapabilityKey;
const actor = actorFromSession({ id: "u1" });
const ent = entitlementSnapshot({ premium: true });

const notifyInput = { channel: "email", purpose: "weekly_digest", commercial: true, tenantId: "u1", recipientRef: "jane@example.com", event: "digest:u1:2026-W29", content: { subject: "Your weekly Brief", text: "…" }, headers: { "List-Unsubscribe": "<x>", "List-Unsubscribe-Post": "One-Click" } };
const obsInput = { accountType: "COLLECTION" as const, creditorName: "Midland", text: "" };

// Instrumented ports that count the durable-write surface per dispatch (write amplification).
function counted() {
  let audits = 0, events = 0, versions = 0;
  const base = memoryClock();
  const ports: KernelPorts = {
    clock: { nextVersion: (): Version => { versions++; return base.nextVersion(); }, now: () => base.now() },
    audit: { append: (_e: AuditEntry) => { audits++; } },
    events: { append: (_e: KaiEvent) => { events++; } },
    memory: inMemoryMemory(),
  };
  const k = new Kernel(ports);
  k.register(creditModule());
  k.register(notifyModule());
  return { k, stats: () => ({ audits, events, versions }), reset: () => { audits = events = versions = 0; } };
}

function pct(sorted: number[], q: number): number { return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; }
const ms = (n: number) => n.toFixed(4);

async function measure(label: string, key: CapabilityKey, input: unknown, idempotencyKey?: () => string) {
  const { k, stats, reset } = counted();
  const WARM = 500, N = 5000;
  for (let i = 0; i < WARM; i++) await k.dispatch(actor, key, input, ent, key === NOTIFY ? "notification" : "obsolescence", idempotencyKey?.());
  reset();
  const heapBefore = process.memoryUsage().heapUsed;
  const samples: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    await k.dispatch(actor, key, input, ent, key === NOTIFY ? "notification" : "obsolescence", idempotencyKey?.());
    samples.push(performance.now() - t);
  }
  const heapAfter = process.memoryUsage().heapUsed;
  samples.sort((a, b) => a - b);
  const s = stats();
  console.log(`\n▶ ${label}  (N=${N} warm dispatches)`);
  console.log(`  latency ms  p50=${ms(pct(samples, 0.5))}  p95=${ms(pct(samples, 0.95))}  p99=${ms(pct(samples, 0.99))}  max=${ms(samples[samples.length - 1])}  min=${ms(samples[0])}`);
  console.log(`  write amplification / dispatch:  audit=${(s.audits / N).toFixed(2)}  event=${(s.events / N).toFixed(2)}  versionStamp=${(s.versions / N).toFixed(2)}`);
  console.log(`  heapUsed delta over N: ${((heapAfter - heapBefore) / 1024 / 1024).toFixed(2)} MB (no forced GC — indicative)`);
}

async function main() {
  console.log("GIOS kernel perf harness — MEASURED (in-memory path, warm). Node " + process.version);
  let n = 0;
  await measure("notify.plan.compose — keyless (pure decision, common path)", NOTIFY, notifyInput);
  await measure("notify.plan.compose — keyed (claim→execute→settle, in-mem 3-state)", NOTIFY, notifyInput, () => `perf:${n++}`);
  await measure("credit.obsolescence.window — keyless (deterministic wrap)", OBS, obsInput);
  console.log("\n── NOT measured here (prod-only; NOT fabricated) ──");
  console.log("  • serverless COLD START: requires a real Vercel invocation. Instrument via the");
  console.log("    x-cv-release header timing / a lambda init bracket in prod.");
  console.log("  • durable Postgres path (KERNEL_DURABLE on): requires a DB + Accelerate. Bracket");
  console.log("    each $executeRaw with a Date.now() delta (aiMeter pattern) and record latencyMs.");
  console.log("  • p95 BUDGET: set + enforce against these warm numbers before any live-route flip (D-02).");
}

main().then(() => process.exit(0));
