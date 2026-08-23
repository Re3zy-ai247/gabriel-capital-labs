// Run: npx tsx scripts/bootstrap-security.test.ts
//
// Launch guard for two legacy bootstrap hazards: a deployable shared demo
// credential and promotion of a public account that preclaimed ADMIN_EMAIL.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { isDemoIdentityBlocked } from "../lib/demoIdentity";
import { seedAdminUser } from "../lib/demoSeed";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

type FakeUser = { id: string; email: string; role: "USER" | "ADMIN"; passwordHash: string };

function fakePrisma(initial?: FakeUser) {
  let user = initial;
  let updates = 0;
  let creates = 0;
  const client = {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        user?.email === where.email ? user : null,
      update: async ({ where, data }: { where: { id: string }; data: { passwordHash: string } }) => {
        if (!user || user.id !== where.id) throw new Error("missing fake user");
        updates++;
        user = { ...user, ...data };
        return user;
      },
      create: async ({ data }: { data: Omit<FakeUser, "id"> & { name: string } }) => {
        creates++;
        user = { id: "created-admin", email: data.email, role: data.role, passwordHash: data.passwordHash };
        return user;
      },
    },
  };
  return {
    client: client as unknown as PrismaClient,
    state: () => ({ user, updates, creates }),
  };
}

async function main() {
  check(
    "known demo identity is blocked in production",
    isDemoIdentityBlocked("production", "DEMO@gabrielcapitallabs.com"),
  );
  check(
    "known demo identity is blocked in test",
    isDemoIdentityBlocked("test", "demo@gabrielcapitallabs.com"),
  );
  check(
    "known demo identity is blocked when runtime mode is absent",
    isDemoIdentityBlocked(undefined, "demo@gabrielcapitallabs.com"),
  );
  check(
    "demo identity remains available to isolated local review",
    !isDemoIdentityBlocked("development", "demo@gabrielcapitallabs.com"),
  );

  const preclaimed = fakePrisma({
    id: "attacker",
    email: "admin@gabrielcapitallabs.com",
    role: "USER",
    passwordHash: "attacker-hash",
  });
  let refused = false;
  try {
    await seedAdminUser(preclaimed.client, "ADMIN@gabrielcapitallabs.com", "ValidAdmin1!");
  } catch {
    refused = true;
  }
  check("preclaimed non-admin email is refused", refused);
  check("preclaimed account is not updated", preclaimed.state().updates === 0);
  check("preclaimed account is not promoted", preclaimed.state().user?.role === "USER");

  const existingAdmin = fakePrisma({
    id: "admin",
    email: "admin@gabrielcapitallabs.com",
    role: "ADMIN",
    passwordHash: "old-hash",
  });
  await seedAdminUser(existingAdmin.client, "admin@gabrielcapitallabs.com", "ValidAdmin1!");
  check("existing admin password can rotate", existingAdmin.state().updates === 1);
  check("existing admin is not recreated", existingAdmin.state().creates === 0);

  const empty = fakePrisma();
  await seedAdminUser(empty.client, "Admin@GabrielCapitalLabs.com", "ValidAdmin1!");
  check("missing admin is created once", empty.state().creates === 1);
  check("created admin email is normalized", empty.state().user?.email === "admin@gabrielcapitallabs.com");
  check("created account has admin role", empty.state().user?.role === "ADMIN");

  const root = join(__dirname, "..");
  const route = readFileSync(join(root, "app/api/admin/bootstrap/route.ts"), "utf8");
  const developmentGuard = route.indexOf('process.env.NODE_ENV !== "development"');
  const secretRead = route.indexOf("process.env.SETUP_SECRET");
  const seedCall = route.indexOf("seedDemoUser(prisma)");
  check("bootstrap has a positive-development-only 404 guard", developmentGuard !== -1 && /status: 404/.test(route));
  check(
    "development guard runs before secret handling and demo seeding",
    developmentGuard < secretRead && developmentGuard < seedCall,
  );

  const demoSeedRoute = readFileSync(join(root, "app/api/demo/seed/route.ts"), "utf8");
  const session = readFileSync(join(root, "lib/session.ts"), "utf8");
  const auth = readFileSync(join(root, "lib/auth.ts"), "utf8");
  const admin = readFileSync(join(root, "lib/admin.ts"), "utf8");
  check("unauthenticated demo seed is development-only", /NODE_ENV !== "development"/.test(demoSeedRoute));
  check("demo fallback is development-only", /NODE_ENV !== "development"/.test(session));
  check("credentials auth rejects the blocked demo identity", /isDemoIdentityBlocked\(process\.env\.NODE_ENV, user\.email\)/.test(auth));
  const currentAccount = session.match(/export async function currentAccount\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  check(
    "currentAccount rechecks the canonical demo identity for existing JWTs",
    /isDemoIdentityBlocked\(process\.env\.NODE_ENV, account\?\.email\)/.test(currentAccount),
  );
  check(
    "currentAccount blocks the demo identity before returning the account",
    currentAccount.indexOf("isDemoIdentityBlocked") !== -1 &&
      currentAccount.indexOf("isDemoIdentityBlocked") < currentAccount.lastIndexOf("return account;"),
  );
  const sessionAccountState = session.match(/export async function sessionAccountState\([^)]*\): Promise<SessionAccountState> \{[\s\S]*?\n\}/)?.[0] ?? "";
  check(
    "sessionAccountState rejects a pre-issued canonical demo principal",
    /isDemoIdentityBlocked\(process\.env\.NODE_ENV, account\.email\)/.test(sessionAccountState),
  );
  check(
    "sessionAccountState treats the blocked demo principal as anonymous",
    /isDemoIdentityBlocked[\s\S]{0,180}state: "anonymous", account: null/.test(sessionAccountState),
  );
  const requireAdmin = admin.match(/export async function requireAdmin\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  check(
    "requireAdmin rejects the canonical demo identity outside development",
    /isDemoIdentityBlocked\(process\.env\.NODE_ENV, user\.email\)/.test(requireAdmin),
  );
  check(
    "requireAdmin applies disabled and demo gates before returning the principal",
    requireAdmin.indexOf("if (user.disabled) return null;") !== -1 &&
      requireAdmin.indexOf("isDemoIdentityBlocked") !== -1 &&
      requireAdmin.indexOf("isDemoIdentityBlocked") < requireAdmin.lastIndexOf("return user;"),
  );

  console.log(`\nbootstrap-security.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();
