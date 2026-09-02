// Adopted from the p0 score-intelligence lane, commit 99ddf70 ("fix preview
// score tracker authentication path"), which added this file.
//
// REQUIRED ADAPTATION (RC1): the p0 version imported `currentScoreEntryUserId`
// from lib/session.ts — a function added by a rejected preview-auth commit that
// does not exist on this base and is outside this slice's owned paths. This
// uses the base's own `currentUserOrDemo()` instead (unchanged file, matches
// app/api/scores/route.ts and app/api/tradelines/route.ts).
//
// This is the fix for S-06 (A3 report): main has NO server-side gate on
// /scores — the client swallows a 401 into an empty-but-functional-looking
// tracker. app/admin/layout.tsx is the one existing precedent for a
// layout-level session gate in this repo; this mirrors its shape (resolve,
// redirect if absent, force-dynamic so the gate can never be statically
// cached).
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ScoresLayout({ children }: { children: ReactNode }) {
  const user = await currentUserOrDemo();
  if (!user) redirect("/login?callbackUrl=/scores");
  return children;
}
