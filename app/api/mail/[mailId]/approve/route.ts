import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { MailService } from "@/lib/mail";

export const dynamic = "force-dynamic";

// The customer's explicit approval. Kai never approves — this is the only path to
// APPROVED, and it requires the signed-in owner of the manifest.
export async function POST(_req: Request, { params }: { params: { mailId: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = new MailService();
  const m = await svc.getManifest(params.mailId);
  if (!m || m.userId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (m.status === "APPROVED" || m.status === "PAID" || m.status === "QUEUED") {
    return NextResponse.json({ manifest: m }); // already approved — idempotent
  }
  try {
    const updated = await svc.approve(params.mailId, { detail: "Customer approved mailing in the Approval Review." });
    return NextResponse.json({ manifest: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not approve." }, { status: 409 });
  }
}
