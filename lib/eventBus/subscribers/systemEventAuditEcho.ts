// Reference subscriber — SYSTEM_EVENT audit echo (Sprint 8).
//
// The minimal example of a consumer: it subscribes to SYSTEM_EVENT and echoes a
// structured line on the app's existing console path. It performs NO outward effect and
// touches NO business table — it exists to demonstrate the subscribe/deliver contract
// and to give operators a visible trail of platform system events without polling a
// business table. Idempotent by construction (logging the same event twice is harmless).
import type { EventHandler } from "../registry";

export const systemEventAuditEcho: EventHandler = (event) => {
  if (event.type !== "SYSTEM_EVENT") return;
  const kind = (event.payload as { kind?: string }).kind ?? "unknown";
  console.info(`eventBus[audit-echo] SYSTEM_EVENT kind=${kind} tenant=${event.tenantId} corr=${event.correlationId} id=${event.id}`);
};
