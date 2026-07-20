import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

// Cookie holding the client an agency currently has "open". Read by currentUser()
// so every existing page/route operates inside that client's workspace.
export const WORKSPACE_COOKIE = "gcl_client";

// Cookie holding the user an ADMIN is currently impersonating ("view as"). Only
// honored when the real signed-in account is an ADMIN. currentAccount() stays the
// real admin (so admin controls remain accessible); only the data subject flips.
export const IMPERSONATE_COOKIE = "gcl_impersonate";

// The actual signed-in account — NEVER the workspace client. Use this for
// agency management and billing, where the agency (the payer) is the subject.
export async function currentAccount() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const account = await prisma.user.findUnique({ where: { id } });

  // `disabled` was enforced ONLY at sign-in (lib/auth.ts). Sessions are stateless
  // JWTs, so an account disabled AFTER sign-in kept full access until its token
  // expired naturally — admin suspension, security lock and agency removal all
  // took effect only for users who happened to be signed out. Re-checking here
  // evicts them from every authenticated surface at once, because every gate in
  // the app resolves through currentAccount(). This costs no extra query: the row
  // is already loaded. Fail-closed — a disabled account reads as no account.
  if (account?.disabled) return null;

  return account;
}

// The effective user for data operations. For an ordinary user this is just
// themselves. For an AGENCY that has opened a client, it resolves to that client
// — but only after verifying the client is actually managed by this agency, so
// an agency can never act as someone else's client.
export async function currentUser() {
  const account = await currentAccount();
  if (!account) return null;

  // Admin impersonation takes precedence: a real ADMIN "viewing as" another user
  // sees that user's data everywhere currentUser() is used.
  if (account.role === "ADMIN") {
    const impId = cookies().get(IMPERSONATE_COOKIE)?.value;
    if (impId && impId !== account.id) {
      const target = await prisma.user.findUnique({ where: { id: impId } });
      if (target) return target;
    }
  }

  if (account.isAgency) {
    const clientId = cookies().get(WORKSPACE_COOKIE)?.value;
    if (clientId) {
      const client = await prisma.user.findFirst({
        where: { id: clientId, managedByAgencyId: account.id },
      });
      if (client) return client;
    }
  }
  return account;
}

// Dev convenience: fall back to the seeded demo user so the app is explorable
// without configuring auth. Disabled automatically in production.
export async function currentUserOrDemo() {
  const u = await currentUser();
  if (u) return u;
  if (process.env.NODE_ENV === "production") return null;
  return prisma.user.findUnique({ where: { email: "demo@gabrielcapitallabs.com" } });
}

// If a real ADMIN is currently impersonating someone, returns { real, target };
// otherwise null. Used by the app shell to render the impersonation banner.
export async function impersonationContext() {
  const account = await currentAccount();
  if (!account || account.role !== "ADMIN") return null;
  const impId = cookies().get(IMPERSONATE_COOKIE)?.value;
  if (!impId || impId === account.id) return null;
  const target = await prisma.user.findUnique({ where: { id: impId } });
  if (!target) return null;
  return { real: account, target };
}

// Convenience for UI: who is signed in, and which client (if any) they're acting
// as right now. Used by the app shell to show the "acting as" banner.
export async function currentWorkspace() {
  const account = await currentAccount();
  if (!account) return { account: null, client: null };
  if (!account.isAgency) return { account, client: null };
  const clientId = cookies().get(WORKSPACE_COOKIE)?.value;
  if (!clientId) return { account, client: null };
  const client = await prisma.user.findFirst({
    where: { id: clientId, managedByAgencyId: account.id },
  });
  return { account, client: client ?? null };
}
