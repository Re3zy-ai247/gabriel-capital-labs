// Kernel host — Identity (Sprint 2, migration #1). Maps a signed-in session user to the
// kernel Actor. `tenantId` is the DATA-OWNING scope — a consumer's own id, or (for an
// agency working a client) the client's id, which is exactly the id the existing queries
// already scope by (`where userId`). Trust is first_party (our own application code).
import type { Actor } from "@/lib/os/kernel";

export function actorFromSession(user: { id: string }, dataOwnerId?: string): Actor {
  return { id: user.id, tenantId: dataOwnerId ?? user.id, trust: "first_party" };
}
