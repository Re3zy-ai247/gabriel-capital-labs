import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

// Read consumer info for the settings form.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fullName, addressLine1, addressLine2, city, state, zip, email } = user;
  return NextResponse.json({ fullName, addressLine1, addressLine2, city, state, zip, email });
}

// Save consumer info required for mailable letters.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: b.fullName ?? user.fullName,
      addressLine1: b.addressLine1 ?? user.addressLine1,
      addressLine2: b.addressLine2 ?? user.addressLine2,
      city: b.city ?? user.city,
      state: b.state ?? user.state,
      zip: b.zip ?? user.zip,
    },
  });
  return NextResponse.json({ ok: true, user: { fullName: updated.fullName } });
}
