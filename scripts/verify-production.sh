#!/usr/bin/env bash
# CreditVector RC1 production verification harness.
#
# USAGE
#   bash scripts/verify-production.sh              # repository checks only (offline, default)
#   bash scripts/verify-production.sh --probe      # + read-only unauthenticated probes of BASE
#   bash scripts/verify-production.sh --expect-commit <40-hex> --expect-tree <40-hex>
#   CV_BASE_URL=https://... bash scripts/verify-production.sh --probe
#   CV_VERIFY_OUT=/some/dir bash scripts/verify-production.sh   # also write report files there
#
# WHAT THIS IS
#   A repeatable, safe pass over the release questions that CAN be answered from the
#   repository, plus — for the part that genuinely needs production credentials — the
#   exact owner command printed instead of guessed. It is a HARNESS, not a Go/No-Go
#   checklist. A clean run is evidence, never a release decision: whatever release
#   assessment the owner is working from remains the canonical gate, and this script
#   deliberately does not name or depend on one.
#
# THE FIVE RECORD STATUSES (nothing else is ever printed)
#   PASS                                  proven here, now, from the repository or a live probe
#   FAIL                                  proven WRONG — final result FAIL, exit 1
#   VERIFICATION REQUIRED — PROVIDER      needs a provider-side observation
#   VERIFICATION REQUIRED — PRODUCTION    needs a deployed/runtime or production-data observation
#   VERIFICATION REQUIRED — INPUT         reviewed commit/tree expectation was not supplied
#   NOT RUN — ENVIRONMENT                 a local prerequisite is absent
#   An unknown is never scored PASS. That is the fail-closed rule this file exists to hold.
#
# THE TWO RESULT AXES AND PROCESS EXIT
#   OFFLINE_RESULT=PASS_OFFLINE          every requested offline assertion passed
#   OFFLINE_RESULT=VERIFICATION_REQUIRED a local input/prerequisite was unavailable
#   OFFLINE_RESULT=FAIL                  a local assertion, parser, or custody check failed
#   RELEASE_RESULT=VERIFICATION_REQUIRED exit 2 — an external/input/env fact remains unknown
#   RELEASE_RESULT=FAIL                  exit 1 — any local or observed probe fact failed
#   RELEASE_RESULT=PASS_OFFLINE          exit 0 — only when no unknown of any scope remains
#
# HARD INVARIANTS
#   1. NO SECRET VALUE IS EVER PRINTED. Every secret check is presence/absence only.
#      A check that echoes a secret is a security defect, not a verbose check.
#   2. READ-ONLY ALWAYS. There is no mutating mode and no flag that adds one. Remediations
#      that mutate production (the encryption backfill, Stripe catalog provisioning,
#      setting an env var) are PRINTED for the owner to run deliberately and are never
#      executed here — a verification tool that repairs what it measures cannot be trusted
#      to measure it. The default run does not leave the repository at all; --probe adds
#      unauthenticated GET/POST probes that every handler rejects before any side effect,
#      which is the same discipline scripts/prod-health.sh already uses.
#   3. REPOSITORY vs PRODUCTION is stated per section and never blurred.
set -uo pipefail

BASE="${CV_BASE_URL:-https://www.creditvector.app}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROBE=0
EXPECTED_COMMIT="${CV_EXPECTED_COMMIT:-}"
EXPECTED_TREE="${CV_EXPECTED_TREE:-}"
STRIPE_SOURCE="$ROOT/lib/stripe.ts"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --probe) PROBE=1; shift ;;
    --expect-commit)
      [ "$#" -ge 2 ] || { echo "--expect-commit requires a full 40-hex SHA" >&2; exit 64; }
      EXPECTED_COMMIT="$2"; shift 2 ;;
    --expect-tree)
      [ "$#" -ge 2 ] || { echo "--expect-tree requires a full 40-hex SHA" >&2; exit 64; }
      EXPECTED_TREE="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $1" >&2; echo "usage: bash scripts/verify-production.sh [--probe] [--expect-commit <40-hex> --expect-tree <40-hex>]" >&2; exit 64 ;;
  esac
done

PASSES=0; FAILURES=0; PROVIDER_VERIFYS=0; PRODUCTION_VERIFYS=0; INPUT_VERIFYS=0; SKIPS=0
REPORT=""

record() { # status(pass|fail|verify_provider|verify_production|verify_input|env), name, detail
  local line
  case "$1" in
    pass)                PASSES=$((PASSES+1)); line="✓ PASS                                 $2 — $3" ;;
    fail)                FAILURES=$((FAILURES+1)); line="✗ FAIL                                 $2 — $3" ;;
    verify_provider)     PROVIDER_VERIFYS=$((PROVIDER_VERIFYS+1)); line="? VERIFICATION REQUIRED — PROVIDER     $2 — $3" ;;
    verify_production)   PRODUCTION_VERIFYS=$((PRODUCTION_VERIFYS+1)); line="? VERIFICATION REQUIRED — PRODUCTION   $2 — $3" ;;
    verify_input)        INPUT_VERIFYS=$((INPUT_VERIFYS+1)); line="? VERIFICATION REQUIRED — INPUT        $2 — $3" ;;
    env)                 SKIPS=$((SKIPS+1)); line="· NOT RUN — ENVIRONMENT                $2 — $3" ;;
    *)                   FAILURES=$((FAILURES+1)); line="✗ FAIL                                 $2 — bad status '$1'" ;;
  esac
  REPORT="${REPORT}${line}"$'\n'
  echo "$line"
}
note() { echo "      ↳ $1"; REPORT="${REPORT}      ↳ $1"$'\n'; }

have() { command -v "$1" >/dev/null 2>&1; }
src() { cat "$ROOT/$1" 2>/dev/null; }
http_code() {
  local code rc
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$@" 2>/dev/null)"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    printf 'transport-error:%s:%s' "$rc" "${code:-000}"
  else
    printf '%s' "$code"
  fi
}
code_of() { http_code "$@"; }

# Parse just the small, intentionally static TypeScript catalog contract without
# importing or executing the Stripe module. The installed TypeScript compiler provides
# decoded identifiers and public syntactic diagnostics; the remaining literal checks
# are insensitive to BSD/GNU sed differences, whitespace, line breaks, object-field
# order, and quote style. The parser fails closed on unresolved constants, partial
# entries, duplicate keys, extra fields, or an unrecognised planForPrice shape.
parse_catalog_model() {
  node - "$1" "$ROOT" <<'NODE'
const fs = require("node:fs");

try {
const path = process.argv[2];
const projectRoot = process.argv[3];
const original = fs.readFileSync(path, "utf8");
const ts = require(require.resolve("typescript", { paths: [projectRoot] }));
const ast = ts.createSourceFile(path, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const parseDiagnostics = (ts.transpileModule(original, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.Latest,
  },
  fileName: path,
  reportDiagnostics: true,
}).diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
if (parseDiagnostics.length !== 0) {
  const diagnostic = parseDiagnostics[0];
  const position = ast.getLineAndCharacterOfPosition(diagnostic.start || 0);
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  throw new Error(
    `TypeScript parse diagnostics (${parseDiagnostics.length}); first at ${position.line + 1}:${position.character + 1}: ${message}`,
  );
}

function stripComments(source) {
  let out = "";
  let quote = "";
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i++;
      out += " ";
      continue;
    }
    out += ch;
  }
  if (quote) throw new Error("unterminated string literal");
  return out;
}

function balanced(source, openAt, open, close) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = openAt; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i;
  }
  throw new Error(`unbalanced ${open}${close}`);
}

function splitTopLevelFields(body) {
  const fields = [];
  let start = 0;
  let quote = "";
  let escaped = false;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "`") throw new Error("template expressions are not allowed in catalog entries");
    if (ch === "{") braces++;
    else if (ch === "}" && --braces < 0) throw new Error("unbalanced catalog entry braces");
    else if (ch === "[") brackets++;
    else if (ch === "]" && --brackets < 0) throw new Error("unbalanced catalog entry brackets");
    else if (ch === "(") parens++;
    else if (ch === ")" && --parens < 0) throw new Error("unbalanced catalog entry parentheses");
    else if (ch === "," && braces === 0 && brackets === 0 && parens === 0) {
      fields.push(body.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || braces !== 0 || brackets !== 0 || parens !== 0) {
    throw new Error("unbalanced catalog field expression");
  }
  fields.push(body.slice(start));
  if (fields.length > 0 && fields[fields.length - 1].trim() === "") fields.pop();
  if (fields.some((field) => field.trim() === "")) throw new Error("blank catalog field");
  return fields;
}

function decodeQuoted(token) {
  const quote = token[0];
  if ((quote !== '"' && quote !== "'") || token[token.length - 1] !== quote) return null;
  const inner = token.slice(1, -1);
  if (/\\(?![\\'"nrtbfv0])/u.test(inner)) throw new Error(`unsupported escape in ${token}`);
  return inner.replace(/\\([\\'"nrtbfv0])/g, (_, ch) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" }[ch] ?? ch));
}

const stringConstants = new Map();
const numberConstants = new Map();
for (const statement of ast.statements) {
  if (
    !ts.isVariableStatement(statement) ||
    !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
    hasModifier(statement, ts.SyntaxKind.DeclareKeyword) ||
    !(statement.declarationList.flags & ts.NodeFlags.Const)
  ) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !/^[A-Z][A-Z0-9_]*$/.test(declaration.name.text)) continue;
    const name = declaration.name.text;
    const initializer = declaration.initializer && unwrapExpression(declaration.initializer);
    if (!initializer || (!ts.isStringLiteral(initializer) && !ts.isNumericLiteral(initializer))) continue;
    if (stringConstants.has(name) || numberConstants.has(name)) {
      throw new Error(`duplicate exported constant ${name}`);
    }
    if (ts.isStringLiteral(initializer)) stringConstants.set(name, initializer.text);
    else numberConstants.set(name, Number(initializer.text));
  }
}

function resolve(token, kind) {
  const value = token.trim();
  const quoted = decodeQuoted(value);
  if (kind === "string") {
    if (quoted !== null) return quoted;
    if (stringConstants.has(value)) return stringConstants.get(value);
  } else if (kind === "number") {
    if (/^[0-9]+$/.test(value)) return Number(value);
    if (numberConstants.has(value)) return numberConstants.get(value);
  } else if (kind === "interval" && value === "null") {
    return "null";
  }
  throw new Error(`unresolved ${kind} token ${value}`);
}

function walkAst(root, visitor) {
  visitor(root);
  ts.forEachChild(root, (child) => walkAst(child, visitor));
}

function hasModifier(node, kind) {
  return !!node.modifiers?.some((modifier) => modifier.kind === kind);
}

function staticPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return null;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      (typeof ts.isSatisfiesExpression === "function" && ts.isSatisfiesExpression(current))
    )
  ) {
    current = current.expression;
  }
  return current;
}

function staticString(node) {
  const expression = unwrapExpression(node);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      const embedded = staticString(span.expression);
      if (embedded === null) return null;
      value += embedded + span.literal.text;
    }
    return value;
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticString(expression.left);
    const right = staticString(expression.right);
    return left === null || right === null ? null : left + right;
  }
  return null;
}

function isAcceptedNonStaticElementAccess(node) {
  const target = unwrapExpression(node.expression);
  const argument = unwrapExpression(node.argumentExpression);
  if (ts.isNumericLiteral(argument)) return true;
  let functionAncestor = null;
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isFunctionLike(ancestor)) {
      functionAncestor = ancestor;
      break;
    }
  }
  const topLevelFunctionName = functionAncestor && ts.isFunctionDeclaration(functionAncestor) &&
    functionAncestor.parent === ast &&
    functionAncestor.name
    ? functionAncestor.name.text
    : null;
  if (ts.isIdentifier(target) && ts.isIdentifier(argument)) {
    return (topLevelFunctionName === "resolvePrice" && target.text === "PRICES" && argument.text === "key") ||
      (topLevelFunctionName === "resolveProduct" && target.text === "PRODUCTS" && argument.text === "productKey") ||
      (topLevelFunctionName === "reconcileTaxCodes" && target.text === "PRODUCTS" && argument.text === "key");
  }
  return topLevelFunctionName === "reconcileTaxCodes" &&
    ts.isIdentifier(target) &&
    target.text === "LEGACY_PRODUCT_NAMES" &&
    ts.isPropertyAccessExpression(argument) &&
    !argument.questionDotToken &&
    ts.isIdentifier(unwrapExpression(argument.expression)) &&
    unwrapExpression(argument.expression).text === "p" &&
    argument.name.text === "name";
}

function bindingNameContains(name, expected) {
  if (ts.isIdentifier(name)) return name.text === expected;
  return name.elements.some((element) =>
    ts.isBindingElement(element) && bindingNameContains(element.name, expected));
}

function declaresBindingName(node, expected) {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
    return bindingNameContains(node.name, expected);
  }
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node)
  ) {
    return !!node.name && ts.isIdentifier(node.name) && node.name.text === expected;
  }
  return false;
}

