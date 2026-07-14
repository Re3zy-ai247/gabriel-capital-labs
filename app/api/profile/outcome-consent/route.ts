import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { getOutcomeConsent, setOutcomeConsent } from "@/lib/outcomeConsent";

export const dynamic = "force-dynamic";

// Read/toggle the user's opt-in to contribute anonymized dispute outcomes to the
// Engine-1 corpus. Opt-in only, reversible any time. Never exposes anyone else's data.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ contribute: await getOutcomeConsent(user.id) });
}

export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const contribute = Boolean(body?.contribute);
  try {
    await setOutcomeConsent(user.id, contribute);
    return NextResponse.json({ contribute });
  } catch {
    return NextResponse.json({ error: "Couldn't save that preference — please try again." }, { status: 500 });
  }
}
