// Server-side session gate for report upload (RC1 S2 — P0-5 / A1-01).
//
// app/upload/page.tsx is "use client" and had NO server guard. An expired
// session saw "No reports uploaded yet" over a file the consumer had already
// uploaded, which reads as data loss on the one screen where they hand us their
// credit report.
//
// Shape follows this repo's two existing segment gates — app/admin/layout.tsx
// and app/scores/layout.tsx (slice S9) — including force-dynamic, so the gate
// can never be answered from a static cache.
import type { ReactNode } from "react";
import { requireUser } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

export default async function UploadLayout({ children }: { children: ReactNode }) {
  await requireUser("/upload");
  return children;
}