// The compiler decodes escaped identifiers before exposing Identifier.text. This
// makes PR\u0049CES the same identifier as PRICES and removes the raw-text escape
// hatch that regex token boundaries leave behind. Dynamic execution and runtime
// module loading are rejected structurally: neither can be used to manufacture a
// catalog identifier that does not occur as a decoded Identifier in this AST.
let dynamicEvaluation = null;
let computedRuntimeCapability = false;
let dynamicModuleLoading = false;
let unauthorizedStaticModuleLoading = false;
const reflectionCapabilities = new Set([
  "defineProperties",
  "defineProperty",
  "getOwnPropertyDescriptor",
  "getOwnPropertyDescriptors",
  "getPrototypeOf",
  "setPrototypeOf",
]);
const moduleCapabilities = new Set([
  "_compile",
  "_linkedBinding",
  "binding",
  "compileFunction",
  "createRequire",
  "dlopen",
  "getBuiltinModule",
  "require",
  "runInContext",
  "runInNewContext",
  "runInThisContext",
]);
walkAst(ast, (node) => {
  if (ts.isIdentifier(node) && (node.text === "eval" || node.text === "Function")) {
    dynamicEvaluation ||= node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    if (node.name.text === "constructor") {
      dynamicEvaluation ||= "constructor-derived Function";
    }
    if (reflectionCapabilities.has(node.name.text)) computedRuntimeCapability = true;
    if (moduleCapabilities.has(node.name.text)) dynamicModuleLoading = true;
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const capability = staticString(node.argumentExpression);
    if (capability === "eval" || capability === "Function" || capability === "constructor") {
      const directLiteral = ts.isStringLiteral(node.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(node.argumentExpression);
      if (!directLiteral) computedRuntimeCapability = true;
      dynamicEvaluation ||= capability === "constructor"
        ? "constructor-derived Function"
        : capability;
    }
    if (capability !== null && reflectionCapabilities.has(capability)) {
      computedRuntimeCapability = true;
    }
    if (capability !== null && moduleCapabilities.has(capability)) {
      dynamicModuleLoading = true;
    }
    if (capability === null && !isAcceptedNonStaticElementAccess(node)) {
      computedRuntimeCapability = true;
    }
  }
  if (ts.isBindingElement(node)) {
    let capability = null;
    let unknownComputedCapability = false;
    if (node.propertyName && ts.isComputedPropertyName(node.propertyName)) {
      capability = staticString(node.propertyName.expression);
      unknownComputedCapability = capability === null;
    } else if (node.propertyName) {
      capability = staticPropertyName(node.propertyName);
    } else if (ts.isIdentifier(node.name)) {
      capability = node.name.text;
    }
    if (
      unknownComputedCapability ||
      capability === "eval" ||
      capability === "Function" ||
      capability === "constructor" ||
      (capability !== null && reflectionCapabilities.has(capability))
    ) {
      computedRuntimeCapability = true;
    }
    if (capability !== null && moduleCapabilities.has(capability)) {
      dynamicModuleLoading = true;
    }
  }
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    let capability = null;
    let unknownComputedCapability = false;
    if (ts.isShorthandPropertyAssignment(node)) {
      capability = node.name.text;
    } else if (ts.isComputedPropertyName(node.name)) {
      capability = staticString(node.name.expression);
      unknownComputedCapability = capability === null;
    } else {
      capability = staticPropertyName(node.name);
    }
    if (
      unknownComputedCapability ||
      capability === "eval" ||
      capability === "Function" ||
      capability === "constructor" ||
      (capability !== null && reflectionCapabilities.has(capability))
    ) {
      computedRuntimeCapability = true;
    }
    if (capability !== null && moduleCapabilities.has(capability)) {
      dynamicModuleLoading = true;
    }
  }
  if (ts.isIdentifier(node) && (node.text === "globalThis" || node.text === "Reflect")) {
    computedRuntimeCapability = true;
  }
  if (
    ts.isIdentifier(node) &&
    (
      node.text === "require" ||
      node.text === "createRequire" ||
      node.text === "module" ||
      node.text === "exports"
    )
  ) {
    dynamicModuleLoading = true;
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const moduleCapability = staticString(node.argumentExpression);
    if (moduleCapability === "require" || moduleCapability === "createRequire") {
      dynamicModuleLoading = true;
    }
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    if (callee.kind === ts.SyntaxKind.ImportKeyword) dynamicModuleLoading = true;
    let calleeName = null;
    if (ts.isIdentifier(callee)) calleeName = callee.text;
    else if (ts.isPropertyAccessExpression(callee)) calleeName = callee.name.text;
    else if (ts.isElementAccessExpression(callee) && callee.argumentExpression) {
      calleeName = staticString(callee.argumentExpression);
    }
    if (calleeName === "require" || calleeName === "createRequire") dynamicModuleLoading = true;
  }
  if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    const clause = node.importClause;
    const acceptedStripeImport = node.parent === ast &&
      node.moduleSpecifier.text === "stripe" &&
      !!clause &&
      !clause.isTypeOnly &&
      !!clause.name &&
      clause.name.text === "Stripe" &&
      !clause.namedBindings &&
      !node.assertClause &&
      !node.attributes;
    if (!acceptedStripeImport) unauthorizedStaticModuleLoading = true;
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    unauthorizedStaticModuleLoading = true;
  }
});
if (dynamicModuleLoading || unauthorizedStaticModuleLoading) {
  throw new Error("dynamic module loading is not allowed in the catalog source");
}
if (computedRuntimeCapability) {
  throw new Error("dynamic evaluation through a global or computed runtime capability is not allowed");
}
if (dynamicEvaluation) {
  throw new Error(`dynamic evaluation via ${dynamicEvaluation} is not allowed in the catalog source`);
}

function initializerHasRuntimeEffect(initializer) {
  let unsafe = false;
  walkAst(initializer, (node) => {
    if (unsafe) return;
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isTaggedTemplateExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      ts.isDeleteExpression(node) ||
      ts.isFunctionLike(node) ||
      ts.isClassLike(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isSpreadAssignment(node) ||
      ts.isSpreadElement(node) ||
      ts.isComputedPropertyName(node)
    ) {
      unsafe = true;
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      unsafe = true;
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
    ) unsafe = true;
  });
  return unsafe;
}

const priceDeclarations = [];
const productCatalogDeclarations = [];
const productCatalogIdentifiers = [];
const legacyProductCatalogDeclarations = [];
const legacyProductCatalogIdentifiers = [];
const resolveProductFunctions = [];
const resolveProductIdentifiers = [];
const reconcileTaxCodesFunctions = [];
const reconcileTaxCodesIdentifiers = [];
const resolvePriceFunctions = [];
const resolvePriceIdentifiers = [];
const planForPriceFunctions = [];
const planForPriceIdentifiers = [];
walkAst(ast, (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "PRICES") {
    priceDeclarations.push(node);
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "PRODUCTS") {
    productCatalogDeclarations.push(node);
  }
  if (ts.isIdentifier(node) && node.text === "PRODUCTS") {
    productCatalogIdentifiers.push(node);
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "LEGACY_PRODUCT_NAMES"
  ) {
    legacyProductCatalogDeclarations.push(node);
  }
  if (ts.isIdentifier(node) && node.text === "LEGACY_PRODUCT_NAMES") {
    legacyProductCatalogIdentifiers.push(node);
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === "resolveProduct") {
    resolveProductFunctions.push(node);
  }
  if (ts.isIdentifier(node) && node.text === "resolveProduct") {
    resolveProductIdentifiers.push(node);
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === "reconcileTaxCodes") {
    reconcileTaxCodesFunctions.push(node);
  }
  if (ts.isIdentifier(node) && node.text === "reconcileTaxCodes") {
    reconcileTaxCodesIdentifiers.push(node);
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === "resolvePrice") {
    resolvePriceFunctions.push(node);
  }
  if (ts.isIdentifier(node) && node.text === "resolvePrice") {
    resolvePriceIdentifiers.push(node);
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === "planForPrice") {
    planForPriceFunctions.push(node);
  }
  if (ts.isIdentifier(node) && node.text === "planForPrice") {
    planForPriceIdentifiers.push(node);
  }
});

if (priceDeclarations.length !== 1) {
  throw new Error("catalog AST must contain exactly one PRICES declaration");
}
const priceDeclaration = priceDeclarations[0];
const priceDeclarationList = priceDeclaration.parent;
const priceStatement = priceDeclarationList.parent;
if (
  !ts.isVariableDeclarationList(priceDeclarationList) ||
  !(priceDeclarationList.flags & ts.NodeFlags.Const) ||
  priceDeclarationList.declarations.length !== 1 ||
  !ts.isVariableStatement(priceStatement) ||
  priceStatement.parent !== ast ||
  priceStatement.modifiers?.length !== 1 ||
  !hasModifier(priceStatement, ts.SyntaxKind.ExportKeyword) ||
  !priceDeclaration.initializer ||
  !ts.isObjectLiteralExpression(priceDeclaration.initializer)
) {
  throw new Error("PRICES must be one top-level exported const object declaration");
}

if (resolvePriceFunctions.length !== 1) {
  throw new Error("catalog AST must contain exactly one resolvePrice function declaration");
}
const resolvePriceFunction = resolvePriceFunctions[0];
if (
  resolvePriceFunction.parent !== ast ||
  resolvePriceFunction.modifiers?.length !== 2 ||
  !hasModifier(resolvePriceFunction, ts.SyntaxKind.ExportKeyword) ||
  !hasModifier(resolvePriceFunction, ts.SyntaxKind.AsyncKeyword) ||
  resolvePriceFunction.asteriskToken ||
  !resolvePriceFunction.body ||
  resolvePriceFunction.parameters.length !== 2 ||
  !ts.isIdentifier(resolvePriceFunction.parameters[0].name) ||
  resolvePriceFunction.parameters[0].name.text !== "stripe" ||
  resolvePriceFunction.parameters[0].dotDotDotToken ||
  resolvePriceFunction.parameters[0].questionToken ||
  resolvePriceFunction.parameters[0].initializer ||
  !ts.isIdentifier(resolvePriceFunction.parameters[1].name) ||
  resolvePriceFunction.parameters[1].name.text !== "key" ||
  resolvePriceFunction.parameters[1].dotDotDotToken ||
  resolvePriceFunction.parameters[1].questionToken ||
  resolvePriceFunction.parameters[1].initializer
) {
  throw new Error("resolvePrice must retain its top-level exported async (stripe, key) function shape");
}

function runtimeAstFingerprint(node) {
  if (!node || ts.isTypeNode(node) || ts.isTypeParameterDeclaration(node)) return "";
  const current = unwrapExpression(node);
  if (current !== node) return runtimeAstFingerprint(current);
  if (ts.isIdentifier(current)) return `Identifier(${JSON.stringify(current.text)})`;
  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current) ||
    ts.isNumericLiteral(current) ||
    ts.isRegularExpressionLiteral(current)
  ) return `${ts.SyntaxKind[current.kind]}(${JSON.stringify(current.text)})`;
  if (ts.isObjectLiteralExpression(current)) {
    return `ObjectLiteral(${current.properties.map(runtimeAstFingerprint).sort().join("|")})`;
  }
  const details = [];
  if (ts.isBinaryExpression(current)) details.push(`operator=${current.operatorToken.kind}`);
  if (ts.isPrefixUnaryExpression(current) || ts.isPostfixUnaryExpression(current)) {
    details.push(`operator=${current.operator}`);
  }
  if (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current) ||
    ts.isCallExpression(current)
  ) details.push(`optional=${current.questionDotToken ? 1 : 0}`);
  const children = [];
  ts.forEachChild(current, (child) => {
    const fingerprint = runtimeAstFingerprint(child);
    if (fingerprint) children.push(fingerprint);
  });
  return `${ts.SyntaxKind[current.kind]}[${details.join(",")}]{${children.join("|")}}`;
}

if (resolveProductFunctions.length !== 1) {
  throw new Error("resolveProduct must retain its exact top-level async implementation and sole resolver call");
}
const resolveProductFunction = resolveProductFunctions[0];

if (productCatalogDeclarations.length !== 1) {
  throw new Error("PRODUCTS must retain its exact top-level const catalog identity");
}
const productCatalogDeclaration = productCatalogDeclarations[0];
const productCatalogDeclarationList = productCatalogDeclaration.parent;
const productCatalogStatement = productCatalogDeclarationList.parent;
if (
  !ts.isVariableDeclarationList(productCatalogDeclarationList) ||
  !(productCatalogDeclarationList.flags & ts.NodeFlags.Const) ||
  productCatalogDeclarationList.declarations.length !== 1 ||
  !ts.isVariableStatement(productCatalogStatement) ||
  productCatalogStatement.parent !== ast ||
  productCatalogStatement.modifiers?.length ||
  !productCatalogDeclaration.initializer ||
  !ts.isObjectLiteralExpression(unwrapExpression(productCatalogDeclaration.initializer))
) {
  throw new Error("PRODUCTS must retain its exact top-level const catalog identity");
}
const expectedProductsSource = `
const PRODUCTS: Record<string, ProductDef> = {
  premium: {
    key: "premium",
    name: "CreditVector — Professional",
    description: "Unlimited AI-refined dispute letters, the AI dispute strategist, and 90-day progress tracking.",
    taxCode: TAX_CODE_SAAS_PERSONAL,
  },
  agency: {
    key: "agency",
    name: "CreditVector — Agency",
    description: "Manage clients in their own workspaces with the full analysis and letter engine. Up to 15 active client workspaces — built for solo operators.",
    taxCode: TAX_CODE_SAAS_BUSINESS,
  },
  agency_pro: {
    key: "agency_pro",
    name: "CreditVector — Agency Pro",
    description: "Everything in Agency with up to 40 active client workspaces, team collaboration, analytics, and bulk actions — built for growing teams.",
    taxCode: TAX_CODE_SAAS_BUSINESS,
  },
  letters_5: {
    key: "letters_5",
    name: "CreditVector — 5 Dispute Letters",
    description: "A one-time pack of 5 additional dispute letters.",
    taxCode: TAX_CODE_SAAS_PERSONAL,
  },
};
`;
const expectedProductsAst = ts.createSourceFile(
  "products-contract.ts",
  expectedProductsSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const expectedProductsStatement = expectedProductsAst.statements.find(ts.isVariableStatement);
const expectedProductsInitializer = expectedProductsStatement &&
  expectedProductsStatement.declarationList.declarations[0]?.initializer;
if (
  !expectedProductsInitializer ||
  runtimeAstFingerprint(productCatalogDeclaration.initializer) !==
    runtimeAstFingerprint(expectedProductsInitializer)
) {
  throw new Error("PRODUCTS body differs from the exact accepted runtime AST contract");
}

function validateTaxCodeBinding(name, envName, fallback) {
  const declarations = [];
  const identifiers = [];
  walkAst(ast, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      declarations.push(node);
    }
    if (ts.isIdentifier(node) && node.text === name) identifiers.push(node);
  });
  if (declarations.length !== 1) {
    throw new Error(`${name} must retain its exact exported environment/fallback binding`);
  }
  const declaration = declarations[0];
  const declarationList = declaration.parent;
  const statement = declarationList.parent;
  const initializer = declaration.initializer && unwrapExpression(declaration.initializer);
  if (
    !ts.isVariableDeclarationList(declarationList) ||
    !(declarationList.flags & ts.NodeFlags.Const) ||
    declarationList.declarations.length !== 1 ||
    !ts.isVariableStatement(statement) ||
    statement.parent !== ast ||
    statement.modifiers?.length !== 1 ||
    !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
    declaration.type ||
    declaration.exclamationToken ||
    !initializer ||
    !ts.isBinaryExpression(initializer) ||
    initializer.operatorToken.kind !== ts.SyntaxKind.BarBarToken ||
    !propertyPath(initializer.left, ["process", "env", envName]) ||
    !literalString(initializer.right, fallback)
  ) {
    throw new Error(`${name} must retain its exact exported environment/fallback binding`);
  }
  if (
    identifiers.length !== 3 ||
    identifiers[0] !== declaration.name ||
    identifiers.slice(1).some((identifier) => !containsAstNode(productCatalogDeclaration.initializer, identifier))
  ) {
    throw new Error(`${name} references differ from the exact product catalog contract`);
  }
}

const processBindings = [];
walkAst(ast, (node) => {
  if (declaresBindingName(node, "process")) processBindings.push(node);
});
if (processBindings.length !== 0) {
  throw new Error("tax-code environment bindings must use the unshadowed process intrinsic");
}
validateTaxCodeBinding(
  "TAX_CODE_SAAS_PERSONAL",
  "STRIPE_TAX_CODE_SAAS_PERSONAL",
  "txcd_10103000",
);
validateTaxCodeBinding(
  "TAX_CODE_SAAS_BUSINESS",
  "STRIPE_TAX_CODE_SAAS_BUSINESS",
  "txcd_10103001",
);

