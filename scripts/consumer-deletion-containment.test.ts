// Guard for Implementation Slice 0 — Consumer deletion safety containment.
// Identity Constitution v1.0 §12.1-12.3, §12.6, §15.12, §16.5, §19.1.
//
// TEMPORARY global rule: no application path may hard-delete a User while the
// constitutional subject-erasure owner, evidence contract, retention/legal-hold policy,
// and persistence do not exist. The global rule may be narrowed only after the Slice 6
// evidence/retention contracts and Slice 7 subject-erasure persistence, receipts,
// migrations, and independent exit gate land. Any future allowlist must name only a
// constitutionally assigned data-subject erasure command under the owning domains;
// agency removal remains permanently barred.
//
// This guard is defense in depth, not a claim that source scanning proves all runtime
// behavior. It combines an AST-aware global hard-delete scan, durable adversarial
// fixtures, and execution of the real DELETE handler against fail-on-write dependencies.
// No database, network, production service, migration, or feature flag is touched.
//
// Run: npx tsx scripts/consumer-deletion-containment.test.ts
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import vm from "node:vm";
import ts from "typescript";

let pass = 0, fail = 0; const bad: string[] = [];
const ok = (label: string, condition: boolean) => {
  condition ? pass++ : (fail++, bad.push(`FAIL: ${label}`));
};
const read = (path: string) => readFileSync(path, "utf8");

const ROUTE = "app/api/agency/clients/[id]/route.ts";
const UI = "app/agency/page.tsx";
const routeText = read(ROUTE);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

type StaticFinding = { file: string; line: number; reason: string };

