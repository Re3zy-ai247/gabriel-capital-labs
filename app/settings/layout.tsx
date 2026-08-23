// Server-side session gate for account settings (RC1 S2 — P0-5 / A1-01).
//
// app/settings/page.tsx is "use client" and had NO server guard, so an expired
// session rendered empty profile fields that look like erased personal details
// — and any save silently failed against a 401.
//
// Shape follows this repo's two existing segment gates — app/admin/layout.tsx
// and app/scores/layout.tsx (slice S9) — including force-dynamic, so the gate
// can never be answered from a static cache.
import type { ReactNode } from "react";
import { requireUser } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireUser("/settings");
  return children;
}
