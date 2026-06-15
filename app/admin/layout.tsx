import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Server-side gate for the entire /admin area. Non-admins (and signed-out users)
// are redirected before any admin page renders. Each page also calls admin APIs
// that re-check on the server, so this is defense-in-depth, not the only guard.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  return <>{children}</>;
}