function analyzeUserHardDeletes(file: string, source: string): StaticFinding[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const stringValues = new Map<string, string>();
  const prismaRoots = new Set<string>();
  const userDelegates = new Set<string>();
  const findings: StaticFinding[] = [];
  const findingKeys = new Set<string>();

  const visit = (node: ts.Node, fn: (candidate: ts.Node) => void) => {
    fn(node);
    ts.forEachChild(node, (child) => visit(child, fn));
  };
  const unwrap = (input: ts.Expression): ts.Expression => {
    let node = input;
    while (
      ts.isParenthesizedExpression(node)
      || ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || ts.isSatisfiesExpression(node)
      || ts.isPartiallyEmittedExpression(node)
    ) node = node.expression;
    return node;
  };
  const staticString = (input: ts.Expression | undefined): string | undefined => {
    if (!input) return undefined;
    const node = unwrap(input);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) return stringValues.get(node.text);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticString(node.left);
      const right = staticString(node.right);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) {
        const expression = staticString(span.expression);
        if (expression === undefined) return undefined;
        value += expression + span.literal.text;
      }
      return value;
    }
    return undefined;
  };
  const memberName = (
    node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  ): string | undefined => ts.isPropertyAccessExpression(node)
    ? node.name.text
    : staticString(node.argumentExpression);
  const addFinding = (node: ts.Node, reason: string) => {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const key = `${line}:${reason}`;
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push({ file, line, reason });
  };
  const containingFunctionParameter = (
    node: ts.Node,
    identifier: string,
  ): ts.ParameterDeclaration | undefined => {
    let ancestor = node.parent;
    while (ancestor) {
      if (ts.isFunctionLike(ancestor)) {
        const parameter = ancestor.parameters.find((candidate) =>
          ts.isIdentifier(candidate.name) && candidate.name.text === identifier);
        if (parameter) return parameter;
      }
      ancestor = ancestor.parent;
    }
    return undefined;
  };

  // Resolve file-local constant strings first, including generated member names such as
  // "$" + "transaction" and "del" + "ete".
  for (let iteration = 0; iteration < 20; iteration++) {
    let changed = false;
    visit(sourceFile, (node) => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
      const value = staticString(node.initializer);
      if (value !== undefined && stringValues.get(node.name.text) !== value) {
        stringValues.set(node.name.text, value);
        changed = true;
      }
    });
    if (!changed) break;
  }

  visit(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
    if (!/(^|\/)lib\/prisma$/.test(node.moduleSpecifier.text)) return;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName?.text ?? element.name.text) === "prisma") {
          prismaRoots.add(element.name.text);
        }
      }
    }
    if (node.importClause?.name) prismaRoots.add(node.importClause.name.text);
  });

  const isPrismaRoot = (input: ts.Expression): boolean => {
    const node = unwrap(input);
    return ts.isIdentifier(node) && prismaRoots.has(node.text);
  };
  const isUserDelegate = (input: ts.Expression): boolean => {
    const node = unwrap(input);
    if (ts.isIdentifier(node)) return userDelegates.has(node.text);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      return memberName(node) === "user";
    }
    return false;
  };

  // Resolve Prisma aliases, transaction callback aliases, and User delegate aliases.
  for (let iteration = 0; iteration < 20; iteration++) {
    let changed = false;
    visit(sourceFile, (node) => {
      if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
        const property = node.propertyName && ts.isIdentifier(node.propertyName)
          ? node.propertyName.text
          : node.name.text;
        if (property === "user" && !userDelegates.has(node.name.text)) {
          userDelegates.add(node.name.text);
          changed = true;
        }
      }
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isIdentifier(node.name)) {
          const value = unwrap(node.initializer);
          if (ts.isIdentifier(value) && prismaRoots.has(value.text) && !prismaRoots.has(node.name.text)) {
            prismaRoots.add(node.name.text);
            changed = true;
          }
          if (isUserDelegate(value) && !userDelegates.has(node.name.text)) {
            userDelegates.add(node.name.text);
            changed = true;
          }
        } else if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (!ts.isIdentifier(element.name)) continue;
            const property = element.propertyName && ts.isIdentifier(element.propertyName)
              ? element.propertyName.text
              : element.name.text;
            if (property === "user" && !userDelegates.has(element.name.text)) {
              userDelegates.add(element.name.text);
              changed = true;
            }
          }
        }
      }
      if (ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)) {
        const value = unwrap(node.right);
        if (ts.isIdentifier(value) && prismaRoots.has(value.text) && !prismaRoots.has(node.left.text)) {
          prismaRoots.add(node.left.text);
          changed = true;
        }
        if (isUserDelegate(value) && !userDelegates.has(node.left.text)) {
          userDelegates.add(node.left.text);
          changed = true;
        }
      }
      if (!ts.isCallExpression(node)) return;
      const callee = unwrap(node.expression);
      if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) return;
      if (memberName(callee) !== "$transaction" || !isPrismaRoot(callee.expression)) return;
      const callback = node.arguments[0];
      if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return;
      for (const parameter of callback.parameters) {
        if (ts.isIdentifier(parameter.name) && !prismaRoots.has(parameter.name.text)) {
          prismaRoots.add(parameter.name.text);
          changed = true;
        }
      }
    });
    if (!changed) break;
  }

  const userDeleteSql = /\bDELETE\s+FROM\s+(?:(?:"?[A-Za-z_][\w$]*"?\s*\.\s*)?)"?User"?(?=\s|;|$)/i;

  visit(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const name = memberName(node);
      if ((name === "delete" || name === "deleteMany") && isUserDelegate(node.expression)) {
        addFinding(node, `User delegate ${name}`);
      }
      const receiver = unwrap(node.expression);
      const receiverParameter = ts.isIdentifier(receiver)
        ? containingFunctionParameter(node, receiver.text)
        : undefined;
      const receiverParameterType = receiverParameter?.type?.getText(sourceFile) ?? "";
      if ((name === "delete" || name === "deleteMany")
        && receiverParameter
        && !/^(?:Readonly)?(?:Set|Map|WeakSet|WeakMap)\b/.test(receiverParameterType)) {
        addFinding(node, `unresolved helper parameter ${name} cannot be proven non-User`);
      }
      if (ts.isElementAccessExpression(node) && name === undefined
        && (isPrismaRoot(node.expression) || isUserDelegate(node.expression))) {
        addFinding(node, "computed Prisma/User member cannot be proven non-destructive");
      }
    }

    if (ts.isVariableDeclaration(node)
      && ts.isObjectBindingPattern(node.name)
      && node.initializer
      && isUserDelegate(node.initializer)) {
      for (const element of node.name.elements) {
        const property = element.propertyName && ts.isIdentifier(element.propertyName)
          ? element.propertyName.text
          : ts.isIdentifier(element.name) ? element.name.text : undefined;
        if (property === "delete" || property === "deleteMany") {
          addFinding(element, `destructured User delegate ${property}`);
        }
      }
    }

    if (
      ts.isStringLiteralLike(node)
      || ts.isTemplateExpression(node)
      || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
      const sql = staticString(node as ts.Expression);
      if (sql && userDeleteSql.test(sql)) addFinding(node, "raw SQL DELETE FROM User");
    }
  });

  return findings.sort((a, b) => a.line - b.line || a.reason.localeCompare(b.reason));
}

