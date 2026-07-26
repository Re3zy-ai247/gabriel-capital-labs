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
//  1. Deleting the managed Consumer triggered the separate `userId` cascade FKs on case
//     data (documents, reports, tradelines, letters and score history). Independently,
//     the `User.managedByAgencyId` self-FK still cascades managed Consumers if the agency
//     principal is deleted (prisma/schema.prisma:95-97). §12.2 and §16.5 forbid ending a
//     service relationship by deleting the Consumer; §12.3 requires erasure to be a
//     named, subject-scoped command, never a cascade.
//  2. The KPI row was committed BEFORE the fallible delete and outside any transaction,
//     so the ledger could record a deletion that never happened (§12.6 item 6).
//
// Containment is unconditional and deliberately does NOT invent the replacement. Ending
// an agency's management relationship is a distinct command (§12.1) that must revoke
// agency access, supersede the relationship, preserve the Consumer, and write evidence
// transactionally or through a causally linked durable workflow. It does not exist yet,
// so this route fails closed instead of approximating it. Detaching the Consumer here
// (nulling `managedByAgencyId`) would be an unevidenced termination — also forbidden.
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

  // Existence + tenancy check only. The persistent id is still a personal identifier,
  // but no additional direct identity/profile fields are selected or returned.
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
        "Client offboarding is unavailable while a safer process is finalized. This request made no changes; no deletion or relationship termination was performed. Contact support to document your request and receive current next-step guidance.",
    },
    { status: 409 },
  );
}
