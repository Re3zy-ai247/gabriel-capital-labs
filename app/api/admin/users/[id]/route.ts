import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, username: true, name: true, role: true, plan: true,
      isAgency: true, agencyName: true, disabled: true, subscriptionStatus: true,
      stripeCustomerId: true, currentPeriodEnd: true, createdAt: true,
      _count: { select: { letters: true, reports: true, tradelines: true, managedClients: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// PATCH: role | plan (comp/grant) | isAgency | disabled. Each provided field is
// validated and audited. Guards prevent an admin from locking themselves out.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const changes: string[] = [];
  const isSelf = target.id === admin.id;

  if (typeof body.role === "string" && ["USER", "ADMIN"].includes(body.role) && body.role !== target.role) {
    if (isSelf && body.role !== "ADMIN") {
      return NextResponse.json({ error: "You can't remove your own admin role." }, { status: 400 });
    }
    data.role = body.role;
    changes.push(`role ${target.role}→${body.role}`);
  }

  if (typeof body.disabled === "boolean" && body.disabled !== target.disabled) {
    if (isSelf && body.disabled) {
      return NextResponse.json({ error: "You can't disable your own account." }, { status: 400 });
    }
    data.disabled = body.disabled;
    changes.push(body.disabled ? "disabled account" : "re-enabled account");
  }

  if (typeof body.plan === "string" && ["free", "premium", "agency"].includes(body.plan) && body.plan !== target.plan) {
    data.plan = body.plan;
    // Comping a plan grants the entitlement directly (no Stripe subscription).
    if (body.plan === "agency") data.isAgency = true;
    if (body.plan === "free") data.isAgency = false;
    changes.push(`plan ${target.plan}→${body.plan} (comped)`);
  }

  if (typeof body.isAgency === "boolean" && body.isAgency !== target.isAgency && data.isAgency === undefined) {
    data.isAgency = body.isAgency;
    changes.push(body.isAgency ? "granted agency" : "revoked agency");
  }

  if (changes.length === 0) {
    return NextResponse.json({ error: "No supported changes provided." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data,
    select: { id: true, role: true, plan: true, isAgency: true, disabled: true },
  });

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "user.update",
    summary: `Updated ${target.email}: ${changes.join(", ")}`,
    targetType: "user",
    targetId: target.id,
    metadata: { changes },
  });

  return NextResponse.json({ user: updated });
}