// ── 1. Temporary global Consumer hard-delete prohibition ─────────────────────
const sourceFiles = [...walk("app"), ...walk("lib")].sort();
const hardDeleteFindings = sourceFiles.flatMap((file) => analyzeUserHardDeletes(file, read(file)));
ok("1· no recognized static Consumer/User hard-delete form exists under app/ or lib/",
  hardDeleteFindings.length === 0);
for (const finding of hardDeleteFindings) {
  bad.push(`     ${finding.file}:${finding.line} — ${finding.reason}`);
}

// Durable negative controls: these execute in every CI run and prevent the old lexical
// bypasses (aliases, brackets, generated names, raw SQL, and comment markers in strings).
const unsafeFixtures: Array<[string, string]> = [
  ["direct dot delete", `import { prisma } from "@/lib/prisma"; prisma.user.delete({ where: { id: "x" } });`],
  ["deleteMany", `import { prisma } from "@/lib/prisma"; prisma.user.deleteMany({ where: {} });`],
  ["delegate alias", `declare const db: any; const users = db.user; users.delete({ where: { id: "x" } });`],
  ["bracket access", `declare const db: any; db["user"]["delete"]({ where: { id: "x" } });`],
  ["optional chain", `declare const db: any; db.user?.delete?.({ where: { id: "x" } });`],
  ["destructured delegate", `declare const db: any; const { user } = db; user.delete({ where: { id: "x" } });`],
  ["generated transaction + member names", `
    import { prisma } from "@/lib/prisma";
    const transaction = "$" + "transaction";
    const operation = "del" + "ete";
    prisma[transaction](async (db: any) => db["user"][operation]({ where: { id: "x" } }));
  `],
  ["method alias", `declare const db: any; const erase = db.user.delete; erase({ where: { id: "x" } });`],
  ["raw SQL", `import { prisma } from "@/lib/prisma"; prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', "x");`],
  ["string-delimiter bypass", `
    import { prisma } from "@/lib/prisma";
    const opening = "/*";
    prisma.user.delete({ where: { id: "x" } });
    const closing = "*/";
  `],
];
unsafeFixtures.forEach(([label, source], index) => {
  ok(`${index + 2}· negative control rejects ${label}`,
    analyzeUserHardDeletes(`fixture-${index}.ts`, source).length > 0);
});
ok("11a· negative control rejects User-delegate helper indirection",
  analyzeUserHardDeletes("helper-fixture.ts", `
    import { prisma } from "@/lib/prisma";
    async function erase(delegate: any) {
      return delegate.delete({ where: { id: "x" } });
    }
    erase(prisma.user);
  `).length > 0);
ok("12· comments and comment-like string values do not create a false positive",
  analyzeUserHardDeletes(
    "safe-fixture.ts",
    `
      const opening = "/*"; const closing = "*/"; // prisma.user.delete({ where: {} })
      function toggle(id: string) {
        const selected = new Set<string>();
        selected.delete(id);
      }
      function prune(items: Set<string>) {
        items.delete("x");
      }
    `,
  ).length === 0);

// ── 2. Execute the real route with fail-on-write dependencies ─────────────────
type MockAccount = { id: string; isAgency: boolean };
type HarnessState = {
  account: MockAccount | null;
  client: { id: string } | null;
  lookupError: Error | null;
};