let resolveProductCatalogReadCount = 0;
let reconcileCatalogIndexReadCount = 0;
let reconcileCatalogValuesReadCount = 0;
for (const identifier of productCatalogIdentifiers) {
  if (identifier === productCatalogDeclaration.name) continue;
  const parent = identifier.parent;
  let functionAncestor = null;
  for (let ancestor = identifier.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isFunctionLike(ancestor)) {
      functionAncestor = ancestor;
      break;
    }
  }
  if (
    functionAncestor === resolveProductFunction &&
    ts.isElementAccessExpression(parent) &&
    parent.expression === identifier &&
    parent.argumentExpression &&
    identifierNamed(parent.argumentExpression, "productKey") &&
    !isMutationTarget(parent)
  ) {
    resolveProductCatalogReadCount++;
    continue;
  }
  if (
    ts.isFunctionDeclaration(functionAncestor) &&
    functionAncestor.name?.text === "reconcileTaxCodes" &&
    ts.isElementAccessExpression(parent) &&
    parent.expression === identifier &&
    parent.argumentExpression &&
    identifierNamed(parent.argumentExpression, "key") &&
    !isMutationTarget(parent)
  ) {
    reconcileCatalogIndexReadCount++;
    continue;
  }
  if (
    ts.isFunctionDeclaration(functionAncestor) &&
    functionAncestor.name?.text === "reconcileTaxCodes" &&
    ts.isCallExpression(parent) &&
    parent.arguments.length === 1 &&
    parent.arguments[0] === identifier &&
    propertyPath(parent.expression, ["Object", "values"])
  ) {
    reconcileCatalogValuesReadCount++;
    continue;
  }
  throw new Error("executable PRODUCTS reference outside the accepted product resolver reads");
}
if (
  resolveProductCatalogReadCount !== 1 ||
  !(
    (reconcileCatalogIndexReadCount === 0 && reconcileCatalogValuesReadCount === 0) ||
    (reconcileCatalogIndexReadCount === 1 && reconcileCatalogValuesReadCount === 1)
  )
) {
  throw new Error("PRODUCTS reference count differs from the exact accepted runtime AST contract");
}

const hasReconciliationCatalogReads = reconcileCatalogIndexReadCount === 1 &&
  reconcileCatalogValuesReadCount === 1;
if (!hasReconciliationCatalogReads) {
  if (reconcileTaxCodesFunctions.length !== 0 || reconcileTaxCodesIdentifiers.length !== 0) {
    throw new Error("reconcileTaxCodes must be absent when its exact catalog reads are absent");
  }
} else {
  if (reconcileTaxCodesFunctions.length !== 1 || reconcileTaxCodesIdentifiers.length !== 1) {
    throw new Error("reconcileTaxCodes must retain its exact top-level exported async identity");
  }
  const reconcileTaxCodesFunction = reconcileTaxCodesFunctions[0];
  if (
    reconcileTaxCodesIdentifiers[0] !== reconcileTaxCodesFunction.name ||
    reconcileTaxCodesFunction.parent !== ast ||
    reconcileTaxCodesFunction.modifiers?.length !== 2 ||
    !hasModifier(reconcileTaxCodesFunction, ts.SyntaxKind.ExportKeyword) ||
    !hasModifier(reconcileTaxCodesFunction, ts.SyntaxKind.AsyncKeyword) ||
    reconcileTaxCodesFunction.asteriskToken ||
    !reconcileTaxCodesFunction.body ||
    reconcileTaxCodesFunction.parameters.length !== 1 ||
    !ts.isIdentifier(reconcileTaxCodesFunction.parameters[0].name) ||
    reconcileTaxCodesFunction.parameters[0].name.text !== "stripe" ||
    reconcileTaxCodesFunction.parameters[0].modifiers?.length ||
    reconcileTaxCodesFunction.parameters[0].dotDotDotToken ||
    reconcileTaxCodesFunction.parameters[0].questionToken ||
    reconcileTaxCodesFunction.parameters[0].initializer
  ) {
    throw new Error("reconcileTaxCodes must retain its exact top-level exported async identity");
  }
  const expectedReconcileSource = `
export async function reconcileTaxCodes(stripe: any): Promise<string[]> {
  const list = await stripe.products.list({ active: true, limit: 100 });
  const updated: string[] = [];
  for (const p of list.data) {
    const key = p.metadata?.gcl_product || LEGACY_PRODUCT_NAMES[p.name] || (Object.values(PRODUCTS).find((d) => d.name === p.name)?.key ?? "");
    const def = key ? PRODUCTS[key] : undefined;
    if (!def) continue;
    const update: any = {};
    const currentTax = typeof p.tax_code === "string" ? p.tax_code : p.tax_code?.id ?? null;
    if (def.taxCode && currentTax !== def.taxCode) update.tax_code = def.taxCode;
    if (p.description !== def.description) update.description = def.description;
    if (p.name !== def.name) update.name = def.name;
    if (Object.keys(update).length > 0) {
      await stripe.products.update(p.id, update);
      updated.push(p.name);
    }
  }
  return updated;
}
`;
  const expectedReconcileAst = ts.createSourceFile(
    "reconcile-tax-contract.ts",
    expectedReconcileSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const expectedReconcileFunction = expectedReconcileAst.statements.find(ts.isFunctionDeclaration);
  if (
    !expectedReconcileFunction?.body ||
    runtimeAstFingerprint(reconcileTaxCodesFunction.body) !==
      runtimeAstFingerprint(expectedReconcileFunction.body)
  ) {
    throw new Error("reconcileTaxCodes body differs from the exact accepted runtime AST contract");
  }
}

if (legacyProductCatalogIdentifiers.length === 0) {
  if (legacyProductCatalogDeclarations.length !== 0) {
    throw new Error("LEGACY_PRODUCT_NAMES must retain its exact optional catalog identity");
  }
} else {
  if (legacyProductCatalogDeclarations.length !== 1 || legacyProductCatalogIdentifiers.length !== 2) {
    throw new Error("LEGACY_PRODUCT_NAMES must retain its exact optional catalog identity");
  }
  const legacyDeclaration = legacyProductCatalogDeclarations[0];
  const legacyDeclarationList = legacyDeclaration.parent;
  const legacyStatement = legacyDeclarationList.parent;
  const expectedLegacyAst = ts.createSourceFile(
    "legacy-products-contract.ts",
    `const LEGACY_PRODUCT_NAMES: Record<string, string> = {
      "Gabriel Capital Labs — Premium": "premium",
      "Gabriel Capital Labs — Agency": "agency",
    };`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const expectedLegacyStatement = expectedLegacyAst.statements.find(ts.isVariableStatement);
  const expectedLegacyInitializer = expectedLegacyStatement &&
    expectedLegacyStatement.declarationList.declarations[0]?.initializer;
  if (
    !ts.isVariableDeclarationList(legacyDeclarationList) ||
    !(legacyDeclarationList.flags & ts.NodeFlags.Const) ||
    legacyDeclarationList.declarations.length !== 1 ||
    !ts.isVariableStatement(legacyStatement) ||
    legacyStatement.parent !== ast ||
    legacyStatement.modifiers?.length ||
    !legacyDeclaration.initializer ||
    !expectedLegacyInitializer ||
    runtimeAstFingerprint(legacyDeclaration.initializer) !== runtimeAstFingerprint(expectedLegacyInitializer)
  ) {
    throw new Error("LEGACY_PRODUCT_NAMES must retain its exact optional catalog identity");
  }
  const legacyReference = legacyProductCatalogIdentifiers.find(
    (identifier) => identifier !== legacyDeclaration.name,
  );
  const legacyAccess = legacyReference && legacyReference.parent;
  let legacyFunctionAncestor = null;
  for (let ancestor = legacyReference?.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isFunctionLike(ancestor)) {
      legacyFunctionAncestor = ancestor;
      break;
    }
  }
  if (
    !legacyReference ||
    !ts.isElementAccessExpression(legacyAccess) ||
    legacyAccess.expression !== legacyReference ||
    !legacyAccess.argumentExpression ||
    !ts.isPropertyAccessExpression(unwrapExpression(legacyAccess.argumentExpression)) ||
    !propertyPath(legacyAccess.argumentExpression, ["p", "name"]) ||
    !ts.isFunctionDeclaration(legacyFunctionAncestor) ||
    legacyFunctionAncestor.parent !== ast ||
    legacyFunctionAncestor.name?.text !== "reconcileTaxCodes" ||
    isMutationTarget(legacyAccess)
  ) {
    throw new Error("LEGACY_PRODUCT_NAMES reference differs from the exact accepted reconciliation read");
  }
}

if (resolveProductIdentifiers.length !== 2) {
  throw new Error("resolveProduct must retain its exact top-level async implementation and sole resolver call");
}
const resolveProductReference = resolveProductIdentifiers.find(
  (identifier) => identifier !== resolveProductFunction.name,
);
if (
  resolveProductFunction.parent !== ast ||
  resolveProductFunction.modifiers?.length !== 1 ||
  !hasModifier(resolveProductFunction, ts.SyntaxKind.AsyncKeyword) ||
  hasModifier(resolveProductFunction, ts.SyntaxKind.ExportKeyword) ||
  resolveProductFunction.asteriskToken ||
  !resolveProductFunction.body ||
  resolveProductFunction.parameters.length !== 2 ||
  !ts.isIdentifier(resolveProductFunction.parameters[0].name) ||
  resolveProductFunction.parameters[0].name.text !== "stripe" ||
  resolveProductFunction.parameters[0].modifiers?.length ||
  resolveProductFunction.parameters[0].dotDotDotToken ||
  resolveProductFunction.parameters[0].questionToken ||
  resolveProductFunction.parameters[0].initializer ||
  !ts.isIdentifier(resolveProductFunction.parameters[1].name) ||
  resolveProductFunction.parameters[1].name.text !== "productKey" ||
  resolveProductFunction.parameters[1].modifiers?.length ||
  resolveProductFunction.parameters[1].dotDotDotToken ||
  resolveProductFunction.parameters[1].questionToken ||
  resolveProductFunction.parameters[1].initializer ||
  !resolveProductReference ||
  !ts.isCallExpression(resolveProductReference.parent) ||
  resolveProductReference.parent.expression !== resolveProductReference ||
  !containsAstNode(resolvePriceFunction.body, resolveProductReference)
) {
  throw new Error("resolveProduct must retain its exact top-level async implementation and sole resolver call");
}
const expectedResolveProductSource = `
async function resolveProduct(stripe: any, productKey: string): Promise<string> {
  const def = PRODUCTS[productKey];
  const list = await stripe.products.list({ active: true, limit: 100 });
  const existing = list.data.find((p) => p.metadata?.gcl_product === productKey || p.name === def.name);
  if (existing) {
    const current = typeof existing.tax_code === "string" ? existing.tax_code : existing.tax_code?.id ?? null;
    if (def.taxCode && current !== def.taxCode) {
      await stripe.products.update(existing.id, { tax_code: def.taxCode });
    }
    return existing.id;
  }
  const created = await stripe.products.create({
    name: def.name,
    description: def.description,
    tax_code: def.taxCode,
    metadata: { gcl_product: productKey },
  });
  return created.id;
}
`;
const expectedResolveProductAst = ts.createSourceFile(
  "resolve-product-contract.ts",
  expectedResolveProductSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const expectedResolveProductFunction = expectedResolveProductAst.statements.find(ts.isFunctionDeclaration);
if (
  !expectedResolveProductFunction?.body ||
  runtimeAstFingerprint(resolveProductFunction.body) !==
    runtimeAstFingerprint(expectedResolveProductFunction.body)
) {
  throw new Error("resolveProduct body differs from the exact accepted runtime AST contract");
}

let keyIsShadowed = false;
walkAst(resolvePriceFunction.body, (node) => {
  if (declaresBindingName(node, "key")) keyIsShadowed = true;
});
if (keyIsShadowed) {
  throw new Error("resolvePrice key parameter must not be shadowed");
}

const defDeclarations = [];
walkAst(resolvePriceFunction.body, (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "def") {
    defDeclarations.push(node);
  }
});
if (defDeclarations.length !== 1) {
  throw new Error("resolvePrice must contain exactly one canonical def binding");
}
const defDeclaration = defDeclarations[0];
const defDeclarationList = defDeclaration.parent;
const defStatement = defDeclarationList.parent;
const defInitializer = defDeclaration.initializer;
if (
  !ts.isVariableDeclarationList(defDeclarationList) ||
  !(defDeclarationList.flags & ts.NodeFlags.Const) ||
  defDeclarationList.declarations.length !== 1 ||
  !ts.isVariableStatement(defStatement) ||
  defStatement.parent !== resolvePriceFunction.body ||
  !!defStatement.modifiers?.length ||
  !defInitializer ||
  !ts.isElementAccessExpression(defInitializer) ||
  defInitializer.questionDotToken ||
  !ts.isIdentifier(defInitializer.expression) ||
  defInitializer.expression.text !== "PRICES" ||
  !defInitializer.argumentExpression ||
  !ts.isIdentifier(defInitializer.argumentExpression) ||
  defInitializer.argumentExpression.text !== "key"
) {
  throw new Error("catalog must contain exactly one canonical executable PRICES read");
}

const priceIdentifiers = [];
walkAst(ast, (node) => {
  if (ts.isIdentifier(node) && node.text === "PRICES") priceIdentifiers.push(node);
});
const allowedPriceIdentifiers = new Set([priceDeclaration.name, defInitializer.expression]);
if (
  priceIdentifiers.length !== 2 ||
  priceIdentifiers.some((identifier) => !allowedPriceIdentifiers.has(identifier))
) {
  throw new Error("executable PRICES reference outside the one accepted read");
}

function containsAstNode(ancestor, descendant) {
  return descendant.pos >= ancestor.pos && descendant.end <= ancestor.end;
}

function isMutationTarget(access) {
  for (let current = access; current && current !== resolvePriceFunction.body; current = current.parent) {
    const parent = current.parent;
    if (!parent) break;
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      containsAstNode(parent.left, access)
    ) return true;
    if (
      (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
      (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken) &&
      containsAstNode(parent.operand, access)
    ) return true;
    if (ts.isDeleteExpression(parent) && containsAstNode(parent.expression, access)) return true;
    if (
      (ts.isForInStatement(parent) || ts.isForOfStatement(parent)) &&
      containsAstNode(parent.initializer, access)
    ) return true;
  }
  return false;
}

const defIdentifiers = [];
walkAst(resolvePriceFunction.body, (node) => {
  if (ts.isIdentifier(node) && node.text === "def") defIdentifiers.push(node);
});
const acceptedDefReadCounts = new Map([
  ["lookup", 2],
  ["product", 1],
  ["amountCents", 1],
  ["interval", 2],
]);
const actualDefReadCounts = new Map([...acceptedDefReadCounts.keys()].map((field) => [field, 0]));
const actualDefReadNodes = new Map([...acceptedDefReadCounts.keys()].map((field) => [field, []]));
let defGuardCount = 0;
let defGuardStatement = null;
let defGuardThrow = null;
function isCanonicalDefGuardThrow(statement) {
  if (!ts.isThrowStatement(statement) || !statement.expression) return false;
  const thrown = unwrapExpression(statement.expression);
  if (
    !ts.isNewExpression(thrown) ||
    !identifierNamed(thrown.expression, "Error") ||
    thrown.typeArguments?.length ||
    !thrown.arguments ||
    thrown.arguments.length !== 1
  ) return false;
  const message = unwrapExpression(thrown.arguments[0]);
  if (ts.isStringLiteral(message)) return message.text === "Unknown price key";
  return ts.isTemplateExpression(message) &&
    message.head.text === "Unknown price key: " &&
    message.templateSpans.length === 1 &&
    identifierNamed(message.templateSpans[0].expression, "key") &&
    message.templateSpans[0].literal.text === "";
}
function nearestFunctionLikeAncestor(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) return parent;
  }
  return null;
}
function isErasedTypeContext(node) {
  for (let parent = node.parent; parent && parent !== resolvePriceFunction.body; parent = parent.parent) {
    if (
      ts.isTypeNode(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeParameterDeclaration(parent) ||
      hasModifier(parent, ts.SyntaxKind.DeclareKeyword)
    ) return true;
  }
  return false;
}

function exactPlanIntervalTemplate(node) {
  const expression = unwrapExpression(node);
  return ts.isTemplateExpression(expression) &&
    expression.head.text === "" &&
    expression.templateSpans.length === 2 &&
    identifierNamed(expression.templateSpans[0].expression, "plan") &&
    expression.templateSpans[0].literal.text === "_" &&
    identifierNamed(expression.templateSpans[1].expression, "interval") &&
    expression.templateSpans[1].literal.text === "";
}

function exactResolveWrapperSignature(wrapper, wrapperName) {
  if (
    wrapper.modifiers?.length !== 2 ||
    !hasModifier(wrapper, ts.SyntaxKind.ExportKeyword) ||
    !hasModifier(wrapper, ts.SyntaxKind.AsyncKeyword) ||
    wrapper.asteriskToken ||
    !wrapper.body
  ) return false;
  const expectedParameters = wrapperName === "resolvePriceId"
    ? ["stripe", "plan", "interval"]
    : ["stripe"];
  if (wrapper.parameters.length !== expectedParameters.length) return false;
  for (let index = 0; index < expectedParameters.length; index++) {
    const parameter = wrapper.parameters[index];
    if (
      parameter.modifiers?.length ||
      !ts.isIdentifier(parameter.name) ||
      parameter.name.text !== expectedParameters[index] ||
      parameter.dotDotDotToken ||
      parameter.questionToken
    ) return false;
    if (wrapperName === "resolvePriceId" && index === 2) {
      if (!parameter.initializer || !literalString(parameter.initializer, "month")) return false;
    } else if (parameter.initializer) {
      return false;
    }
  }
  return true;
}

const acceptedResolvePriceWrappers = new Map();
for (const identifier of resolvePriceIdentifiers) {
  if (identifier === resolvePriceFunction.name) continue;
  const call = identifier.parent;
  const returned = call && call.parent;
  const wrapper = nearestFunctionLikeAncestor(identifier);
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.expression !== identifier ||
    call.questionDotToken ||
    call.typeArguments?.length ||
    call.arguments.length !== 2 ||
    !returned ||
    !ts.isReturnStatement(returned) ||
    returned.expression !== call ||
    !wrapper ||
    !ts.isFunctionDeclaration(wrapper) ||
    wrapper.parent !== ast ||
    !wrapper.name ||
    !wrapper.body ||
    wrapper.body.statements.length !== 1 ||
    wrapper.body.statements[0] !== returned ||
    !exactResolveWrapperSignature(wrapper, wrapper.name.text) ||
    !identifierNamed(call.arguments[0], "stripe") ||
    acceptedResolvePriceWrappers.has(wrapper.name.text)
  ) {
    throw new Error("resolvePrice must retain its exact exported binding identity and accepted direct callers");
  }
  const wrapperName = wrapper.name.text;
  const acceptedSecondArgument =
    (wrapperName === "resolvePriceId" && exactPlanIntervalTemplate(call.arguments[1])) ||
    (wrapperName === "resolvePremiumPriceId" && literalString(call.arguments[1], "premium_month")) ||
    (wrapperName === "resolveAgencyPriceId" && literalString(call.arguments[1], "agency_month"));
  if (!acceptedSecondArgument) {
    throw new Error("resolvePrice must retain its exact exported binding identity and accepted direct callers");
  }
  acceptedResolvePriceWrappers.set(wrapperName, wrapper);
}
const expectedResolvePriceWrappers = [
  "resolveAgencyPriceId",
  "resolvePremiumPriceId",
  "resolvePriceId",
];
const resolveWrapperDeclarations = new Map(expectedResolvePriceWrappers.map((name) => [name, []]));
for (const statement of ast.statements) {
  if (
    ts.isFunctionDeclaration(statement) &&
    statement.name &&
    resolveWrapperDeclarations.has(statement.name.text)
  ) {
    resolveWrapperDeclarations.get(statement.name.text).push(statement);
  }
}
if (
  (resolvePriceIdentifiers.length === 1 &&
    [...resolveWrapperDeclarations.values()].some((declarations) => declarations.length !== 0)) ||
  (resolvePriceIdentifiers.length !== 1 &&
    (resolvePriceIdentifiers.length !== 4 ||
      JSON.stringify([...acceptedResolvePriceWrappers.keys()].sort()) !==
        JSON.stringify([...expectedResolvePriceWrappers].sort()) ||
      expectedResolvePriceWrappers.some((name) => {
        const declarations = resolveWrapperDeclarations.get(name);
        return declarations.length !== 1 || declarations[0] !== acceptedResolvePriceWrappers.get(name);
      })))
) {
  throw new Error("resolvePrice must retain its exact exported binding identity and accepted direct callers");
}
for (const identifier of defIdentifiers) {
  if (identifier === defDeclaration.name) continue;
  if (nearestFunctionLikeAncestor(identifier) !== resolvePriceFunction) {
    throw new Error("resolvePrice def binding may not escape into a nested function or closure");
  }
  if (isErasedTypeContext(identifier)) {
    throw new Error("resolvePrice def property reads must be runtime value expressions, not erased type evidence");
  }
  const parent = identifier.parent;
  if (
    ts.isPrefixUnaryExpression(parent) &&
    parent.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIfStatement(parent.parent) &&
    parent.parent.expression === parent &&
    ts.isThrowStatement(parent.parent.thenStatement) &&
    !parent.parent.elseStatement
  ) {
    if (!isCanonicalDefGuardThrow(parent.parent.thenStatement)) {
      throw new Error("resolvePrice def guard must throw only the canonical Error");
    }
    defGuardCount++;
    defGuardStatement = parent.parent;
    defGuardThrow = parent.parent.thenStatement;
    continue;
  }

  let access = null;
  let field = null;
  if (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === identifier &&
    !parent.questionDotToken
  ) {
    access = parent;
    field = parent.name.text;
  } else if (
    ts.isElementAccessExpression(parent) &&
    parent.expression === identifier &&
    !parent.questionDotToken &&
    parent.argumentExpression &&
    (ts.isStringLiteral(parent.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(parent.argumentExpression))
  ) {
    access = parent;
    field = parent.argumentExpression.text;
  }

  if (!access || !acceptedDefReadCounts.has(field)) {
    throw new Error("resolvePrice def binding may not escape, alias, be passed, returned, or be used outside accepted property reads");
  }
  if (isMutationTarget(access)) {
    throw new Error("executable catalog mutation through the accepted PRICES read");
  }
  actualDefReadCounts.set(field, actualDefReadCounts.get(field) + 1);
  actualDefReadNodes.get(field).push(access);
}
if (defGuardCount !== 1) {
  throw new Error("resolvePrice must retain exactly one fail-closed def guard");
}
const errorIdentifiers = [];
walkAst(ast, (node) => {
  if (ts.isIdentifier(node) && node.text === "Error") errorIdentifiers.push(node);
});
const guardErrorConstruction = defGuardThrow &&
  ts.isThrowStatement(defGuardThrow) &&
  defGuardThrow.expression &&
  unwrapExpression(defGuardThrow.expression);
if (
  errorIdentifiers.length !== 1 ||
  !guardErrorConstruction ||
  !ts.isNewExpression(guardErrorConstruction) ||
  errorIdentifiers[0] !== guardErrorConstruction.expression
) {
  throw new Error("resolvePrice def guard must use the unshadowed intrinsic Error constructor");
}
for (const [field, expectedCount] of acceptedDefReadCounts) {
  if (actualDefReadCounts.get(field) !== expectedCount) {
    throw new Error(`resolvePrice ${field} read count differs from the accepted AST shape`);
  }
}

function singleConstInitializer(statement, expectedName) {
  if (
    !ts.isVariableStatement(statement) ||
    statement.modifiers?.length ||
    !(statement.declarationList.flags & ts.NodeFlags.Const) ||
    statement.declarationList.declarations.length !== 1
  ) return null;
  const declaration = statement.declarationList.declarations[0];
  if (
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== expectedName ||
    declaration.exclamationToken ||
    !declaration.initializer
  ) return null;
  return declaration.initializer;
}

function identifierNamed(node, expected) {
  const expression = unwrapExpression(node);
  return ts.isIdentifier(expression) && expression.text === expected;
}

function propertyPath(node, expectedParts) {
  let expression = unwrapExpression(node);
  const actualParts = [];
  while (ts.isPropertyAccessExpression(expression) && !expression.questionDotToken) {
    actualParts.unshift(expression.name.text);
    expression = unwrapExpression(expression.expression);
  }
  if (!ts.isIdentifier(expression)) return false;
  actualParts.unshift(expression.text);
  return JSON.stringify(actualParts) === JSON.stringify(expectedParts);
}

function literalNumber(node, expected) {
  const expression = unwrapExpression(node);
  return ts.isNumericLiteral(expression) && Number(expression.text) === expected;
}

function literalString(node, expected) {
  const expression = unwrapExpression(node);
  return ts.isStringLiteral(expression) && expression.text === expected;
}

function returnedExpression(statement) {
  let candidate = statement;
  if (ts.isBlock(candidate)) {
    if (candidate.statements.length !== 1) return null;
    candidate = candidate.statements[0];
  }
  return ts.isReturnStatement(candidate) && candidate.expression
    ? candidate.expression
    : null;
}

function exactPropertyAssignment(node, expectedName) {
  return ts.isPropertyAssignment(node) &&
    !node.questionToken &&
    !node.exclamationToken &&
    staticPropertyName(node.name) === expectedName
    ? node.initializer
    : null;
}

function exactPropertyMap(object, expectedNames) {
  if (!ts.isObjectLiteralExpression(object) || object.properties.length !== expectedNames.length) return null;
  const expected = new Set(expectedNames);
  const properties = new Map();
  for (const property of object.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      property.questionToken ||
      property.exclamationToken ||
      staticPropertyName(property.name) === null ||
      !expected.has(staticPropertyName(property.name)) ||
      properties.has(staticPropertyName(property.name))
    ) return null;
    properties.set(staticPropertyName(property.name), property.initializer);
  }
  return properties;
}

