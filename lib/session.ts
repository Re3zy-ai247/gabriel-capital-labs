import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

// Dev convenience: fall back to the seeded demo user so the app is explorable
// without configuring auth. Disabled automatically in production.
export async function currentUserOrDemo() {
  const u = await currentUser();
  if (u) return u;
  if (process.env.NODE_ENV === "production") return null;
  return prisma.user.findUnique({ where: { email: "demo@gabrielcapitallabs.com" } });
}
