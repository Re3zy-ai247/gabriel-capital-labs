import { currentAccount } from "@/lib/session";

// Gallery access law: open in dev and on preview deployments (Vercel deployment
// SSO already protects previews); ADMIN-only in production — the language is
// unratified and members must not encounter it. Fail-closed in production.
export async function gxlGalleryAllowed(): Promise<boolean> {
  if (process.env.VERCEL_ENV !== "production") return true;
  try {
    const a = await currentAccount();
    return a?.role === "ADMIN";
  } catch {
    return false;
  }
}