function exactResolverListInitializer(node) {
  const expression = unwrapExpression(node);
  if (!ts.isAwaitExpression(expression)) return false;
  const call = unwrapExpression(expression.expression);
  if (
    !ts.isCallExpression(call) ||
    call.questionDotToken ||
    call.typeArguments?.length ||
    !propertyPath(call.expression, ["stripe", "prices", "list"]) ||
    call.arguments.length !== 1
  ) return false;
  const options = unwrapExpression(call.arguments[0]);
  const properties = exactPropertyMap(options, ["lookup_keys", "active", "limit"]);
  if (!properties) return false;
  const lookupKeys = properties.get("lookup_keys");
  const active = properties.get("active");
  const limit = properties.get("limit");
  const lookupArray = unwrapExpression(lookupKeys);
  return ts.isArrayLiteralExpression(lookupArray) &&
    lookupArray.elements.length === 1 &&
    propertyPath(lookupArray.elements[0], ["def", "lookup"]) &&
    unwrapExpression(active).kind === ts.SyntaxKind.TrueKeyword &&
    literalNumber(limit, 1);
}

function exactResolverExistingGuard(statement) {
  if (!ts.isIfStatement(statement) || statement.elseStatement) return false;
  const condition = unwrapExpression(statement.expression);
  const returned = returnedExpression(statement.thenStatement);
  if (!returned) return false;
  function isExistingDataAtZero(node) {
    const access = unwrapExpression(node);
    return ts.isElementAccessExpression(access) &&
      !access.questionDotToken &&
      propertyPath(access.expression, ["existing", "data"]) &&
      !!access.argumentExpression &&
      literalNumber(access.argumentExpression, 0);
  }
  const returnedAccess = unwrapExpression(returned);
  return isExistingDataAtZero(condition) &&
    ts.isPropertyAccessExpression(returnedAccess) &&
    !returnedAccess.questionDotToken &&
    returnedAccess.name.text === "id" &&
    isExistingDataAtZero(returnedAccess.expression);
}

function exactResolverProductInitializer(node) {
  const expression = unwrapExpression(node);
  if (!ts.isAwaitExpression(expression)) return false;
  const call = unwrapExpression(expression.expression);
  return ts.isCallExpression(call) &&
    !call.questionDotToken &&
    !call.typeArguments?.length &&
    call.expression === resolveProductReference &&
    call.arguments.length === 2 &&
    identifierNamed(call.arguments[0], "stripe") &&
    propertyPath(call.arguments[1], ["def", "product"]);
}

function exactRecurringSpread(node) {
  if (!ts.isSpreadAssignment(node)) return false;
  const conditional = unwrapExpression(node.expression);
  if (!ts.isConditionalExpression(conditional)) return false;
  if (!propertyPath(conditional.condition, ["def", "interval"])) return false;
  const whenTrue = unwrapExpression(conditional.whenTrue);
  const whenFalse = unwrapExpression(conditional.whenFalse);
  if (
    !ts.isObjectLiteralExpression(whenTrue) ||
    whenTrue.properties.length !== 1 ||
    !ts.isObjectLiteralExpression(whenFalse) ||
    whenFalse.properties.length !== 0
  ) return false;
  const recurring = exactPropertyAssignment(whenTrue.properties[0], "recurring");
  const recurringObject = recurring && unwrapExpression(recurring);
  if (!recurringObject || !ts.isObjectLiteralExpression(recurringObject) || recurringObject.properties.length !== 1) {
    return false;
  }
  const interval = exactPropertyAssignment(recurringObject.properties[0], "interval");
  return !!interval && propertyPath(interval, ["def", "interval"]);
}