function loadContainedRoute() {
  const state: HarnessState = { account: null, client: null, lookupError: null };
  const lookups: unknown[] = [];
  const forbiddenEffects: string[] = [];

  const forbidden = (path: string): unknown => new Proxy(() => undefined, {
    get: (_target, property) => {
      const next = `${path}.${String(property)}`;
      forbiddenEffects.push(next);
      return forbidden(next);
    },
    apply: () => {
      forbiddenEffects.push(`${path}()`);
      throw new Error(`Forbidden effect reached: ${path}`);
    },
  });
  const user = new Proxy({
    findFirst: async (args: unknown) => {
      lookups.push(args);
      if (state.lookupError) throw state.lookupError;
      return state.client;
    },
  }, {
    get: (target, property, receiver) => property in target
      ? Reflect.get(target, property, receiver)
      : forbidden(`prisma.user.${String(property)}`),
  });
  const prisma = new Proxy({ user }, {
    get: (target, property, receiver) => property in target
      ? Reflect.get(target, property, receiver)
      : forbidden(`prisma.${String(property)}`),
  });
  const NextResponse = {
    json: (body: unknown, init?: ResponseInit) => new Response(
      JSON.stringify(body),
      { ...init, headers: { "content-type": "application/json" } },
    ),
  };
  const compiled = ts.transpileModule(routeText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: ROUTE,
    reportDiagnostics: true,
  });
  const transpileErrors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  ok("13· route transpiles for executable containment testing", transpileErrors.length === 0);

  const routeModule = { exports: {} as Record<string, unknown> };
  const allowedImports = new Set(["next/server", "@/lib/prisma", "@/lib/session"]);
  const seenImports: string[] = [];
  const requireMock = (specifier: string) => {
    seenImports.push(specifier);
    if (specifier === "next/server") return { NextResponse };
    if (specifier === "@/lib/prisma") return { prisma };
    if (specifier === "@/lib/session") {
      return { currentAccount: async () => state.account };
    }
    throw new Error(`Unexpected route import: ${specifier}`);
  };
  vm.runInNewContext(compiled.outputText, {
    module: routeModule,
    exports: routeModule.exports,
    require: requireMock,
    Response,
  }, { filename: ROUTE });

  return {
    state,
    lookups,
    forbiddenEffects,
    seenImports,
    allowedImports,
    exports: routeModule.exports as { DELETE?: (
      request: Request,
      context: { params: { id: string } },
    ) => Promise<Response> },
  };
}

