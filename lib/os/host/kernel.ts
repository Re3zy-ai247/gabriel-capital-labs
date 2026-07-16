// Kernel host — the application Kernel (Sprint 2, migration #3 Registry wiring). Constructs
// the Kernel and registers the first-party plugins. Increment 1 uses the reference in-memory
// adapters for Audit/Event/Memory — the DURABLE Postgres adapters are subsystems #11/#12
// (R8: don't build persistence infra before a subsystem needs it). Registration is static.
import { Kernel, inMemoryAudit, inMemoryEventLog, inMemoryMemory, memoryClock, type KernelPorts } from "@/lib/os/kernel";
import { creditModule } from "@/lib/os/modules/credit";
import { notifyModule } from "@/lib/os/modules/notify";

function registerModules(k: Kernel): Kernel {
  // Plugin #1 — CreditVector. Future modules register here, same contract, no special case.
  k.register(creditModule());
  // Platform module (Migration #10) — GIOS-generic notification DECISION (Layer 2). Not an app
  // plugin: any application on GIOS inherits it. Decision only; the Layer-3 send is not built.
  k.register(notifyModule());
  return k;
}

export function appKernel(ports?: Partial<KernelPorts>): Kernel {
  return registerModules(new Kernel({
    clock: ports?.clock ?? memoryClock(0, new Date(0).toISOString()),
    audit: ports?.audit ?? inMemoryAudit(),
    events: ports?.events ?? inMemoryEventLog(),
    memory: ports?.memory ?? inMemoryMemory(),
    idempotency: ports?.idempotency,
  }));
}

export function kernelDurableEnabled(): boolean {
  return process.env.KERNEL_DURABLE === "true";
}

// KERNEL_DURABLE path (ADR-0028; migration #11). Async because the version authority reserves a
// SEQUENCE block up front. DORMANT by default — the kernel has no production caller, KERNEL_DURABLE
// defaults OFF, and this requires a DB (prod-validated before enable, ADR-0028 §5). The in-mem
// `appKernel()` above is the default and is byte-identical at the module boundary. MemoryStore stays
// in-mem here (durable memory is #12, not #11). Durable adapters are dynamically imported so the
// default path never pulls in prisma.
export async function appKernelDurable(): Promise<Kernel> {
  const { durableAudit, durableEventLog, durableIdempotency, reserveDurableClock } = await import("./durable");
  return registerModules(new Kernel({
    clock: await reserveDurableClock(),
    audit: durableAudit(),
    events: durableEventLog(),
    memory: inMemoryMemory(),
    idempotency: durableIdempotency(),
  }));
}
