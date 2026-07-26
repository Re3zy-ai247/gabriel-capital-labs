import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE: CONTAINED (Implementation Slice 0, Identity Constitution v1.0 §12.6, §19.1).
//
// This handler used to write an `AgencyClientDeletion` KPI row and then call
// `prisma.user.delete` on the managed client. Two constitutional defects made that
// unsafe, independent of any feature flag:
//
//  1. `User.managedByAgencyId` is `ON DELETE CASCADE` (prisma/schema.prisma:96), so the
//     delete destroyed the Consumer's entire case file — documents (encrypted government
//     IDs), reports, tradelines, letters and bureau responses, score history. §12.2 and
//     §16.5 forbid ending a service relationship by deleting the Consumer; §12.3 requires
//     erasure to be a named, subject-scoped command, never a cascade.
//  2. The KPI row was committed BEFORE the fallible delete and outside any transaction,
//     so the ledger could record a deletion that never happened (§12.6 item 6).
//
// Containment is unconditional and deliberately does NOT invent the replacement. Ending
// an agency's management relationship is a distinct command (§12.1) that must revoke
// agency access, supersede the relationship, preserve the Consumer, and write evidence
// atomically. It does not exist yet, so this route fails closed instead of approximating
// it. Detaching the Consumer here (nulling `managedByAgencyId`) would be an unevidenced
// termination — also forbidden.
//
// The authorization ladder below is unchanged on purpose. The lookup stays tenant-scoped
// (`managedByAgencyId: agency.id`), so a caller who does not manage this id gets the same
// 404 whether or not that Consumer exists — the route is not an existence oracle (§15.12).
//
// Permanent FK remediation is Implementation Slice 7; the governed termination workflow
// is required by Constitution §12.2 and §19.1. Do not restore a delete here.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  // Existence + tenancy check only. Only `id` is selected: nothing downstream needs the
  // Consumer's name, so the contained path reads no Consumer PII.
  const client = await prisma.user.findFirst({
    where: { id: params.id, managedByAgencyId: agency.id },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  // Fail closed. No deletion, no relationship mutation, no KPI/audit/evidence write, no
  // event. Deterministic: identical requests return this identical response and change
  // nothing.
  return NextResponse.json(
    {
      error:
        "Removing a client workspace is unavailable while a safer client-offboarding process is finalized. Nothing was changed and this client's records are intact. Contact support if you need to end management of this client.",
    },
    { status: 409 },
  );
}