function exactResolverCreateInitializer(node) {
  const expression = unwrapExpression(node);
  if (!ts.isAwaitExpression(expression)) return false;
  const call = unwrapExpression(expression.expression);
  if (
    !ts.isCallExpression(call) ||
    call.questionDotToken ||
    call.typeArguments?.length ||
    !propertyPath(call.expression, ["stripe", "prices", "create"]) ||
    call.arguments.length !== 1
  ) return false;
  const options = unwrapExpression(call.arguments[0]);
  if (!ts.isObjectLiteralExpression(options) || options.properties.length !== 5) return false;
  let productCount = 0;
  let recurringCount = 0;
  const properties = new Map();
  for (const property of options.properties) {
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === "product" &&
      !property.objectAssignmentInitializer
    ) {
      productCount++;
      continue;
    }
    if (ts.isSpreadAssignment(property)) {
      if (!exactRecurringSpread(property)) return false;
      recurringCount++;
      continue;
    }
    if (
      !ts.isPropertyAssignment(property) ||
      property.questionToken ||
      property.exclamationToken ||
      staticPropertyName(property.name) === null ||
      !["unit_amount", "currency", "lookup_key"].includes(staticPropertyName(property.name)) ||
      properties.has(staticPropertyName(property.name))
    ) return false;
    properties.set(staticPropertyName(property.name), property.initializer);
  }
  const amount = properties.get("unit_amount");
  const currency = properties.get("currency");
  const lookup = properties.get("lookup_key");
  return productCount === 1 && recurringCount === 1 && properties.size === 3 &&
    !!amount && propertyPath(amount, ["def", "amountCents"]) &&
    !!currency && literalString(currency, "usd") &&
    !!lookup && propertyPath(lookup, ["def", "lookup"]);
}

const keyIdentifiers = [];
walkAst(resolvePriceFunction.body, (node) => {
  if (ts.isIdentifier(node) && node.text === "key") keyIdentifiers.push(node);
});
for (const identifier of keyIdentifiers) {
  if (identifier !== defInitializer.argumentExpression && isMutationTarget(identifier)) {
    throw new Error("resolvePrice key parameter has an unaccepted runtime use");
  }
}

const resolverStatements = [...resolvePriceFunction.body.statements];
const existingInitializer = resolverStatements.length > 2
  ? singleConstInitializer(resolverStatements[2], "existing")
  : null;
const productInitializer = resolverStatements.length > 4
  ? singleConstInitializer(resolverStatements[4], "product")
  : null;
const createdPriceInitializer = resolverStatements.length > 5
  ? singleConstInitializer(resolverStatements[5], "price")
  : null;
const finalResolverReturn = resolverStatements.length > 6
  ? returnedExpression(resolverStatements[6])
  : null;
if (
  resolverStatements.length !== 7 ||
  resolverStatements[0] !== defStatement ||
  resolverStatements[1] !== defGuardStatement ||
  !existingInitializer ||
  !exactResolverListInitializer(existingInitializer) ||
  !exactResolverExistingGuard(resolverStatements[3]) ||
  !productInitializer ||
  !exactResolverProductInitializer(productInitializer) ||
  !createdPriceInitializer ||
  !exactResolverCreateInitializer(createdPriceInitializer) ||
  !finalResolverReturn ||
  !propertyPath(finalResolverReturn, ["price", "id"])
) {
  throw new Error("resolvePrice body differs from the exact accepted AST statement/control-flow shape");
}

const acceptedDefReadPlacements = new Map([
  ["lookup", [resolverStatements[2], resolverStatements[5]]],
  ["product", [resolverStatements[4]]],
  ["amountCents", [resolverStatements[5]]],
  ["interval", [resolverStatements[5], resolverStatements[5]]],
]);
for (const [field, expectedContainers] of acceptedDefReadPlacements) {
  const reads = actualDefReadNodes.get(field);
  const unmatchedContainers = [...expectedContainers];
  for (const read of reads) {
    const containerAt = unmatchedContainers.findIndex((container) => containsAstNode(container, read));
    if (containerAt < 0) {
      throw new Error(`resolvePrice ${field} read placement differs from the accepted AST shape`);
    }
    unmatchedContainers.splice(containerAt, 1);
  }
  if (unmatchedContainers.length !== 0) {
    throw new Error(`resolvePrice ${field} read placement differs from the accepted AST shape`);
  }
}

for (const identifier of keyIdentifiers) {
  if (identifier === defInitializer.argumentExpression) continue;
  const acceptedGuardMessageRead = !!defGuardThrow &&
    containsAstNode(defGuardThrow, identifier) &&
    ts.isTemplateSpan(identifier.parent) &&
    identifier.parent.expression === identifier;
  if (!acceptedGuardMessageRead || isMutationTarget(identifier)) {
    throw new Error("resolvePrice key parameter has an unaccepted runtime use");
  }
}
if (keyIdentifiers.length < 1 || keyIdentifiers.length > 2) {
  throw new Error("resolvePrice key parameter has an unaccepted runtime use");
}

const pricesInitializerStart = priceDeclaration.initializer.getStart(ast);
const pricesBody = stripComments(original.slice(pricesInitializerStart + 1, priceDeclaration.initializer.end - 1));
const entries = [];
let cursor = 0;
while (cursor < pricesBody.length) {
  while (/[\s,;]/.test(pricesBody[cursor] || "")) cursor++;
  if (cursor >= pricesBody.length) break;
  const header = pricesBody.slice(cursor).match(/^([A-Za-z_$][\w$]*)\s*:\s*\{/);
  if (!header) throw new Error(`unknown catalog syntax near ${pricesBody.slice(cursor, cursor + 40).trim()}`);
  const key = header[1];
  const openAt = cursor + header[0].lastIndexOf("{");
  const closeAt = balanced(pricesBody, openAt, "{", "}");
  const objectBody = pricesBody.slice(openAt + 1, closeAt);
  const fields = new Map();
  for (const rawField of splitTopLevelFields(objectBody)) {
    const match = rawField.trim().match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
    if (!match) {
      throw new Error(`unsupported catalog field syntax in ${key}: ${rawField.trim().slice(0, 40)}`);
    }
    if (fields.has(match[1])) throw new Error(`duplicate ${match[1]} field in ${key}`);
    fields.set(match[1], match[2].trim());
  }
  const expectedFields = ["lookup", "product", "amountCents", "interval"];
  if (fields.size !== expectedFields.length || expectedFields.some((field) => !fields.has(field))) {
    throw new Error(`partial or extra fields in ${key}`);
  }
  const intervalToken = fields.get("interval");
  const interval = intervalToken === "null" ? "null" : resolve(intervalToken, "string");
  if (!["month", "year", "null"].includes(interval)) throw new Error(`unknown interval ${interval} in ${key}`);
  const entry = {
    key,
    lookup: resolve(fields.get("lookup"), "string"),
    product: resolve(fields.get("product"), "string"),
    amount: resolve(fields.get("amountCents"), "number"),
    interval,
  };
  if (!entry.lookup || !entry.product) throw new Error(`blank lookup or product in ${key}`);
  if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) throw new Error(`invalid amount in ${key}`);
  entries.push(entry);
  cursor = closeAt + 1;
}

const planBindingDeclarations = [];
walkAst(ast, (node) => {
  if (declaresBindingName(node, "planForPrice")) planBindingDeclarations.push(node);
});
if (planForPriceFunctions.length !== 1) {
  throw new Error("planForPrice must retain its exact top-level exported function signature");
}
const planForPriceFunction = planForPriceFunctions[0];
const planParameter = planForPriceFunction.parameters[0];
if (
  planBindingDeclarations.length !== 1 ||
  planBindingDeclarations[0] !== planForPriceFunction ||
  planForPriceIdentifiers.length !== 1 ||
  planForPriceIdentifiers[0] !== planForPriceFunction.name ||
  planForPriceFunction.parent !== ast ||
  planForPriceFunction.modifiers?.length !== 1 ||
  !hasModifier(planForPriceFunction, ts.SyntaxKind.ExportKeyword) ||
  hasModifier(planForPriceFunction, ts.SyntaxKind.AsyncKeyword) ||
  hasModifier(planForPriceFunction, ts.SyntaxKind.DefaultKeyword) ||
  planForPriceFunction.asteriskToken ||
  !planForPriceFunction.body ||
  planForPriceFunction.parameters.length !== 1 ||
  !planParameter ||
  planParameter.modifiers?.length ||
  !ts.isIdentifier(planParameter.name) ||
  planParameter.name.text !== "price" ||
  planParameter.dotDotDotToken ||
  planParameter.questionToken ||
  planParameter.initializer
) {
  throw new Error("planForPrice must retain its exact top-level exported function signature");
}

function exactOptionalPriceDefault(node, expectedProperty, expectedFallback) {
  const expression = unwrapExpression(node);
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken
  ) return false;
  const access = unwrapExpression(expression.left);
  if (
    !ts.isPropertyAccessExpression(access) ||
    !access.questionDotToken ||
    !identifierNamed(access.expression, "price") ||
    access.name.text !== expectedProperty
  ) return false;
  return typeof expectedFallback === "string"
    ? literalString(expression.right, expectedFallback)
    : literalNumber(expression.right, expectedFallback);
}

function exactStringReturn(statement) {
  const returned = returnedExpression(statement);
  const expression = returned && unwrapExpression(returned);
  return expression && ts.isStringLiteral(expression) ? expression.text : null;
}

function parsePrefixRule(statement) {
  if (!ts.isIfStatement(statement) || statement.elseStatement) return null;
  const condition = unwrapExpression(statement.expression);
  if (
    !ts.isCallExpression(condition) ||
    condition.questionDotToken ||
    condition.typeArguments?.length ||
    condition.arguments.length !== 1
  ) return null;
  const callee = unwrapExpression(condition.expression);
  if (
    !ts.isPropertyAccessExpression(callee) ||
    callee.questionDotToken ||
    !identifierNamed(callee.expression, "lk") ||
    callee.name.text !== "startsWith"
  ) return null;
  const prefixNode = unwrapExpression(condition.arguments[0]);
  const plan = exactStringReturn(statement.thenStatement);
  if (!ts.isStringLiteral(prefixNode) || !prefixNode.text || !plan) return null;
  return { prefix: prefixNode.text, plan };
}

function flattenStrictOr(node, terms) {
  const expression = unwrapExpression(node);
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.BarBarToken
  ) {
    flattenStrictOr(expression.left, terms);
    flattenStrictOr(expression.right, terms);
  } else {
    terms.push(expression);
  }
}

function exactAmountValue(node) {
  const expression = unwrapExpression(node);
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (ts.isIdentifier(expression) && numberConstants.has(expression.text)) {
    return numberConstants.get(expression.text);
  }
  return null;
}

function parseAmountRule(statement) {
  if (!ts.isIfStatement(statement) || statement.elseStatement) return null;
  const plan = exactStringReturn(statement.thenStatement);
  if (!plan) return null;
  const terms = [];
  flattenStrictOr(statement.expression, terms);
  if (terms.length === 0) return null;
  const values = [];
  for (const term of terms) {
    if (
      !ts.isBinaryExpression(term) ||
      term.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
      !identifierNamed(term.left, "amt")
    ) return null;
    const amount = exactAmountValue(term.right);
    if (!Number.isSafeInteger(amount) || amount <= 0) return null;
    values.push(amount);
  }
  return { amounts: values, plan };
}

const planStatements = [...planForPriceFunction.body.statements];
let planStatementAt = 0;
const lookupInitializer = planStatements.length > 0
  ? singleConstInitializer(planStatements[planStatementAt], "lk")
  : null;
if (!lookupInitializer || !exactOptionalPriceDefault(lookupInitializer, "lookup_key", "")) {
  throw new Error("planForPrice must have exactly one canonical lookup-key initializer");
}
planStatementAt++;

const prefixes = [];
while (planStatementAt < planStatements.length) {
  const rule = parsePrefixRule(planStatements[planStatementAt]);
  if (!rule) break;
  if (prefixes.some((existingRule) => existingRule.prefix === rule.prefix)) {
    throw new Error(`duplicate planForPrice prefix ${rule.prefix}`);
  }
  prefixes.push(rule);
  planStatementAt++;
}
const expectedPrefixes = [
  ["gcl_agency_pro", "agency_pro"],
  ["gcl_agency", "agency"],
  ["gcl_premium", "premium"],
];
if (JSON.stringify(prefixes.map(({ prefix, plan }) => [prefix, plan])) !== JSON.stringify(expectedPrefixes)) {
  throw new Error("planForPrice prefix rule set or order differs from the exact accepted contract");
}

const amountInitializer = planStatementAt < planStatements.length
  ? singleConstInitializer(planStatements[planStatementAt], "amt")
  : null;
if (!amountInitializer) {
  throw new Error("planForPrice contains unmatched executable syntax before the amount initializer");
}
if (!exactOptionalPriceDefault(amountInitializer, "unit_amount", 0)) {
  throw new Error("planForPrice must have exactly one canonical amount initializer");
}
planStatementAt++;

const amounts = [];
const amountGroups = [];
while (planStatementAt < planStatements.length && ts.isIfStatement(planStatements[planStatementAt])) {
  const group = parseAmountRule(planStatements[planStatementAt]);
  if (!group) {
    throw new Error("planForPrice contains unmatched executable syntax in an amount rule");
  }
  amountGroups.push(group);
  for (const amount of group.amounts) amounts.push({ amount, plan: group.plan });
  planStatementAt++;
}

if (planStatementAt >= planStatements.length) {
  throw new Error("planForPrice final fallthrough is not return null");
}
const finalStatement = planStatements[planStatementAt];
if (!ts.isReturnStatement(finalStatement) || !finalStatement.expression) {
  throw new Error("planForPrice contains unmatched executable syntax before the final fallthrough");
}
if (unwrapExpression(finalStatement.expression).kind !== ts.SyntaxKind.NullKeyword) {
  throw new Error("planForPrice final fallthrough is not return null");
}
planStatementAt++;
if (planStatementAt !== planStatements.length) {
  throw new Error("planForPrice contains unmatched executable syntax after the final fallthrough");
}

const amountPlans = new Map();
for (const rule of amounts) {
  if (amountPlans.has(rule.amount)) throw new Error(`duplicate planForPrice amount ${rule.amount}`);
  amountPlans.set(rule.amount, rule.plan);
}
const expectedAmountGroups = [
  { amounts: [69900, 699000, 79900, 799000], plan: "agency_pro" },
  { amounts: [39900, 399000], plan: "agency" },
  { amounts: [9900, 99000], plan: "premium" },
];
if (JSON.stringify(amountGroups) !== JSON.stringify(expectedAmountGroups)) {
  throw new Error("planForPrice amount rule set differs from the exact accepted contract");
}

