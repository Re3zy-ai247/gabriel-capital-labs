// Run: npx tsx scripts/schema-safety.test.ts
//
// Pins the schema-safety contract discovered on 2026-07-20.
//
// BACKGROUND (production truth, from Vercel build logs):
//   The build ran `prisma db push --skip-generate --accept-data-loss` on EVERY
//   production AND preview deployment, and it SUCCEEDED — the datasource resolves
//   to a direct Postgres endpoint (db.prisma.io:5432), not the Accelerate proxy.
//   The long-standing repo note that "db push silently fails through Accelerate"
//   was therefore FALSE in current production.
//
//   `db push` makes the database match schema.prisma, which means it DROPS tables
//   the schema does not declare. 15 tables in this repo are created at runtime by
//   self-heal DDL and are deliberately NOT in schema.prisma — so each deploy was
//   armed to drop them. Preview and production share one DATABASE_URL value, so
//   any branch could trigger it against production data.
//
//   The push was NOT idling: the Prisma CLI prints "already in sync" only when
//   executedSteps === 0, and our build logs printed "now in sync" — steps ran on
//   every build. No data-loss warning appeared, meaning those drops hit tables
//   while still empty; once one holds rows, --accept-data-loss suppresses the
//   refusal and the rows go with it.
//
// THE CONTRACT THIS GUARD ENFORCES:
//   1. Build, install, release, and runtime-start surfaces are DB-mutation-free.
//      Schema changes are a separately authorized operator action, never an
//      application lifecycle side effect.
//   2. Docker/Compose pins its base images, installs lockfile-deterministically,
//      receives Prisma before postinstall, starts only the application, excludes
//      local secrets, and exposes database/application health explicitly.
//   3. Package-script indirection cannot hide a mutation from these checks.
//   4. The self-heal table inventory stays visible, so the two-world split
//      (schema.prisma-owned vs self-heal-owned) is a recorded decision rather
//      than an accident.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const vercelJson = readFileSync(join(root, "vercel.json"), "utf8");
const pkg = readFileSync(join(root, "package.json"), "utf8");
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
const dockerCompose = readFileSync(join(root, "docker-compose.yml"), "utf8");
const dockerignore = readFileSync(join(root, ".dockerignore"), "utf8");
const deployGuide = readFileSync(join(root, "DEPLOY.md"), "utf8");
const workflowDir = join(root, ".github", "workflows");

const parsedPackage = JSON.parse(pkg) as { scripts?: Record<string, string> };
const pkgScripts = parsedPackage.scripts ?? {};
const parsedVercel = JSON.parse(vercelJson) as {
  buildCommand?: string;
  installCommand?: string;
};

type PrismaMutation = "db push" | "db execute" | "db seed" | "migrate deploy" |
  "migrate dev" | "migrate reset" | "migrate resolve";

const MUTATING_PRISMA_ACTIONS = new Set<PrismaMutation>([
  "db push",
  "db execute",
  "db seed",
  "migrate deploy",
  "migrate dev",
  "migrate reset",
  "migrate resolve",
]);
const PRISMA_GLOBAL_OPTIONS_WITH_VALUES = new Set([
  "--schema",
  "--config",
  "--telemetry-information",
]);

