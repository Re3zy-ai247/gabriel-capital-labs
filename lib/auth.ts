import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";
import { isDemoIdentityBlocked } from "./demoIdentity";
import {
  createPasswordSessionVersion,
  isPasswordSessionVersion,
  validatePasswordSessionToken,
  type SessionCredentialStateLoader,
} from "./sessionVersion";

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

// JWT sessions are revalidated against the current password credential on every
// server-side session read. This central callback also covers the few routes that
// call getServerSession() directly instead of going through currentAccount().
const loadSessionCredentialState: SessionCredentialStateLoader = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, disabled: true, email: true },
  });
  if (!user) return null;
  return {
    passwordHash: user.passwordHash,
    disabled: user.disabled,
    identityBlocked: isDemoIdentityBlocked(process.env.NODE_ENV, user.email),
  };
};

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
        // identifier exists. (Since P0-10 the limiter FAILS CLOSED on a backend
        // fault — see lib/rateLimit.ts. Sign-in is unaffected in practice: the user
        // lookup three lines below needs the same database, so a fault that denies
        // here would have denied there.)
        if (!byId.ok || !byIp.ok) return null;

        const user = await prisma.user.findFirst({
          where: { OR: [{ email: id }, { username: id }] },
        });
        if (!user?.passwordHash) return null;
        if (user.disabled) return null; // admin-disabled accounts cannot sign in
        // Demo data may survive a historic bootstrap. Its repository-known
        // credential must never create a session outside explicit development.
        if (isDemoIdentityBlocked(process.env.NODE_ENV, user.email)) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        const sessionVersion = createPasswordSessionVersion(
          user.id,
          user.passwordHash,
          process.env.NEXTAUTH_SECRET,
        );
        // Missing key/version evidence must not mint a JWT that can bypass later
        // revocation checks. NextAuth itself also requires this secret in prod.
        if (!sessionVersion) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined, sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      return validatePasswordSessionToken(
        token,
        user,
        process.env.NEXTAUTH_SECRET,
        loadSessionCredentialState,
      );
    },
    async session({ session, token }) {
      if (
        token.cancellationOnly === true ||
        !session.user ||
        typeof token.uid !== "string" ||
        token.uid.length === 0 ||
        !isPasswordSessionVersion(token.sessionVersion)
      ) {
        // NextAuth's session route forwards this return value verbatim, and its
        // React client classifies every truthy value as `authenticated`. Returning
        // `{ expires, user: undefined }` would therefore deny server authorization
        // but still report a stale JWT as authenticated to useSession(). Runtime
        // supports a null body; its public callback type omits null, so keep the
        // compatibility cast confined to this fail-closed return only.
        return null as unknown as typeof session;
      }
      session.user.id = token.uid;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