for (const statement of ast.statements) {
  if (
    !ts.isImportDeclaration(statement) &&
    !ts.isVariableStatement(statement) &&
    !ts.isFunctionDeclaration(statement) &&
    !ts.isTypeAliasDeclaration(statement) &&
    !ts.isInterfaceDeclaration(statement) &&
    !ts.isEmptyStatement(statement)
  ) {
    throw new Error("catalog source contains unmatched top-level executable syntax");
  }
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (initializerHasRuntimeEffect(declaration)) {
        throw new Error("catalog source contains an executable top-level variable initializer");
      }
    }
  }
}

for (const entry of entries) {
  if ([entry.key, entry.lookup, entry.product, entry.interval].some((value) => /[\t\r\n]/.test(String(value)))) {
    throw new Error(`non-canonical control character in ${entry.key}`);
  }
  console.log(["ENTRY", entry.key, entry.lookup, entry.product, entry.amount, entry.interval].join("\t"));
}
for (const rule of prefixes) console.log(["PREFIX", rule.prefix, rule.plan].join("\t"));
for (const rule of amounts) console.log(["AMOUNT", rule.amount, rule.plan].join("\t"));
console.log(["CONST", "PREMIUM_LOOKUP_KEY", stringConstants.get("PREMIUM_LOOKUP_KEY") || ""].join("\t"));
console.log(["CONST", "AGENCY_LOOKUP_KEY", stringConstants.get("AGENCY_LOOKUP_KEY") || ""].join("\t"));
console.log("FALLTHROUGH\tnull");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`catalog-parser: ${message}`);
  process.exitCode = 1;
}
NODE
}

echo "── CreditVector production verification · $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "   repository: ${ROOT}"
echo "   probe target: $([ "$PROBE" = 1 ] && echo "${BASE}" || echo "(disabled — pass --probe to enable read-only probes)")"
echo

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 0 — EXACT REPOSITORY CUSTODY
# A report is evidence for one commit/tree only. Dirty bytes are not represented by
# HEAD^{tree}, so they are a hard failure rather than an informational footnote.
# ═════════════════════════════════════════════════════════════════════════════
echo "SECTION 0 — EXACT REPOSITORY CUSTODY"
ACTUAL_COMMIT=""
ACTUAL_TREE=""
DIRTY="unknown"
STATUS_OUTPUT=""
if ! have git || ! ACTUAL_COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD 2>/dev/null)" \
  || ! ACTUAL_TREE="$(git -C "$ROOT" rev-parse --verify 'HEAD^{tree}' 2>/dev/null)"; then
  record fail "repository custody readable" "Git commit/tree could not be resolved"
elif [[ ! "$ACTUAL_COMMIT" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$ACTUAL_TREE" =~ ^[0-9a-f]{40}$ ]]; then
  record fail "repository custody readable" "Git returned a malformed commit or tree identity"
else
  record pass "repository commit bound" "$ACTUAL_COMMIT"
  record pass "repository tree bound" "$ACTUAL_TREE"
  if ! STATUS_OUTPUT="$(git -C "$ROOT" status --porcelain --untracked-files=all 2>/dev/null)"; then
    DIRTY="unknown"
    record fail "repository custody clean" "dirty=unknown — Git status could not be read"
  elif [ -n "$STATUS_OUTPUT" ]; then
    DIRTY="true"
    record fail "repository custody clean" "dirty=true — HEAD tree does not include all candidate bytes"
  else
    DIRTY="false"
    record pass "repository custody clean" "dirty=false"
  fi

  if [ -z "$EXPECTED_COMMIT" ] && [ -z "$EXPECTED_TREE" ]; then
    record verify_input "reviewed commit/tree supplied" "set both --expect-commit and --expect-tree (or CV_EXPECTED_COMMIT/CV_EXPECTED_TREE) to bind this run to the reviewed candidate"
  elif [ -z "$EXPECTED_COMMIT" ] || [ -z "$EXPECTED_TREE" ]; then
    record fail "reviewed commit/tree supplied as a pair" "both full SHAs are required; one is missing"
  elif [[ ! "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$EXPECTED_TREE" =~ ^[0-9a-f]{40}$ ]]; then
    record fail "reviewed commit/tree format" "both expectations must be lowercase full 40-hex SHAs"
  else
    EXPECTED_COMMIT_TREE=""
    if ! EXPECTED_COMMIT_TREE="$(git -C "$ROOT" rev-parse --verify "${EXPECTED_COMMIT}^{tree}" 2>/dev/null)"; then
      record fail "reviewed commit/tree pair is resolvable" "expected commit is not an object in this repository"
    elif [ "$EXPECTED_COMMIT_TREE" = "$EXPECTED_TREE" ]; then
      record pass "reviewed commit/tree pair is consistent" "the expected commit names the expected tree"
    else
      record fail "reviewed commit/tree pair is consistent" "expected commit names tree $EXPECTED_COMMIT_TREE, not $EXPECTED_TREE"
    fi
    if [ "$EXPECTED_COMMIT" = "$ACTUAL_COMMIT" ]; then
      record pass "reviewed commit matches" "$EXPECTED_COMMIT"
    else
      record fail "reviewed commit matches" "expected $EXPECTED_COMMIT; actual $ACTUAL_COMMIT"
    fi
    if [ "$EXPECTED_TREE" = "$ACTUAL_TREE" ]; then
      record pass "reviewed tree matches" "$EXPECTED_TREE"
    else
      record fail "reviewed tree matches" "expected $EXPECTED_TREE; actual $ACTUAL_TREE"
    fi
  fi
fi

echo

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 1 — REPOSITORY VALIDATION (runs here, now, with no credentials)
# ═════════════════════════════════════════════════════════════════════════════
echo "SECTION 1 — REPOSITORY VALIDATION"

# 1.1 Alerting wiring. The repo can prove the DELIVERY PATH exists and that the var
#     is presence-reported; it cannot prove the var is set in production (that is 1.11).
OBS="$(src lib/observability.ts)"
if [ -z "$OBS" ]; then
  record fail "alerting: delivery path" "lib/observability.ts not found"
else
  # Statement-level, not a mention: a comment referencing the var must not satisfy this.
  if grep -qE 'process\.env\.ALERT_WEBHOOK_URL' <<<"$OBS"; then
    record pass "alerting: delivery path exists" "lib/observability.ts forwards to ALERT_WEBHOOK_URL"
  else
    record fail "alerting: delivery path exists" "lib/observability.ts no longer references ALERT_WEBHOOK_URL"
  fi
  # The alert payload must never carry the destination or any key.
  if grep -qE 'body:.*ALERT_WEBHOOK_URL|JSON\.stringify\([^)]*ALERT_WEBHOOK_URL' <<<"$OBS"; then
    record fail "alerting: no secret in payload" "the webhook URL is being placed INTO the payload"
  else
    record pass "alerting: no secret in payload" "the destination URL is used as a target, never as data"
  fi
fi
if grep -q '"ALERT_WEBHOOK_URL"' <<<"$(src app/api/admin/diagnostics/route.ts)"; then
  record pass "alerting: presence is observable" "/api/admin/diagnostics reports ALERT_WEBHOOK_URL presence"
else
  record fail "alerting: presence is observable" "ALERT_WEBHOOK_URL missing from the diagnostics presence list"
fi

# 1.2 The presence oracle must return BOOLEANS, never values. This is the one endpoint
#     the owner uses to answer every "is X configured?" question, so if it ever returned
#     values it would turn the whole verification workflow into a credential leak.
DIAG="$(src app/api/admin/diagnostics/route.ts)"
if grep -q 'envPresent\[k\] = Boolean(process.env\[k\])' <<<"$DIAG"; then
  record pass "diagnostics returns presence only" "envPresent is Boolean(process.env[k]) — values never leave the server"
else
  record fail "diagnostics returns presence only" "the env readout no longer coerces to Boolean — it may be returning VALUES"
fi
if grep -qE 'process\.env\[k\](\s*)(,|\})' <<<"$DIAG"; then
  record fail "diagnostics leaks no raw value" "a raw process.env[k] is being returned"
else
  record pass "diagnostics leaks no raw value" "no raw env value is placed in the response"
fi
if grep -qE 'await requireAdmin\(\)' <<<"$DIAG"; then
  record pass "diagnostics is admin-gated" "requireAdmin() precedes the readout"
else
  record fail "diagnostics is admin-gated" "the presence oracle is not behind requireAdmin()"
fi

# 1.3 SETUP_SECRET — WHICH routes it gates, and HOW it may be presented.
#     A secret accepted in the query string is written to every access log, proxy log and
#     browser history it passes through — so the PRESENTATION MODE is checked here, not just
#     whether the secret exists. Enumerate rather than assume, so a route added later shows up
#     here instead of silently widening the surface.
SETUP_ROUTES="$(cd "$ROOT" && grep -rl 'SETUP_SECRET' --include=route.ts app 2>/dev/null | sort)"
if [ -z "$SETUP_ROUTES" ]; then
  record pass "SETUP_SECRET gates no route" "no route reads SETUP_SECRET (the god-mode path is gone from code)"
else
  record pass "SETUP_SECRET gated routes enumerated" "$(wc -l <<<"$SETUP_ROUTES" | tr -d ' ') route(s) accept it"
  while IFS= read -r r; do
    if grep -qE 'searchParams\.get\("secret"\)' "$ROOT/$r"; then
      note "${r} — accepts ?secret= IN THE QUERY STRING (it lands in access logs and browser history)"
    else
      note "${r} — header/body only"
    fi
  done <<<"$SETUP_ROUTES"
  QS_COUNT="$(cd "$ROOT" && grep -rlE 'searchParams\.get\("secret"\)' --include=route.ts app 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$QS_COUNT" != "0" ]; then
    record verify_provider "SETUP_SECRET query-string exposure" "${QS_COUNT} route(s) accept it in the URL — harmless ONLY if the var is unset in the provider environment"
  else
    record pass "SETUP_SECRET is never read from the URL" "header/body only on every gated route"
  fi
fi

# 1.4 Encryption backfill: the tooling and the ciphertext marker must exist. Whether any
#     row still holds plaintext is a DATABASE question (2.x), never a repository one.
CRYPTO="$(src lib/docCrypto.ts)"
if grep -q 'const TEXT_PREFIX = "cv1:"' <<<"$CRYPTO"; then
  record pass "ciphertext marker defined" 'lib/docCrypto.ts pins the "cv1:" prefix that identifies encrypted rows'
else
  record fail "ciphertext marker defined" 'the "cv1:" prefix constant is gone — completeness can no longer be measured'
fi
for r in app/api/admin/encrypt-reports/route.ts app/api/admin/encrypt-letters/route.ts; do
  B="$(src "$r")"
  if [ -z "$B" ]; then record fail "backfill route ${r##app/api/admin/}" "missing"
  elif grep -q 'isEncryptedText(' <<<"$B" && grep -qE 'await requireAdmin\(\)' <<<"$B"; then
    record pass "backfill route ${r##app/api/admin/}" "admin-gated and idempotent (skips rows already cv1:)"
  else
    record fail "backfill route ${r##app/api/admin/}" "not admin-gated, or no longer skips already-encrypted rows"
  fi
done

# 1.5 Stripe catalog ↔ planForPrice mapping consistency (REPOSITORY half of the catalog
#     question). A catalog price whose lookup key no rule recognizes resolves to null, and
#     planForPrice fails CLOSED — so the customer pays and the plan is silently NOT granted.
EXPECTED_CATALOG_COUNT=7
EXPECTED_LOOKUPS="gcl_premium_monthly
gcl_premium_yearly
gcl_agency_monthly
gcl_agency_yearly
gcl_agency_pro_monthly_v2
gcl_agency_pro_yearly_v2
gcl_letters_5"
EXPECTED_CATALOG_TUPLES="premium_month|gcl_premium_monthly|premium|9900|month
premium_year|gcl_premium_yearly|premium|99000|year
agency_month|gcl_agency_monthly|agency|39900|month
agency_year|gcl_agency_yearly|agency|399000|year
agency_pro_month|gcl_agency_pro_monthly_v2|agency_pro|69900|month
agency_pro_year|gcl_agency_pro_yearly_v2|agency_pro|699000|year
letters_5|gcl_letters_5|letters_5|1900|null"
CATALOG_MODEL=""
ACTUAL_LOOKUPS=""
TUPLES_EXACT=0
if [ ! -f "$STRIPE_SOURCE" ]; then
  record fail "stripe catalog located" "$STRIPE_SOURCE not found"
elif ! have node; then
  record env "stripe catalog parser" "Node is unavailable — deterministic catalog parsing did not run"
elif CATALOG_MODEL="$(parse_catalog_model "$STRIPE_SOURCE" 2>&1)"; then
  ENTRY_COUNT="$(awk -F '\t' '$1 == "ENTRY" { n++ } END { print n + 0 }' <<<"$CATALOG_MODEL")"
  ENTRY_KEY_COUNT="$(awk -F '\t' '$1 == "ENTRY" { print $2 }' <<<"$CATALOG_MODEL" | LC_ALL=C sort -u | wc -l | tr -d ' ')"
  LOOKUP_COUNT="$(awk -F '\t' '$1 == "ENTRY" { print $3 }' <<<"$CATALOG_MODEL" | LC_ALL=C sort -u | wc -l | tr -d ' ')"
  ACTUAL_LOOKUPS="$(awk -F '\t' '$1 == "ENTRY" { print $3 }' <<<"$CATALOG_MODEL")"
  SUBSCRIPTION_COUNT="$(awk -F '\t' '$1 == "ENTRY" && $6 != "null" { n++ } END { print n + 0 }' <<<"$CATALOG_MODEL")"
  ONE_TIME_COUNT="$(awk -F '\t' '$1 == "ENTRY" && $6 == "null" { n++ } END { print n + 0 }' <<<"$CATALOG_MODEL")"

  if [ "$ENTRY_COUNT" -eq "$EXPECTED_CATALOG_COUNT" ]; then
    record pass "stripe catalog exact entry count" "$ENTRY_COUNT catalog entries parsed (expected exactly $EXPECTED_CATALOG_COUNT)"
  else
    record fail "stripe catalog exact entry count" "$ENTRY_COUNT catalog entries parsed; expected exactly $EXPECTED_CATALOG_COUNT (zero/partial/extra is never accepted)"
  fi
  if [ "$ENTRY_KEY_COUNT" -eq "$ENTRY_COUNT" ] && [ "$LOOKUP_COUNT" -eq "$ENTRY_COUNT" ]; then
    record pass "stripe catalog keys are unique and nonblank" "$ENTRY_COUNT unique entry keys and lookup keys"
  else
    record fail "stripe catalog keys are unique and nonblank" "entry keys=$ENTRY_KEY_COUNT, lookup keys=$LOOKUP_COUNT, entries=$ENTRY_COUNT"
  fi

  if [ "$(printf '%s\n' "$ACTUAL_LOOKUPS" | LC_ALL=C sort)" = "$(printf '%s\n' "$EXPECTED_LOOKUPS" | LC_ALL=C sort)" ]; then
    record pass "stripe catalog lookup-key set is exact" "all seven RC1 lookup keys are represented"
  else
    record fail "stripe catalog lookup-key set is exact" "parsed lookup-key set differs from the seven-key RC1 contract"
  fi
  ACTUAL_CATALOG_TUPLES="$(awk -F '\t' '$1 == "ENTRY" { print $2 "|" $3 "|" $4 "|" $5 "|" $6 }' <<<"$CATALOG_MODEL")"
  if [ "$(printf '%s\n' "$ACTUAL_CATALOG_TUPLES" | LC_ALL=C sort)" = "$(printf '%s\n' "$EXPECTED_CATALOG_TUPLES" | LC_ALL=C sort)" ]; then
    TUPLES_EXACT=1
    record pass "stripe catalog exact entry tuples" "every accepted entry key, lookup, product, amount, and interval is exact"
  else
    record fail "stripe catalog exact entry tuples" "one or more entry key/lookup/product/amount/interval tuples differ from the accepted RC1 contract"
  fi
  if [ "$SUBSCRIPTION_COUNT" -eq 6 ] && [ "$ONE_TIME_COUNT" -eq 1 ]; then
    record pass "stripe catalog recurrence shape is exact" "6 subscription entries and 1 one-time letter pack"
  else
    record fail "stripe catalog recurrence shape is exact" "subscriptions=$SUBSCRIPTION_COUNT, one_time=$ONE_TIME_COUNT; expected 6 and 1"
  fi

  PREMIUM_LOOKUP="$(awk -F '\t' '$1 == "CONST" && $2 == "PREMIUM_LOOKUP_KEY" { print $3 }' <<<"$CATALOG_MODEL")"
  AGENCY_LOOKUP="$(awk -F '\t' '$1 == "CONST" && $2 == "AGENCY_LOOKUP_KEY" { print $3 }' <<<"$CATALOG_MODEL")"
  if [ "$PREMIUM_LOOKUP" = "gcl_premium_monthly" ] \
    && awk -F '\t' -v key="$PREMIUM_LOOKUP" '$1 == "ENTRY" && $3 == key && $4 == "premium" && $6 == "month" { found=1 } END { exit !found }' <<<"$CATALOG_MODEL"; then
    record pass "monthly premium lookup key parsed" "$PREMIUM_LOOKUP (historical catalog support; consumer checkout remains disabled)"
  else
    record fail "monthly premium lookup key parsed" "PREMIUM_LOOKUP_KEY is blank, changed, or absent from the monthly catalog entry"
  fi
  if [ "$AGENCY_LOOKUP" = "gcl_agency_monthly" ] \
    && awk -F '\t' -v key="$AGENCY_LOOKUP" '$1 == "ENTRY" && $3 == key && $4 == "agency" && $6 == "month" { found=1 } END { exit !found }' <<<"$CATALOG_MODEL"; then
    record pass "monthly agency lookup key parsed" "$AGENCY_LOOKUP"
  else
    record fail "monthly agency lookup key parsed" "AGENCY_LOOKUP_KEY is blank, changed, or absent from the monthly catalog entry"
  fi

  MAP_BAD=0
  [ "$ENTRY_COUNT" -eq "$EXPECTED_CATALOG_COUNT" ] || MAP_BAD=1
  [ "$ENTRY_KEY_COUNT" -eq "$ENTRY_COUNT" ] || MAP_BAD=1
  [ "$LOOKUP_COUNT" -eq "$ENTRY_COUNT" ] || MAP_BAD=1
  [ "$(printf '%s\n' "$ACTUAL_LOOKUPS" | LC_ALL=C sort)" = "$(printf '%s\n' "$EXPECTED_LOOKUPS" | LC_ALL=C sort)" ] || MAP_BAD=1
  [ "$TUPLES_EXACT" -eq 1 ] || MAP_BAD=1
  while IFS=$'\t' read -r tag entry LK PROD AMT INTERVAL; do
    [ "$tag" = "ENTRY" ] || continue
    case "$PROD:$INTERVAL" in
      premium:month|premium:year|agency:month|agency:year|agency_pro:month|agency_pro:year|letters_5:null) ;;
      *) record fail "catalog entry ${entry} has a recognized shape" "product='${PROD}', interval='${INTERVAL}' is outside the RC1 catalog contract"; MAP_BAD=1; continue ;;
    esac

    AMOUNT_PLAN="$(awk -F '\t' -v amount="$AMT" '$1 == "AMOUNT" && $2 == amount { print $3; exit }' <<<"$CATALOG_MODEL")"
    if [ "$INTERVAL" = "null" ]; then
      if [ -n "$AMOUNT_PLAN" ]; then
        record fail "one-time price ${LK} does not map to a plan" "amount ${AMT} resolves to ${AMOUNT_PLAN} — a letter pack would grant a subscription tier"
        MAP_BAD=1
      fi
      continue
    fi

    KEY_PLAN=""
    while IFS=$'\t' read -r rule pfx plan; do
      [ "$rule" = "PREFIX" ] || continue
      case "$LK" in "$pfx"*) [ -z "$KEY_PLAN" ] && KEY_PLAN="$plan" ;; esac
    done <<<"$CATALOG_MODEL"
    if [ "$KEY_PLAN" != "$PROD" ]; then
      record fail "catalog price ${LK} maps by lookup key" "catalog says '${PROD}', planForPrice resolves '${KEY_PLAN:-nothing}'"
      MAP_BAD=1
    fi
    if [ "$AMOUNT_PLAN" != "$PROD" ]; then
      record fail "catalog amount ${AMT} maps by fallback" "${LK} expects '${PROD}', amount fallback resolves '${AMOUNT_PLAN:-nothing}'"
      MAP_BAD=1
    fi
  done <<<"$CATALOG_MODEL"
  [ "$MAP_BAD" -eq 0 ] && record pass "catalog ↔ planForPrice mapping is consistent" "every subscription resolves to its own tier by lookup key and amount; the one-time pack resolves to none"

  if grep -qx $'FALLTHROUGH\tnull' <<<"$CATALOG_MODEL"; then
    record pass "unknown price fails closed" "planForPrice's final executable fallthrough is return null"
  else
    record fail "unknown price fails closed" "planForPrice does not end with return null"
  fi
