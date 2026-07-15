// Kernel host — the application Kernel (Sprint 2, migration #3 Registry wiring). Constructs
// the Kernel and registers the first-party plugins. Increment 1 uses the reference in-memory
// adapters for Audit/Event/Memory — the DURABLE Postgres adapters are subsystems #11/#12
// (R8: don't build persistence infra before a subsystem needs it). Registration is static.
import { Kernel, inMemoryAudit, inMemoryEventLog, inMemoryMemory, memoryClock, type KernelPorts } from "@/lib/os/kernel";
import { creditModule } from "@/lib/os/modules/credit";

export function appKernel(ports?: Partial<KernelPorts>): Kernel {
  const k = new Kernel({
    clock: ports?.clock ?? memoryClock(0, new Date(0).toISOString()),
    audit: ports?.audit ?? inMemoryAudit(),
    events: ports?.events ?? inMemoryEventLog(),
    memory: ports?.memory ?? inMemoryMemory(),
    idempotency: ports?.idempotency,
  });
  // Plugin #1 — CreditVector. Future modules register here, same contract, no special case.
  k.register(creditModule());
  return k;
}
