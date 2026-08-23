// Server-side session gate for the dispute-letter rooms (RC1 S2 — P0-5 / A1-01).
//
// app/letters/page.tsx is "use client" and had NO server guard: an expired
// session loaded the page, every /api/letters fetch answered 401, and the
// consumer was shown a letter workspace with nothing in it. The printable view
// under /letters/print is covered by the same gate.
//
// Shape follows this repo's two existing segment gates — app/admin/layout.tsx
// and app/scores/layout.tsx (slice S9) — including force-dynamic, so the gate
// can never be answered from a static cache.
import type { ReactNode } from "react";
import { requireUser } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

export default async function LettersLayout({ children }: { children: ReactNode }) {
  await requireUser("/letters");
  return children;
}