function tokenizeCommandTail(command: string): string[] {
  return command
    .replace(/\\\r?\n/g, " ")
    .match(/"[^"]*"|'[^']*'|[^\s;&|]+/g)
    ?.map((token) => token.replace(/^["']|["']$/g, "")) ?? [];
}

function prismaMutations(command: string): PrismaMutation[] {
  const found = new Set<PrismaMutation>();
  const prismaCommand = /\bprisma(?:@[0-9A-Za-z._+-]+)?\b/g;

  for (const match of command.matchAll(prismaCommand)) {
    const tail = command.slice((match.index ?? 0) + match[0].length).split(/[;&|]/, 1)[0];
    const tokens = tokenizeCommandTail(tail);
    let index = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token === "--") {
        index++;
        continue;
      }
      if (!token.startsWith("-")) break;
      const optionName = token.split("=", 1)[0];
      index++;
      if (PRISMA_GLOBAL_OPTIONS_WITH_VALUES.has(optionName) && !token.includes("=")) index++;
    }

    const action = `${tokens[index] ?? ""} ${tokens[index + 1] ?? ""}` as PrismaMutation;
    if (MUTATING_PRISMA_ACTIONS.has(action)) found.add(action);
  }

  return Array.from(found).sort();
}

function invokedPackageScripts(command: string): string[] {
  const invoked = new Set<string>();
  const runScript = /\bnpm\s+(?:run|run-script)\s+(?:(?:--[A-Za-z0-9_-]+(?:=[^\s]+)?)\s+)*(?:--\s+)?([A-Za-z0-9:_-]+)/g;
  for (const match of command.matchAll(runScript)) invoked.add(match[1]);

  const shorthand = /\bnpm\s+(start|test|stop|restart)\b/g;
  for (const match of command.matchAll(shorthand)) invoked.add(match[1]);

  if (/\bnpm\s+(?:ci|install)(?:\s|$)/.test(command)) {
    for (const lifecycle of [
      "preinstall", "install", "postinstall", "prepublish",
      "preprepare", "prepare", "postprepare",
    ]) invoked.add(lifecycle);
  }

  return Array.from(invoked);
}

function commandSafetyFindings(command: string): string[] {
  const findings = new Set<string>();
  const visitedScripts = new Set<string>();

  const inspect = (source: string, chain: string[]) => {
    for (const mutation of prismaMutations(source)) {
      findings.add(`${chain.join(" -> ")}: prisma ${mutation}`);
    }

    for (const target of invokedPackageScripts(source)) {
      for (const lifecycle of [`pre${target}`, target, `post${target}`]) {
        const script = pkgScripts[lifecycle];
        if (!script || visitedScripts.has(lifecycle)) continue;
        visitedScripts.add(lifecycle);
        inspect(script, [...chain, `npm script ${lifecycle}`]);
      }
    }
  };

  inspect(command, ["surface"]);
  return Array.from(findings).sort();
}

function checkMutationFree(label: string, command: string) {
  const findings = commandSafetyFindings(command);
  check(`${label}: no direct or npm-indirected Prisma mutation`, findings.length === 0);
  if (findings.length) console.error(`  ${label}:`, JSON.stringify(findings));
}

// Pin the detector itself so common indirection/version spelling cannot weaken it.
for (const [label, command] of [
  ["direct db push", "prisma db push"],
  ["version-qualified db push", "npx prisma@5.22.0 db push"],
  ["npm-exec db push", "npm exec prisma -- db push"],
  ["schema-qualified migrate", "prisma --schema prisma/schema.prisma migrate deploy"],
] as const) {
  check(`mutation detector recognizes ${label}`, prismaMutations(command).length === 1);
}

pkgScripts["__schema_guard_inner"] = "npx prisma@5.22.0 db push";
pkgScripts["__schema_guard_outer"] = "npm run __schema_guard_inner";
check("mutation detector follows recursive npm-run indirection",
  commandSafetyFindings("npm run __schema_guard_outer").some((finding) => finding.includes("db push")));
delete pkgScripts["__schema_guard_inner"];
delete pkgScripts["__schema_guard_outer"];

// ── 1. No destructive schema operation in any release/startup path ──────────
check("package.json has no db:push escape hatch", !("db:push" in pkgScripts));
for (const [name, source] of Object.entries(pkgScripts)) {
  check(`package.json ${name}: no raw prisma db push`, !prismaMutations(source).includes("db push"));
}

// Exact lifecycle commands make local wrapper-file indirection unreachable from
// install/build/start. A new wrapper cannot silently escape the command scanner:
// adding it changes one of these exact checks before its contents ever matter.
check("package.json build is exact codegen plus application build",
  pkgScripts.build === "prisma generate && next build");
check("package.json start is exact application start", pkgScripts.start === "next start");
check("package.json postinstall is exact code generation", pkgScripts.postinstall === "prisma generate");
for (const lifecycle of [
  "preinstall", "install", "prepublish", "preprepare", "prepare", "postprepare",
  "prebuild", "postbuild", "prestart", "poststart",
]) {
  check(`package.json has no ${lifecycle} lifecycle wrapper`, !(lifecycle in pkgScripts));
}

for (const [label, source] of [
  ["vercel.json installCommand", parsedVercel.installCommand ?? ""],
  ["vercel.json buildCommand", parsedVercel.buildCommand ?? ""],
  ["package.json build lifecycle", "npm run build"],
  ["package.json start lifecycle", "npm run start"],
  ["Dockerfile", dockerfile],
  ["docker-compose.yml", dockerCompose],
] as const) checkMutationFree(label, source);

const workflowSources: [string, string][] = readdirSync(workflowDir)
  .filter((name) => /\.ya?ml$/.test(name))
  .sort()
  .map((workflow) => [workflow, readFileSync(join(workflowDir, workflow), "utf8")]);

const EXPECTED_WORKFLOW_ENV_ENTRIES: Record<string, string[]> = {
  "ci.yml": [
    "NEXTAUTH_SECRET=ci-placeholder-not-used-in-production",
    "NEXTAUTH_SECRET=ci-placeholder-not-used-in-production",
  ],
  "daily-health.yml": [
    "GH_TOKEN=${{ github.token }}",
    'TITLE="Production health check failing"',
  ],
  "monthly-review.yml": [
    "GH_TOKEN=${{ github.token }}",
    "NEXTAUTH_SECRET=ci-placeholder-not-used-in-production",
  ],
  "weekly-verify.yml": [
    "GH_TOKEN=${{ github.token }}",
    "NEXTAUTH_SECRET=ci-placeholder-not-used-in-production",
    'TITLE="Weekly deep verification failing"',
  ],
};
check("workflow filename inventory is exact",
  JSON.stringify(workflowSources.map(([name]) => name)) ===
    JSON.stringify(Object.keys(EXPECTED_WORKFLOW_ENV_ENTRIES).sort()));

function workflowEnvEntries(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const entries: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const env = lines[index].match(/^(\s*)env:\s*$/);
    if (!env) continue;
    const envIndent = env[1].length;
    for (let child = index + 1; child < lines.length; child++) {
      const line = lines[child];
      if (!line.trim() || line.trimStart().startsWith("#")) continue;
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent <= envIndent) break;
      const entry = line.match(/^\s+([^:#\s]+):\s*(.*?)\s*$/);
      if (entry) entries.push(`${entry[1]}=${entry[2]}`);
    }
  }
  return entries.sort();
}

for (const [workflow, source] of workflowSources) {
  checkMutationFree(
    `.github/workflows/${workflow}`,
    source
  );
  check(`.github/workflows/${workflow}: exact approved environment bindings`,
    JSON.stringify(workflowEnvEntries(source)) ===
      JSON.stringify(EXPECTED_WORKFLOW_ENV_ENTRIES[workflow].slice().sort()));
  check(`.github/workflows/${workflow}: no repository/environment secret reference`,
    !/\$\{\{\s*secrets\./.test(source));
  check(`.github/workflows/${workflow}: no repository variable alias`,
    !/\$\{\{\s*vars\./.test(source));
  check(`.github/workflows/${workflow}: no dynamic GITHUB_ENV alias`,
    !/\bGITHUB_ENV\b/.test(source));
}

// Workflows intentionally execute a small, reviewable set of local verification
// wrappers. Freeze that literal inventory so a new deploy/migration wrapper cannot
// be introduced in YAML without also changing this guard. The wildcard is the
// existing DB-free top-level guard suite; CI explicitly excludes its DB test.
const workflowWrappers = new Set<string>();
for (const [, source] of workflowSources) {
  for (const match of source.matchAll(/\bscripts\/[A-Za-z0-9_./*-]+\.(?:ts|tsx|js|mjs|cjs|sh|bash)\b/g)) {
    workflowWrappers.add(match[0]);
  }
}
const EXPECTED_WORKFLOW_WRAPPERS = [
  "scripts/*.test.ts",
  "scripts/gate-d-preflight.test.ts",
  "scripts/prod-health.sh",
  "scripts/release-verify.sh",
  "scripts/release-verify.test.ts",
  "scripts/runtime/run-all.ts",
  "scripts/schema-safety.test.ts",
];
check("workflow local-wrapper inventory is exact and reviewable",
  JSON.stringify(Array.from(workflowWrappers).sort()) === JSON.stringify(EXPECTED_WORKFLOW_WRAPPERS));

// Vercel and Docker installs must resolve the committed lockfile exactly.
check("vercel installCommand is exactly npm ci", parsedVercel.installCommand?.trim() === "npm ci");
check("vercel buildCommand is exact codegen plus application build",
  parsedVercel.buildCommand?.trim() === "prisma generate && next build");
check("Docker copies the exact lockfile", /^COPY package\.json package-lock\.json \.\/$/m.test(dockerfile));
check("Docker install is npm ci, never npm install",
  /^RUN npm ci$/m.test(dockerfile) && !/^RUN npm install(?:\s|$)/m.test(dockerfile));
const dockerInstructionNames = Array.from(dockerfile.matchAll(/^([A-Za-z]+)\b/gm))
  .map((match) => match[1].toUpperCase());
check("Docker instruction inventory is exact",
  JSON.stringify(dockerInstructionNames) === JSON.stringify([
    "FROM", "WORKDIR", "RUN", "COPY", "COPY", "RUN", "COPY", "RUN",
    "FROM", "WORKDIR", "RUN", "ENV", "COPY", "EXPOSE", "CMD",
  ]));
const PINNED_NODE_IMAGE =
  "node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293";
const dockerFromInstructions = Array.from(dockerfile.matchAll(/^FROM\s+(.+)$/gmi))
  .map((match) => match[1].trim());
check("Docker build and runtime stages use the exact pinned Node OCI index",
  JSON.stringify(dockerFromInstructions) === JSON.stringify([
    `${PINNED_NODE_IMAGE} AS deps`,
    `${PINNED_NODE_IMAGE} AS runner`,
  ]));
const dockerRunInstructions = Array.from(dockerfile.matchAll(/^RUN\s+(.+)$/gmi)).map((match) => match[1].trim());
check("Docker build RUN instruction inventory is exact and wrapper-free",
  JSON.stringify(dockerRunInstructions) === JSON.stringify([
    "apk add --no-cache openssl=3.5.8-r0",
    "npm ci",
    "npm run build",
    "apk add --no-cache openssl=3.5.8-r0",
  ]));
check("Docker pins the exact Prisma OpenSSL dependency in both stages",
  dockerRunInstructions.filter((instruction) =>
    instruction === "apk add --no-cache openssl=3.5.8-r0"
  ).length === 2);
check("Docker has no deferred ONBUILD instruction", !/^ONBUILD\b/mi.test(dockerfile));

// postinstall runs Prisma code generation, so schema.prisma must already exist.
const dockerPrismaCopy = dockerfile.indexOf("COPY prisma ./prisma");
const dockerInstall = dockerfile.indexOf("RUN npm ci");
check("Docker copies Prisma schema before npm ci/postinstall",
  dockerPrismaCopy >= 0 && dockerInstall > dockerPrismaCopy);

// Runtime startup is intentionally exact: no shell, mutation prefix, or fallback.
check("Docker runtime command is exact mutation-free application start",
  JSON.stringify(Array.from(dockerfile.matchAll(/^CMD\s+(.+)$/gmi)).map((match) => match[1].trim())) ===
    JSON.stringify(['["npm", "run", "start"]']));
check("Docker has no ENTRYPOINT override", !/^ENTRYPOINT\b/mi.test(dockerfile));

function composeService(name: string): string {
  const serviceStart = dockerCompose.search(new RegExp(`^  ${name}:\\s*$`, "m"));
  if (serviceStart < 0) return "";
  const serviceTail = dockerCompose.slice(serviceStart + 1);
  const nextService = serviceTail.search(/^  [A-Za-z0-9_-]+:\s*$/m);
  return nextService < 0 ? serviceTail : serviceTail.slice(0, nextService);
}

const dbService = composeService("db");
const webService = composeService("web");
check("Compose retains the Dockerfile-backed web service",
  /^    build: \.\s*$/m.test(webService));
check("Compose cannot override the web runtime command or entrypoint",
  !/^    (?:command|entrypoint):/m.test(webService));
check("Compose project is explicitly disposable-local", /^name: creditvector-local$/m.test(dockerCompose));

const PINNED_POSTGRES_IMAGE =
  "postgres:16-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685";
check("Compose database uses the exact pinned PostgreSQL OCI index",
  new RegExp(`^    image: ${PINNED_POSTGRES_IMAGE}$`, "m").test(dbService));
check("Compose database port is loopback-only", /^    ports: \["127\.0\.0\.1:5432:5432"\]$/m.test(dbService));
check("Compose web port is loopback-only", /^    ports: \["127\.0\.0\.1:3000:3000"\]$/m.test(webService));
check("Compose requires an explicit disposable-local database password",
  /POSTGRES_PASSWORD: "\$\{LOCAL_POSTGRES_PASSWORD:\?set a disposable-local password\}"/.test(dbService));
check("Compose derives DATABASE_URL only from the disposable-local password",
  /DATABASE_URL: "postgresql:\/\/creditvector_local:\$\{LOCAL_POSTGRES_PASSWORD:\?set a disposable-local password\}@db:5432\/creditvector_local"/.test(webService));
check("Compose requires explicit local auth and encryption secrets",
  /NEXTAUTH_SECRET: "\$\{LOCAL_NEXTAUTH_SECRET:\?set a disposable-local auth secret\}"/.test(webService) &&
  /DOCUMENT_ENCRYPTION_KEY: "\$\{LOCAL_DOCUMENT_ENCRYPTION_KEY:\?set a disposable-local encryption key\}"/.test(webService));
check("Compose carries no hard-coded credential placeholders or provider key",
  !/(?:change-me-in-production|postgresql:\/\/gcl:gcl|ANTHROPIC_API_KEY)/.test(dockerCompose));
check("Compose database healthcheck is exact",
  /test: \["CMD-SHELL", "pg_isready -U \$\$\{POSTGRES_USER\} -d \$\$\{POSTGRES_DB\}"\]/.test(dbService) &&
  /interval: 5s/.test(dbService) && /timeout: 5s/.test(dbService) &&
  /retries: 12/.test(dbService) && /start_period: 5s/.test(dbService));
check("Compose web waits for healthy PostgreSQL",
  /depends_on:\s*\n      db:\s*\n        condition: service_healthy/.test(webService));
check("Compose application healthcheck uses only the readiness endpoint",
  /test: \["CMD", "node", "-e", "fetch\('http:\/\/127\.0\.0\.1:3000\/api\/health\/ready'\)\.then\(r=>process\.exit\(r\.ok\?0:1\)\)\.catch\(\(\)=>process\.exit\(1\)\)"\]/.test(webService) &&
  /interval: 10s/.test(webService) && /timeout: 5s/.test(webService) &&
  /retries: 12/.test(webService) && /start_period: 20s/.test(webService));

// The active guide records prerequisites but confers no execution authority.
check("deploy guide explicitly grants no production or database authority",
  deployGuide.includes("This document grants no production or database authority."));
check("deploy guide requires credential rotation before the next production DB contact",
  /credentials were rotated \*\*before the next production\s+database contact\*\*/.test(deployGuide) &&
  deployGuide.includes("previously exposed credential is not reused"));
check("deploy guide requires accepted DB-4 for the exact candidate commit and tree",
  deployGuide.includes("DB-4 was accepted against the exact candidate commit and tree being promoted"));
check("deploy guide requires a fresh hardened backup immediately before DB-5",
  /fresh hardened backup was completed immediately before DB-5\/migration\s+execution/.test(deployGuide));
const termsMigrationInGuide = deployGuide.indexOf("20260728000000_terms_acceptance");
const assertionMigrationInGuide = deployGuide.indexOf("20260823120000_consumer_assertion");
check("deploy guide pins the one-deploy lexical migration order",
  deployGuide.includes("performs exactly one controlled invocation applying the two pending") &&
  termsMigrationInGuide >= 0 && assertionMigrationInGuide > termsMigrationInGuide);
check("deploy guide explicitly forbids staged --to deployment",
  deployGuide.includes("Do not attempt a staged `--to` deployment."));
const optionBHeading = deployGuide.indexOf("## Option B — Self-host with Docker/Compose");
const productionDeployGuide = optionBHeading < 0 ? deployGuide : deployGuide.slice(0, optionBHeading);
const disposableLocalGuide = optionBHeading < 0 ? "" : deployGuide.slice(optionBHeading);
check("Production deploy guide delegates directly to the authoritative Gate-D runbook",
  productionDeployGuide.includes(
    "[Gate-D production migration](.ai/RUNBOOKS/gate-d-production-migration.md)"
  ));
check("Production deploy guide contains no executable Prisma mutation or DB URL assignment",
  prismaMutations(productionDeployGuide).length === 0 &&
  !/\bDATABASE_URL\s*=/.test(productionDeployGuide));
check("disposable-local Compose provisioning remains explicit and isolated",
  disposableLocalGuide.includes(
    "docker compose run --rm web npx --no-install prisma migrate deploy"
  ) && /disposable\s+local environment only/.test(disposableLocalGuide));

const ignored = dockerignore.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
for (const required of [
  ".git", ".env", ".env.*", ".npmrc", ".vercel", "node_modules",
  ".next", ".turbo", "out", "dist", "coverage", "*.key", "*.pem",
]) {
  check(`.dockerignore excludes ${required}`, ignored.includes(required));
}
check(".dockerignore explicitly retains the non-secret .env.example template",
  ignored.indexOf("!.env.example") > ignored.indexOf(".env.*"));
const dockerAiRules = ignored.filter((rule) => rule.includes(".ai"));
check(".dockerignore excludes .ai except the exact build-required ledger allowlist",
  JSON.stringify(dockerAiRules) === JSON.stringify([
    ".ai/**",
    "!.ai/quality-ledger.json",
    "!.ai/work-ledger.json",
  ]));
check(".dockerignore has no broad .ai re-inclusion",
  !dockerAiRules.some((rule) => /^!\.ai\/?(?:\*\*)?$/.test(rule)));

const buildAiImports = new Set<string>();
const collectBuildAiImports = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectBuildAiImports(path);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/["']@\/\.ai\/([^"']+)["']/g)) {
        buildAiImports.add(match[1]);
      }
    }
  }
};
for (const sourceDir of ["app", "components", "lib"]) {
  collectBuildAiImports(join(root, sourceDir));
}
check("build-time .ai import inventory matches the Docker context allowlist",
  JSON.stringify(Array.from(buildAiImports).sort()) === JSON.stringify([
    "quality-ledger.json",
    "work-ledger.json",
  ]));

// Code generation remains a build action; only database mutation is forbidden.
const build = parsedVercel.buildCommand ?? "";
check("build still runs prisma generate", /\bprisma\s+generate\b/.test(build));
check("build still runs next build", /\bnext\s+build\b/.test(build));

// ── 2. The self-heal inventory is real and visible ───────────────────────────
// Every table created by runtime DDL, whether or not schema.prisma declares it.
const libDir = join(root, "lib");
const healed = new Set<string>();
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".ts")) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS "([A-Za-z]+)"/g)) healed.add(m[1]);
    }
  }
};
walk(libDir);