else
  record fail "stripe catalog parsed deterministically" "${CATALOG_MODEL//$'\n'/ }"
fi

# 1.6 Disabled-account billing behaviour (REPOSITORY half). Ordinary billing stays
#     behind currentAccount(), which rejects disabled accounts. The separate self-cancel
#     route may identify a disabled payer only from a signed, version-bound JWT and may
#     perform exactly cancellation-at-period-end against the subscription on that row.
PORTAL="$(src app/api/stripe/portal/route.ts)"
if grep -qE '^\s*const [A-Za-z]+ = await currentAccount\(\);' <<<"$PORTAL"; then
  record pass "billing portal resolves by id and fails closed" "portal uses currentAccount() (id-resolved, re-checks disabled)"
else
  record fail "billing portal resolves by id" "portal no longer uses currentAccount() — it may be resolving by session email"
fi
CANCEL_ROUTE="$(src app/api/billing/self-cancel/route.ts)"
SESSION_SRC="$(src lib/session.ts)"
AUTH_SRC="$(src lib/auth.ts)"
if grep -q 'const state = await sessionAccountState(req);' <<<"$CANCEL_ROUTE" \
  && grep -q 'if (state.state === "enabled")' <<<"$CANCEL_ROUTE" \
  && grep -q 'stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })' <<<"$CANCEL_ROUTE" \
  && ! grep -qE 'await req\.json\(|await stripe\.billingPortal\.sessions\.create|await stripe\.checkout\.sessions\.create' <<<"$CANCEL_ROUTE"; then
  record pass "disabled payer path is cancellation-only" "self-cancel identifies no body-supplied subject and exposes no portal, checkout, purchase, or reactivation primitive"
else
  record fail "disabled payer path is cancellation-only" "identity, enabled-account refusal, cancel-at-period-end, or no-purchase invariant is missing"
fi
if grep -q 'token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })' <<<"$SESSION_SRC" \
  && grep -q 'const id = token?.uid;' <<<"$SESSION_SRC" \
  && grep -q 'passwordSessionVersionMatches(' <<<"$SESSION_SRC" \
  && grep -q 'return account.disabled ? { state: "disabled", account }' <<<"$SESSION_SRC" \
  && grep -q 'token.cancellationOnly === true' <<<"$AUTH_SRC" \
  && grep -q 'return null as unknown as typeof session' <<<"$AUTH_SRC"; then
  record pass "cancellation identity grants no application session" "immutable id + keyed session-version evidence is rechecked; cancellation-only JWTs project no public session"
else
  record fail "cancellation identity grants no application session" "the dedicated resolver or public-session suppression contract changed"
fi
if [ -n "$(src app/api/admin/billing/cancel/route.ts)" ]; then
  record pass "an administrative cancellation path exists" "POST /api/admin/billing/cancel (admin-gated, audit-logged)"
else
  record fail "an administrative cancellation path exists" "no admin cancellation route — a disabled subscriber could not be stopped at all"
fi
record verify_production "disabled-account population is reconciled" "repository authority is proven above; existing live subscriptions still require production reconciliation"

# 1.7 Webhook durability: an event claim must be settled, not merely taken. An unsettled
#     claim held by an instance that was killed would dedupe Stripe's retry away forever.
WH="$(src app/api/stripe/webhook/route.ts)"
BILL="$(src lib/billing.ts)"
if grep -qE '^\s*await completeStripeEvent\(event\.id, event\.type\);' <<<"$WH" \
   && grep -q 'ON CONFLICT ("id") DO UPDATE' <<<"$BILL"; then
  record pass "webhook claims are settled, and abandoned claims expire" "claim→handle→settle, with a stale-claim window (see scripts/stripe-lifecycle.test.ts)"
else
  record fail "webhook claims are settled" "the claim is never settled or can never be re-taken — a killed instance loses the event permanently"
fi

# 1.8 Toolchain prerequisites for the validations the Go/No-Go gate requires.
if [ -d "$ROOT/node_modules" ]; then
  record pass "node_modules present" "typecheck / build / lint / guards can run"
else
  record env "node_modules present" "absent — 'npm run typecheck', 'npx next build' and 'npm run lint' CANNOT run here; guards still run via 'npx --no-install tsx'"
fi
for s in typecheck lint build; do
  if grep -q "\"$s\":" "$ROOT/package.json"; then
    record pass "npm script '$s' defined" "package.json declares it"
  else
    record fail "npm script '$s' defined" "missing from package.json"
  fi
done
if have npx; then
  record pass "npx available" "guard scripts are invocable"
else
  record env "npx available" "absent — no guard script can run in this environment"
fi
GUARDS="$(cd "$ROOT" && ls scripts/*.test.ts 2>/dev/null | wc -l | tr -d ' ')"
record pass "guard suite present" "${GUARDS} guard script(s) in scripts/ (run map: .ai/TESTING.md)"

if [ "$FAILURES" -gt 0 ]; then
  OFFLINE_RESULT="FAIL"
elif [ "$INPUT_VERIFYS" -gt 0 ] || [ "$SKIPS" -gt 0 ]; then
  OFFLINE_RESULT="VERIFICATION_REQUIRED"
else
  OFFLINE_RESULT="PASS_OFFLINE"
fi

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — PRODUCTION VALIDATION (needs credentials this repo must not hold)
# Each line prints the exact owner command. Nothing here is assumed, inferred or
# scored: an unanswered question stays VERIFICATION REQUIRED until a human answers it.
# ═════════════════════════════════════════════════════════════════════════════
echo
echo "SECTION 2 — PRODUCTION VALIDATION (owner/credentialed)"

record verify_provider "ALERT_WEBHOOK_URL is set in production" "presence only — never print the value"
note "npx vercel env ls production | grep -c ALERT_WEBHOOK_URL   # expect exactly 1"
note "or: sign in as ADMIN → GET /api/admin/diagnostics → envPresent.ALERT_WEBHOOK_URL === true"
note "SET is not DELIVERED: only an end-to-end alert drill (fire a real alert, confirm it arrives) proves this"

record verify_provider "SETUP_SECRET is UNSET in production" "presence only. It is a god-mode setup credential and must be absent once first-run setup is done"
note "npx vercel env ls production | grep -c SETUP_SECRET        # expect exactly 0"
note "or: GET /api/admin/diagnostics → envPresent.SETUP_SECRET === false"
note "--probe verifies only the non-development 404 containment; it cannot determine whether SETUP_SECRET is set"

record verify_production "encryption backfill is complete (zero plaintext rows)" "row-level DB fact — not observable from the repository"
note "the measurement is the backfill itself, and it MUTATES: this harness will not run it"
note "owner runs, signed in as ADMIN: POST /api/admin/encrypt-reports and POST /api/admin/encrypt-letters"
note "complete when both return encrypted:0 (idempotent — every remaining row is already cv1:)"
note "answers V-02 / gate 'C-02 zero rows hold plaintext PII'"

record verify_provider "live Stripe catalog matches the repository catalog" "the repo defines what SHOULD exist; only Stripe knows what DOES"
if [ -n "$ACTUAL_LOOKUPS" ]; then
  note "expected lookup keys: $(tr '\n' ' ' <<<"$ACTUAL_LOOKUPS" | sed -E 's/[[:space:]]+$//')"
fi
note "Stripe Dashboard (LIVE) → Products → Prices: every key above must exist exactly once and be ACTIVE"

record verify_provider "no OUT-OF-BAND live price is purchasable" "a price created by hand, imported, or left from an older packaging"
note "Stripe Dashboard (LIVE) → Products → Prices → include archived=false; list every ACTIVE price"
note "for each price NOT in the expected keys above, check its unit_amount against planForPrice (lib/stripe.ts)"
note "an active price matching NO rule = a customer can pay and receive NOTHING (planForPrice fails closed)"
note "legacy Agency Pro at \$799/mo and \$7,990/yr are DELIBERATELY still mapped — they are not out-of-band"

record verify_provider "no OUT-OF-BAND Stripe sale surface or Payment Link is active" "Payment Links and other provider-hosted sale surfaces are not represented in repository code"
note "Stripe Dashboard (LIVE) → Payment Links: no active consumer or otherwise unauthorized purchase link"
note "also inspect any provider-hosted Checkout links not created by the repository's hard-closed consumer route"

record verify_production "disabled accounts hold no live subscription" "identity state lives in our DB; billing state lives in Stripe — neither side sees both"
note "admin UI → Users → filter disabled; for each, check subscriptionStatus"
note "cross-check in Stripe Dashboard (LIVE) → Customers → the matching stripeCustomerId"
note "any disabled account with an ACTIVE subscription needs resolving one way or the other"
note "policy DECIDED — cancellation-only self-service; see RC1-DISABLED-ACCOUNT-POLICY.md §5"
note "repository guards cover fresh cancellation-only sign-in and in-session access; this check"
note "is the separate reconciliation of the existing live provider/database population"

