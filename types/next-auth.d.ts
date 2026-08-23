import "next-auth";
declare module "next-auth" {
  interface User {
    sessionVersion?: string;
  }
  interface Session {
    user?: { id?: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    sessionVersion?: string;
    cancellationOnly?: true;
  }
}