check("self-heal DDL still present (legacy path intact)", healed.size > 0);

// ── MIGRATION-FIRST ENFORCEMENT (owner-ratified 2026-07-20) ──────────────────
// Migrations govern ALL new schema. Runtime self-heal is a LEGACY mechanism,
// permitted ONLY for the tables that already used it when the policy was ratified.
// This frozen allowlist is the complete set of tables allowed to carry self-heal
// DDL. Any NEW self-heal DDL — even for a table also declared in schema.prisma —
// is not in this list and fails the guard, so a new feature can never quietly
// depend on runtime-created schema. Growing this list requires a new owner-approved
// ADR (that is the "conscious, reviewed act" the policy demands), and it should
// SHRINK over time as legacy tables are retired through reviewed migrations.
const LEGACY_SELF_HEAL_ALLOWLIST = new Set([
  "AiUsage", "Attachment", "BriefArticle", "BriefComment", "BriefCommentReport",
  "BriefReaction", "Campaign", "ClientAssignment", "CommunityReply", "CommunityReport",
  "CommunityThread", "DecisionRegistry", "KaiEvent", "KaiSeen", "KernelAudit",
  "KernelEvent", "KernelIdempotency", "MailManifest", "OutcomeConsent",
  "PasswordResetToken", "ProductEvent", "PushSubscription", "RateHit",
  "StripeWebhookEvent", "SupportTicket", "SupportTicketMessage", "TeamInvitation",
  "TeamMember", "TradelineContact", "UserDevice", "UserSession", "VerifiedOutcome",
]);
const newlySelfHealed = Array.from(healed).filter((t) => !LEGACY_SELF_HEAL_ALLOWLIST.has(t)).sort();
check(
  "migration-first: no NEW table self-heals — only the legacy allowlist may (new tables need a migration)",
  newlySelfHealed.length === 0
);
if (newlySelfHealed.length) console.error("  new self-heal DDL not on the legacy allowlist (add a migration, not self-heal):", JSON.stringify(newlySelfHealed));