record verify_production "the deployed release is the reviewed commit" "the repo cannot prove what is deployed"
note "curl -sI ${BASE}/ | grep -i x-cv-release   # compare with the reviewed SHA"

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — READ-ONLY PRODUCTION PROBES (--probe only)
# Unauthenticated, side-effect-free. Every handler below rejects before it acts, so
# these observe configuration without exercising it. No credential is sent or read.
# ═════════════════════════════════════════════════════════════════════════════
if [ "$PROBE" = 1 ]; then
  echo
  echo "SECTION 3 — READ-ONLY PRODUCTION PROBES (${BASE})"
  if ! have curl; then
    record env "probes" "curl is unavailable"
  else
    # 3.1 Bootstrap containment, WITHOUT sending or learning any secret. In every
    #     non-development runtime /api/admin/bootstrap returns 404 before reading
    #     SETUP_SECRET or reaching a seed function. The deliberately indistinguishable
    #     404 proves only that the public surface is unavailable; it is not a secret-
    #     presence oracle and cannot prove whether the route exists in the deployment.
    c=$(http_code -X POST "${BASE}/api/admin/bootstrap" -H "Content-Type: application/json" -d '{}')
    case "$c" in
      404)     record pass "bootstrap unavailable outside development" "HTTP 404 matches the hard-off contract and reveals neither route nor SETUP_SECRET presence" ;;
      403|503) record fail "bootstrap unavailable outside development" "HTTP ${c} — expected the non-development 404 before configuration or authorization branches" ;;
      200)     record fail "bootstrap unavailable outside development" "HTTP 200 — expected 404; an anonymous request reached an enabled path" ;;
      000)     record env "bootstrap containment probe" "no response (network blocked or DNS unavailable)" ;;
      transport-error:*) record env "bootstrap containment probe" "curl failed (${c}); no HTTP fact was observed" ;;
      *)       record fail "bootstrap containment probe" "unexpected HTTP ${c}; expected 404" ;;
    esac

    # 3.2 The legacy human-triggerable DDL route was removed. Probe with a plain
    #     GET only: the retired route is 404, while a stale POST-only route is 405.
    #     NEVER POST here — a stale deployment must be detected without giving its
    #     mutation handler any opportunity to authorize or execute.
    c=$(code_of "${BASE}/api/admin/migrate")
    case "$c" in
      404)                 record pass "legacy admin migrate route absent" "HTTP 404 — retired mutation surface is not deployed" ;;
      200|401|403|405|503) record fail "legacy admin migrate route absent" "HTTP ${c} — stale or exposed route remains deployed" ;;
      000)                 record env "legacy admin migrate absence probe" "no response (network blocked or DNS unavailable)" ;;
      transport-error:*)   record env "legacy admin migrate absence probe" "curl failed (${c}); no HTTP fact was observed" ;;
      *)                   record fail "legacy admin migrate absence probe" "unexpected HTTP ${c}; expected 404" ;;
    esac

    # 3.3 Every remaining privileged route must fail closed to an anonymous caller.
    #     For these live controls, 404 is a failure rather than an acceptable gate.
    for spec in "/api/admin/diagnostics:GET" "/api/admin/billing/provision:POST" "/api/agency/enable:POST" "/api/stripe/portal:POST"; do
      path="${spec%%:*}"; verb="${spec##*:}"
      if [ "$verb" = "POST" ]; then
        c=$(http_code -X POST "${BASE}${path}" -H "Content-Type: application/json" -d '{}')
      else
        c=$(code_of "${BASE}${path}")
      fi
      case "$c" in
        401|403) record pass "gate ${verb} ${path}" "fails closed (HTTP ${c})" ;;
        503)     record pass "gate ${verb} ${path}" "unconfigured, refuses (HTTP 503)" ;;
        200)     record fail "gate ${verb} ${path}" "SERVED 200 TO AN ANONYMOUS CALLER" ;;
        404)     record fail "gate ${verb} ${path}" "ROUTE GONE (HTTP 404) — deleted or misrouted by a deploy" ;;
        000)     record env "gate ${verb} ${path}" "no response (network blocked or DNS unavailable)" ;;
        transport-error:*) record env "gate ${verb} ${path}" "curl failed (${c}); no HTTP fact was observed" ;;
        *)       record fail "gate ${verb} ${path}" "unexpected HTTP ${c}" ;;
      esac
    done

    # 3.4 The Stripe webhook must still reject an unsigned payload — the durability work in
    #     lib/billing.ts is only meaningful behind an intact signature check.
    c=$(http_code -X POST "${BASE}/api/stripe/webhook" -H "Content-Type: application/json" -d '{"verify":"probe"}')
    case "$c" in
      400|401|403) record pass "stripe webhook rejects unsigned" "HTTP ${c}" ;;
      503)         record fail "stripe webhook configured" "HTTP 503 — STRIPE_WEBHOOK_SECRET missing; EVERY entitlement event is being dropped" ;;
      200)         record fail "stripe webhook rejects unsigned" "ACCEPTED AN UNSIGNED PAYLOAD (HTTP 200)" ;;
      000)         record env "stripe webhook probe" "no response (network blocked or DNS unavailable)" ;;
      transport-error:*) record env "stripe webhook probe" "curl failed (${c}); no HTTP fact was observed" ;;
      *)           record fail "stripe webhook probe" "unexpected HTTP ${c}" ;;
    esac
  fi
else
  echo
  echo "SECTION 3 — skipped (read-only probes are opt-in: re-run with --probe)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# FINALIZATION — evidence is staged outside the repository, then repository
# custody is re-read. A draft carries evidence_complete=0 and cannot be mistaken
# for a completed attestation if the process is interrupted before the recheck.
refresh_release_result() {
  TOTAL_VERIFYS=$((PROVIDER_VERIFYS + PRODUCTION_VERIFYS + INPUT_VERIFYS))
  if [ "$FAILURES" -gt 0 ]; then
    RESULT="FAIL"
    EXIT_CODE=1
  elif [ "$TOTAL_VERIFYS" -gt 0 ] || [ "$SKIPS" -gt 0 ]; then
    RESULT="VERIFICATION_REQUIRED"
    EXIT_CODE=2
  else
    RESULT="PASS_OFFLINE"
    EXIT_CODE=0
  fi
}

FINAL_COMMIT=""
FINAL_TREE=""
FINAL_DIRTY="unknown"
CUSTODY_RECHECK_DETAIL=""
read_current_custody() {
  local final_status=""
  FINAL_COMMIT=""
  FINAL_TREE=""
  FINAL_DIRTY="unknown"
  if ! have git || ! FINAL_COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD 2>/dev/null)" \
    || ! FINAL_TREE="$(git -C "$ROOT" rev-parse --verify 'HEAD^{tree}' 2>/dev/null)"; then
    CUSTODY_RECHECK_DETAIL="Git commit/tree could not be re-read"
    return 1
  fi
  if [[ ! "$FINAL_COMMIT" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$FINAL_TREE" =~ ^[0-9a-f]{40}$ ]]; then
    CUSTODY_RECHECK_DETAIL="Git returned a malformed final commit or tree identity"
    return 1
  fi
  if ! final_status="$(git -C "$ROOT" status --porcelain --untracked-files=all 2>/dev/null)"; then
    CUSTODY_RECHECK_DETAIL="final dirty state could not be read"
    return 1
  fi
  if [ -n "$final_status" ]; then FINAL_DIRTY="true"; else FINAL_DIRTY="false"; fi
  if [ "$FINAL_COMMIT" != "$ACTUAL_COMMIT" ] || [ "$FINAL_TREE" != "$ACTUAL_TREE" ]; then
    CUSTODY_RECHECK_DETAIL="repository identity changed during verification (commit=${FINAL_COMMIT}, tree=${FINAL_TREE})"
    return 1
  fi
  if [ "$FINAL_DIRTY" != "false" ]; then
    CUSTODY_RECHECK_DETAIL="repository became dirty during verification"
    return 1
  fi
  CUSTODY_RECHECK_DETAIL="commit/tree unchanged and dirty=false"
  return 0
}

OUTPUT_DIR=""
EVIDENCE_REQUESTED=0
EVIDENCE_PATH_VALID=0
EVIDENCE_WRITTEN=0
if [ -n "${CV_VERIFY_OUT:-}" ]; then
  EVIDENCE_REQUESTED=1
  if [ ! -d "${CV_VERIFY_OUT}" ]; then
    record fail "verification evidence output is usable" "CV_VERIFY_OUT is not an existing directory"
    OFFLINE_RESULT="FAIL"
  elif ! OUTPUT_DIR="$(cd "${CV_VERIFY_OUT}" 2>/dev/null && pwd -P)"; then
    record fail "verification evidence output is usable" "CV_VERIFY_OUT could not be resolved"
    OFFLINE_RESULT="FAIL"
  else
    ROOT_PHYSICAL="$(cd "$ROOT" && pwd -P)"
    case "${OUTPUT_DIR}/" in
      "${ROOT_PHYSICAL}/"*)
        record fail "verification evidence output is outside the repository" "CV_VERIFY_OUT must not dirty or replace bytes in the candidate worktree"
        OFFLINE_RESULT="FAIL"
        ;;
      *)
        EVIDENCE_PATH_VALID=1
        record pass "verification evidence output is outside the repository" "$OUTPUT_DIR"
        ;;
    esac
  fi
fi

write_evidence_files() { # evidence_complete (0 for draft, 1 after custody recheck)
  local complete="$1" summary_tmp report_tmp summary_path report_path
  summary_path="${OUTPUT_DIR}/verify-production-summary.txt"
  report_path="${OUTPUT_DIR}/verify-production-report.txt"
  # Invalidate the prior generation before even staging replacement bytes. If
  # temp creation, content generation, or either rename fails, no stale
  # evidence_complete=1 marker can survive the attempted update.
  rm -f "$summary_path" || return 1
  summary_tmp="$(mktemp "${OUTPUT_DIR}/.verify-production-summary.XXXXXX")" || return 1
  report_tmp="$(mktemp "${OUTPUT_DIR}/.verify-production-report.XXXXXX")" || {
    rm -f "$summary_tmp"
    return 1
  }
  if ! {
    echo "checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "base=${BASE}"
    echo "probe=${PROBE}"
    echo "result=${RESULT}"
    echo "offline_result=${OFFLINE_RESULT}"
    echo "exit_code=${EXIT_CODE}"
    echo "evidence_complete=${complete}"
    echo "commit=${ACTUAL_COMMIT}"
    echo "tree=${ACTUAL_TREE}"
    echo "dirty=${DIRTY}"
    echo "final_commit=${FINAL_COMMIT:-unknown}"
    echo "final_tree=${FINAL_TREE:-unknown}"
    echo "final_dirty=${FINAL_DIRTY}"
    echo "expected_commit=${EXPECTED_COMMIT}"
    echo "expected_tree=${EXPECTED_TREE}"
    echo "pass=${PASSES}"
    echo "fail=${FAILURES}"
    echo "verification_required_provider=${PROVIDER_VERIFYS}"
    echo "verification_required_production=${PRODUCTION_VERIFYS}"
    echo "verification_required_input=${INPUT_VERIFYS}"
    echo "not_run=${SKIPS}"
    echo "catalog_entry_count=${ENTRY_COUNT:-0}"
    echo "catalog_lookup_keys=$(tr '\n' ',' <<<"$ACTUAL_LOOKUPS" | sed -E 's/,+$//')"
  } > "$summary_tmp"; then
    rm -f "$summary_tmp" "$report_tmp"
    return 1
  fi
  if ! printf '%s' "$REPORT" > "$report_tmp"; then
    rm -f "$summary_tmp" "$report_tmp"
    return 1
  fi
  # The summary is the completion marker and is installed last. Thus a
  # report-success/summary-failure split can leave no stale complete=1 summary
  # beside bytes from this run.
  if ! mv -f "$report_tmp" "$report_path" \
    || ! mv -f "$summary_tmp" "$summary_path"; then
    rm -f "$summary_tmp" "$report_tmp"
    return 1
  fi
  return 0
}

refresh_release_result
if [ "$EVIDENCE_PATH_VALID" -eq 1 ]; then
  if write_evidence_files 0; then
    EVIDENCE_WRITTEN=1
  else
    record fail "verification evidence draft written" "atomic evidence staging failed; no completed evidence was produced"
    OFFLINE_RESULT="FAIL"
  fi
fi

if read_current_custody; then
  record pass "repository custody stable through verification evidence" "$CUSTODY_RECHECK_DETAIL"
else
  record fail "repository custody stable through verification evidence" "$CUSTODY_RECHECK_DETAIL"
  OFFLINE_RESULT="FAIL"
fi

refresh_release_result
if [ "$EVIDENCE_PATH_VALID" -eq 1 ] && [ "$EVIDENCE_WRITTEN" -eq 1 ]; then
  if write_evidence_files 1; then
    # Re-read once more after the completed report pair is installed. Because the
    # output directory is outside ROOT, evidence writes cannot explain a change.
    if ! read_current_custody; then
      record fail "repository custody stable after completed evidence" "$CUSTODY_RECHECK_DETAIL"
      OFFLINE_RESULT="FAIL"
      refresh_release_result
      write_evidence_files 0 >/dev/null 2>&1 || true
      EVIDENCE_WRITTEN=0
    fi
  else
    record fail "verification evidence completed" "atomic final evidence write failed"
    OFFLINE_RESULT="FAIL"
    EVIDENCE_WRITTEN=0
  fi
fi

refresh_release_result
echo
echo "── OFFLINE RESULT: ${OFFLINE_RESULT}"
echo "── RELEASE RESULT: ${RESULT}"
echo "   ${PASSES} pass · ${FAILURES} fail · ${PROVIDER_VERIFYS} provider verification required · ${PRODUCTION_VERIFYS} production verification required · ${INPUT_VERIFYS} input verification required · ${SKIPS} not run (environment)"
if [ "$FAILURES" -gt 0 ]; then
  echo "   ${FAILURES} check(s) FAILED — treat as blocking."
fi
if [ "$TOTAL_VERIFYS" -gt 0 ] || [ "$SKIPS" -gt 0 ]; then
  echo "   $((TOTAL_VERIFYS + SKIPS)) item(s) are UNANSWERED. Unanswered is not passed."
  echo "   A clean run of this harness is NOT a Go. This script measures; it does not decide."
fi
if [ "$EVIDENCE_WRITTEN" -eq 1 ]; then
  echo "   wrote ${OUTPUT_DIR}/verify-production-{summary,report}.txt"
elif [ "$EVIDENCE_REQUESTED" -eq 1 ]; then
  echo "   complete verification evidence was NOT written"
fi

exit "$EXIT_CODE"
