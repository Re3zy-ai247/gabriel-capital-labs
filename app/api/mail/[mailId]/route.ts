import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { MailService } from "@/lib/mail";

export const dynamic = "force-dynamic";

// Fetch one manifest (ownership-checked) — the receipt / status view.
export async function GET(_req: Request, { params }: { params: { mailId: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = await new MailService().getManifest(params.mailId);
  if (!m || m.userId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ manifest: m });
}
