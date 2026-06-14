import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight "who am I / am I acting as a client" probe for the UI shell.
export async function GET() {
  const { account, client } = await currentWorkspace();
  if (!account) return NextResponse.json({ signedIn: false, isAgency: false, client: null });
  return NextResponse.json({
    signedIn: true,
    isAgency: account.isAgency,
    isAdmin: account.role === "ADMIN",
    agencyName: account.agencyName,
    client: client ? { id: client.id, name: client.fullName || client.name } : null,
  });
}
