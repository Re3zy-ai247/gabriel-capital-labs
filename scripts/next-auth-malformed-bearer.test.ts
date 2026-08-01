// Run: npx tsx scripts/next-auth-malformed-bearer.test.ts
//
// Regression for GHSA-xmf8-cvqr-rfgj. next-auth <= 4.24.14 let malformed
// percent-encoding in an unauthenticated Bearer header escape getToken() as an
// exception. The landing-page middleware calls getToken() directly, so the
// vulnerable helper turned one invalid request into an unhandled edge failure.
//
// The patched contract is deliberately fail-downward: malformed bearer input
// is not a session, does not redirect, and does not throw.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { middleware } from "../middleware";

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

const root = join(__dirname, "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};
const packageLock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as {
  packages?: Record<string, { version?: string }>;
};

check(
  "package.json pins the first patched NextAuth 4.x release",
  packageJson.dependencies?.["next-auth"] === "4.24.15",
);
check(
  "package-lock resolves the patched NextAuth release",
  packageLock.packages?.["node_modules/next-auth"]?.version === "4.24.15",
);

async function main() {
  const malformedValues = ["%", "%ZZ", "%E0%A4%A"];

  for (const malformed of malformedValues) {
    const request = new NextRequest("https://creditvector.example/", {
      headers: { authorization: `Bearer ${malformed}` },
    });

    let token: unknown = Symbol("unresolved");
    let helperThrew = false;
    try {
      token = await getToken({
        req: request,
        secret: "regression-only-not-a-real-secret",
        raw: true,
      });
    } catch {
      helperThrew = true;
    }

    check(`getToken does not throw for Bearer ${malformed}`, helperThrew === false);
    check(`getToken rejects Bearer ${malformed} as no session`, token === null);

    let response: Awaited<ReturnType<typeof middleware>> | undefined;
    let middlewareThrew = false;
    try {
      response = await middleware(request);
    } catch {
      middlewareThrew = true;
    }

    check(`middleware does not throw for Bearer ${malformed}`, middlewareThrew === false);
    check(
      `middleware fails downward for Bearer ${malformed}`,
      response?.headers.get("x-middleware-next") === "1" &&
        response.headers.get("location") === null,
    );
  }

  console.log(`\nnext-auth-malformed-bearer.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();
