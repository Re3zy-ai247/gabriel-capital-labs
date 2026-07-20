import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";

// NextAuth hands `authorize` a plain headers object, not a fetch Headers — so the
// shared clientIp(Request) helper does not apply here. Same precedence rule: the
// platform-set x-real-ip is not client-controllable; the leftmost x-forwarded-for
// hop IS attacker-supplied, so a spoofed header must not mint a fresh bucket.
function ipFromAuthHeaders(headers: Record<string, string> | undefined): string {
  const real = headers?.["x-real-ip"]?.trim();
  if (real) return real;
  const first = headers?.["x-forwarded-for"]?.split(",")[0]?.trim();
  return first || "unknown";
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        // Accept either an email or a username in the identifier field.
        const id = credentials.email.trim().toLowerCase();

        // Brute-force / credential-stuffing throttle. Every other sensitive path
        // (password reset, forgot-password, AI routes) was already throttled; the
        // actual sign-in was not, so an attacker could grind bcrypt against a known
        // identifier indefinitely. Two buckets: per-identifier stops a targeted
        // attack on one account, per-IP stops spraying many identifiers from one
        // source. Checked BEFORE the user lookup and before bcrypt.compare, so a
        // throttled attempt costs no query and no hashing.
        const ip = ipFromAuthHeaders(req?.headers as Record<string, string> | undefined);
        const [byId, byIp] = await Promise.all([
          rateLimit(`login-id:${id}`, 10, 900), // 10 per identifier / 15 min
          rateLimit(`login-ip:${ip}`, 30, 900), // 30 per source IP / 15 min
        ]);
        // Deny on limit. Returning null yields the same generic failure the wrong
        // -password path returns, so the throttle reveals nothing about whether the
        // identifier exists. (The limiter itself fails OPEN on a DB fault — the
        // established repo posture: a transient outage must not lock everyone out.)
        if (!byId.ok || !byIp.ok) return null;

        const user = await prisma.user.findFirst({
          where: { OR: [{ email: id }, { username: id }] },
        });
        if (!user?.passwordHash) return null;
        if (user.disabled) return null; // admin-disabled accounts cannot sign in
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = (user as { id: string }).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