// Tables the runtime creates that schema.prisma does NOT declare. These are the
// ones a build-time `db push` would have dropped. The count is pinned so that
// adding another self-heal-only table is a conscious, reviewed act.
const declared = new Set(Array.from(schema.matchAll(/^model ([A-Za-z]+) \{/gm)).map((m) => m[1]));
const selfHealOnly = Array.from(healed).filter((t) => !declared.has(t)).sort();

// Recorded inventory as of 2026-07-20. If this list changes, update it in the
// same commit that changes the schema — the point is that the split is explicit.
const EXPECTED_SELF_HEAL_ONLY = [
  "Campaign",
  "ClientAssignment",
  "DecisionRegistry",
  "KernelAudit",
  "KernelEvent",
  "KernelIdempotency",
  "MailManifest",
  "OutcomeConsent",
  "StripeWebhookEvent",
  "TeamInvitation",
  "TeamMember",
  "TradelineContact",
  "UserDevice",
  "UserSession",
  "VerifiedOutcome",
];
check(
  `self-heal-only table inventory matches the recorded list (${selfHealOnly.length} tables)`,
  JSON.stringify(selfHealOnly) === JSON.stringify(EXPECTED_SELF_HEAL_ONLY)
);
if (JSON.stringify(selfHealOnly) !== JSON.stringify(EXPECTED_SELF_HEAL_ONLY)) {
  console.error("  expected:", JSON.stringify(EXPECTED_SELF_HEAL_ONLY));
  console.error("  actual:  ", JSON.stringify(selfHealOnly));
}

// These carry live user or money data — their loss is not recoverable from a
// re-run, so they are called out by name rather than left in a count.
for (const critical of ["VerifiedOutcome", "OutcomeConsent", "StripeWebhookEvent"]) {
  check(`${critical} is self-heal-owned and therefore must never face a build-time push`,
    healed.has(critical));
}

console.log(`\nschema-safety.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
