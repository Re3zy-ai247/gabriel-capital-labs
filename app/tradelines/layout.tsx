// Server-side session gate for /tradelines (S2 requirement, folded into S4 as
// the sole owner of this route).
//
// Without it the page rendered for a signed-out visitor as an empty-but-
// functional-looking analysis screen: `currentUserOrDemo()` returns null in
// production, the tradeline query is skipped, and the consumer sees zeros with
// no indication that they are simply not signed in.
//
// Same shape as app/scores/layout.tsx and app/admin/layout.tsx — resolve,
// redirect when absent, force-dynamic so the gate can never be statically
// cached. The page itself keeps its own null-user handling; this is the gate.
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TradelinesLayout({ children }: { children: ReactNode }) {
  const user = await currentUserOrDemo();
  if (!user) redirect("/login?callbackUrl=/tradelines");
  return children;
}