async function runExecutableChecks() {
const harness = loadContainedRoute();
const handler = harness.exports.DELETE;
ok("14· route imports only the response helper, Prisma reader, and session reader",
  harness.seenImports.every((specifier) => harness.allowedImports.has(specifier))
  && harness.seenImports.length === harness.allowedImports.size);
ok("15· route exports DELETE and no GET/PATCH mutation surface",
  typeof handler === "function" && !("GET" in harness.exports) && !("PATCH" in harness.exports));

async function invoke(id: string): Promise<Response> {
  if (!handler) throw new Error("DELETE handler missing");
  return handler({} as Request, { params: { id } });
}
const resetObservations = () => {
  harness.lookups.length = 0;
  harness.forbiddenEffects.length = 0;
  harness.state.lookupError = null;
};
const responseBody = async (response: Response) => JSON.parse(await response.text()) as Record<string, unknown>;

resetObservations();
harness.state.account = null;
let response = await invoke("client-1");
ok("16· unauthenticated request returns 401 before client lookup",
  response.status === 401 && harness.lookups.length === 0 && harness.forbiddenEffects.length === 0);
ok("17· 401 uses the stable error envelope",
  (await responseBody(response)).error === "Unauthorized");

resetObservations();
harness.state.account = { id: "consumer-actor", isAgency: false };
response = await invoke("client-1");
ok("18· non-agency request returns 403 before client lookup",
  response.status === 403 && harness.lookups.length === 0 && harness.forbiddenEffects.length === 0);

resetObservations();
harness.state.account = { id: "agency-1", isAgency: true };
harness.state.client = null;
response = await invoke("other-tenant-or-missing");
ok("19· cross-tenant and nonexistent ids share the same 404 response",
  response.status === 404 && (await responseBody(response)).error === "Client not found.");
ok("20· lookup combines id and tenant and selects no additional identity/profile fields",
  JSON.stringify(harness.lookups) === JSON.stringify([{
    where: { id: "other-tenant-or-missing", managedByAgencyId: "agency-1" },
    select: { id: true },
  }]));
ok("21· tenant miss performs no mutation/evidence effect", harness.forbiddenEffects.length === 0);

resetObservations();
harness.state.client = { id: "client-1" };
const first = await invoke("client-1");
const firstBytes = Buffer.from(await first.text());
const second = await invoke("client-1");
const secondBytes = Buffer.from(await second.text());
const authorizedBody = JSON.parse(firstBytes.toString()) as Record<string, unknown>;
ok("22· authorized managed-client request fails closed with 409",
  first.status === 409 && second.status === 409 && typeof authorizedBody.error === "string");
ok("23· repeated authorized responses are byte-identical",
  firstBytes.equals(secondBytes));
ok("24· refusal states both no change and record preservation",
  /This request made no changes/.test(String(authorizedBody.error))
  && /no deletion or relationship termination was performed/.test(String(authorizedBody.error)));
ok("25· authorized path performs only the two expected tenant-scoped reads",
  harness.lookups.length === 2
  && harness.lookups.every((lookup) => JSON.stringify(lookup) === JSON.stringify({
    where: { id: "client-1", managedByAgencyId: "agency-1" },
    select: { id: true },
  })));
ok("26· authorized path reaches no mutation, transaction, KPI, evidence, or event port",
  harness.forbiddenEffects.length === 0);

resetObservations();
harness.state.client = null;
response = await invoke("not-a-cuid");
ok("27· malformed/random id fails closed through the same tenant-scoped 404 lookup",
  response.status === 404
  && JSON.stringify(harness.lookups) === JSON.stringify([{
    where: { id: "not-a-cuid", managedByAgencyId: "agency-1" },
    select: { id: true },
  }])
  && harness.forbiddenEffects.length === 0);

resetObservations();
harness.state.lookupError = new Error("synthetic database failure");
let infrastructureRejected = false;
try {
  await invoke("client-1");
} catch {
  infrastructureRejected = true;
}
ok("28· infrastructure error does not fall through to success or mutation",
  infrastructureRejected && harness.forbiddenEffects.length === 0);

// ── 3. Static boundary and sibling invariants ─────────────────────────────────
const routeSource = ts.createSourceFile(ROUTE, routeText, ts.ScriptTarget.Latest, true);
const imports = routeSource.statements
  .filter(ts.isImportDeclaration)
  .map((statement) => ts.isStringLiteral(statement.moduleSpecifier)
    ? statement.moduleSpecifier.text
    : "");
const routeCallPath = (input: ts.Expression): string => {
  if (ts.isIdentifier(input)) return input.text;
  if (ts.isPropertyAccessExpression(input)) {
    return `${routeCallPath(input.expression)}.${input.name.text}`;
  }
  if (ts.isElementAccessExpression(input) && ts.isStringLiteralLike(input.argumentExpression)) {
    return `${routeCallPath(input.expression)}.${input.argumentExpression.text}`;
  }
  return "<dynamic>";
};
const routeCalls: Array<{ path: string; node: ts.CallExpression }> = [];
const routeTaggedTemplates: ts.TaggedTemplateExpression[] = [];
const collectRouteCalls = (node: ts.Node) => {
  if (ts.isCallExpression(node)) routeCalls.push({ path: routeCallPath(node.expression), node });
  if (ts.isTaggedTemplateExpression(node)) routeTaggedTemplates.push(node);
  ts.forEachChild(node, collectRouteCalls);
};
collectRouteCalls(routeSource);
const expectedRouteCalls = [
  "NextResponse.json",
  "NextResponse.json",
  "NextResponse.json",
  "NextResponse.json",
  "currentAccount",
  "prisma.user.findFirst",
].sort();
const taggedMutationMarker =
  'if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });';
const taggedMutationFixture = routeText.replace(
  taggedMutationMarker,
  `${taggedMutationMarker}
  if (params.id === "never-probed") {
    await prisma.$executeRaw\`INSERT INTO "AgencyClientDeletion" ("id") VALUES ('x')\`;
  }`,
);
const taggedFixtureSource = ts.createSourceFile(
  "tagged-route-fixture.ts",
  taggedMutationFixture,
  ts.ScriptTarget.Latest,
  true,
);
let taggedFixtureEffects = 0;
const countTaggedFixtureEffects = (node: ts.Node) => {
  if (ts.isTaggedTemplateExpression(node)) taggedFixtureEffects++;
  ts.forEachChild(node, countTaggedFixtureEffects);
};
countTaggedFixtureEffects(taggedFixtureSource);
ok("29· source boundary permits exactly the auth reader, tenant reader, and four refusal responses",
  JSON.stringify(imports.sort()) === JSON.stringify([...harness.allowedImports].sort())
  && JSON.stringify(routeCalls.map((call) => call.path).sort()) === JSON.stringify(expectedRouteCalls)
  && routeTaggedTemplates.length === 0
  && taggedMutationFixture !== routeText
  && taggedFixtureEffects === 1);
const responseCalls = routeCalls.filter((call) => call.path === "NextResponse.json");
const responseStatuses = responseCalls.map(({ node }) => {
  const init = node.arguments[1];
  if (!init || !ts.isObjectLiteralExpression(init)) return NaN;
  const status = init.properties.find((property): property is ts.PropertyAssignment =>
    ts.isPropertyAssignment(property)
    && ((ts.isIdentifier(property.name) && property.name.text === "status")
      || (ts.isStringLiteralLike(property.name) && property.name.text === "status")));
  return status && ts.isNumericLiteral(status.initializer)
    ? Number(status.initializer.text)
    : NaN;
}).sort((a, b) => a - b);
const errorEnvelopesOnly = responseCalls.every(({ node }) => {
  const body = node.arguments[0];
  return !!body && ts.isObjectLiteralExpression(body)
    && body.properties.length === 1
    && ts.isPropertyAssignment(body.properties[0])
    && ts.isIdentifier(body.properties[0].name)
    && body.properties[0].name.text === "error";
});
ok("30· every route response is an error-only 401/403/404/409 envelope and containment is unconditional",
  JSON.stringify(responseStatuses) === JSON.stringify([401, 403, 404, 409])
  && errorEnvelopesOnly
  && !/@\/lib\/identity|operatorIdentityEnabled|OPERATOR_IDENTITY_ENABLED|EVENT_BUS_ENABLED|flags?\./.test(routeText));
ok("31· route is force-dynamic and declares no cacheable read/update handler",
  /export const dynamic = "force-dynamic"/.test(routeText)
  && !/export async function (GET|PATCH|PUT|POST)/.test(routeText));

const creationRoute = read("app/api/agency/clients/route.ts");
ok("32· client creation still enforces capacity in a transaction",
  /prisma\.\$transaction\(/.test(creationRoute));
ok("33· KPI route remains a read-only consumer of historical deletion rows",
  /agencyClientDeletion\.findMany/.test(read("app/api/agency/kpi/route.ts")));
ok("34· workspace selection still verifies the managed edge",
  /managedByAgencyId:\s*account\.id/.test(read("lib/session.ts")));

// ── 4. UI tells the truth and cannot optimistically mutate on Slice 0 ─────────
const ui = read(UI);
const uiHandler = ui.match(/function showClientOffboardingStatus[\s\S]*?\n  \}/)?.[0] ?? "";
ok("35· UI describes unavailable offboarding, not deletion or completed termination",
  /Offboarding unavailable/.test(ui)
  && !/Delete client|aria-label=\{`Delete|Stop managing \$\{name\}/.test(ui));
ok("36· UI uses a non-destructive information affordance",
  /CircleHelp/.test(ui) && !/\bTrash2\b/.test(ui));
ok("37· UI states exactly why it can promise no client-state change",
  /No request was sent/.test(uiHandler)
  && /no client data or management relationship was changed/.test(uiHandler));
ok("38· informational control sends no request and changes no roster, KPI, or capacity",
  uiHandler.length > 0
  && !/fetch\(|method:\s*"DELETE"/.test(uiHandler)
  && !/setClients\(|loadKpi\(/.test(uiHandler)
  && /setError\(/.test(uiHandler));
ok("39· refusal is exposed through an accessible live alert",
  /role="alert"/.test(ui) && /aria-live="polite"/.test(ui));

if (bad.length) console.error(bad.join("\n"));
console.log(`\nconsumer-deletion-containment.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
}

runExecutableChecks().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
