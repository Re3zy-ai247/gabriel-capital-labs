#!/usr/bin/env node

// Reproducible browser evidence for the protected CXOS Agency review route.
//
// This runner deliberately does not add Playwright or Axe to the application.
// The caller supplies absolute, immutable tool paths from the Codex workspace
// runtime and this script verifies their versions and package/script hashes
// before importing or executing them.

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXPECTED = Object.freeze({
  playwrightVersion: "1.62.0",
  playwrightPackageSha256:
    "638ab746b40d3986e16e13b08418beaa2262c47e8bc843b745589af15dead35b",
  axeVersion: "4.12.1",
  axeScriptSha256:
    "66a8aaa95a8b044a7fd74a5435873bf04ff65a1ca75567c921b7509742085a14",
});

const DISTRICTS = Object.freeze([
  "central-command",
  "client-operations",
  "team-operations",
  "business-health",
  "evidence-archive",
  "kai-suite",
  "growth-threshold",
]);

// The four "travel" chambers: the only profiles the CSS opts into the
// ViewTimeline-driven agencyLivingScroll parallax (see the
// `@supports (animation-timeline: view())` block in
// agency-command.module.css that gates on exactly these four
// data-cxos-profile values). Central Command, Team Operations, and Kai
// Suite are documented "still" chambers and are deliberately excluded.
const SCROLL_LINKED_DISTRICTS = Object.freeze([
  "client-operations",
  "evidence-archive",
  "growth-threshold",
  "business-health",
]);

// Mirrors the eligible-control selector used for 44px target-size and
// obstruction sampling. Kept as a single source of truth so the post-CLS
// scroll-restored obstruction probe re-derives the exact same candidate
// list snapshot() already built for a given state.
const TARGET_SIZE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [role='button'], [tabindex]:not([tabindex='-1'])";

// wcag22a/wcag22aa added for RC2 WP7 breadth; shared by the single
// full-page audit and the per-chamber audits so both cover the same rule
// set.
const AXE_RUNONLY_TAGS = Object.freeze([
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
]);

const MATRIX = Object.freeze([
  {
    id: "desktop-large",
    width: 1728,
    height: 1000,
    mode: "full",
    arrival: "natural",
    activation: "keyboard",
    replay: true,
  },
  {
    id: "desktop",
    width: 1440,
    height: 900,
    mode: "full",
    arrival: "escape",
    activation: "keyboard",
    measuredCycles: 3,
    resize: true,
    lifecycle: true,
    departure: true,
  },
  { id: "tablet", width: 1024, height: 768, mode: "smoke", arrival: "skip", activation: "keyboard" },
  {
    id: "mobile",
    width: 390,
    height: 844,
    mobile: true,
    coarse: true,
    mode: "full",
    arrival: "skip",
    activation: "touch",
    departure: true,
  },
  {
    id: "mobile-360",
    width: 360,
    height: 800,
    mobile: true,
    coarse: true,
    mode: "smoke",
    arrival: "skip",
    activation: "touch",
  },
  {
    id: "mobile-narrow",
    width: 320,
    height: 800,
    mobile: true,
    coarse: true,
    mode: "smoke",
    arrival: "skip",
    activation: "touch",
  },
  {
    id: "landscape",
    width: 740,
    height: 390,
    mobile: true,
    coarse: true,
    mode: "smoke",
    arrival: "skip",
    activation: "touch",
    measuredCycles: 3,
  },
  {
    id: "reduced",
    width: 1440,
    height: 900,
    reduced: true,
    mode: "full",
    arrival: "natural",
    activation: "keyboard",
  },
  {
    id: "constrained",
    width: 1024,
    height: 768,
    constrained: true,
    mode: "smoke",
    arrival: "natural",
    activation: "keyboard",
  },
  {
    id: "reflow-200",
    width: 720,
    height: 450,
    deviceScaleFactor: 2,
    physicalViewport: { width: 1440, height: 900 },
    browserZoomPercent: 200,
    mode: "smoke",
    arrival: "skip",
    activation: "keyboard",
  },
]);

function fail(message) {
  console.error(`CXOS_BROWSER_EVIDENCE_FAIL: ${message}`);
  process.exit(1);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function requiredAbsolutePath(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  if (!value.startsWith("/")) fail(`${name} must be an absolute path`);
  return resolve(value);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const baseUrl = (process.env.CXOS_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const route = process.env.CXOS_REVIEW_ROUTE ?? "/review/agency-command";
const evidenceDir = resolve(
  process.env.CXOS_EVIDENCE_DIR ??
    "CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_EVIDENCE/browser",
);
const label = process.env.CXOS_EVIDENCE_LABEL ?? "candidate";
const captureMissingFeatures = process.env.CXOS_CAPTURE_MISSING_FEATURES === "1";
const sourceRevision = process.env.CXOS_SOURCE_REVISION ?? "UNBOUND";
const captureMode = captureMissingFeatures
  ? "missing-feature-ledger"
  : "strict-candidate-acceptance";
if (!captureMissingFeatures && !/^[0-9a-f]{40}$/i.test(sourceRevision)) {
  fail("CXOS_SOURCE_REVISION must be the exact 40-character candidate commit SHA in strict mode");
}
const harnessPath = fileURLToPath(import.meta.url);
const caseFilter = process.env.CXOS_CASE_FILTER?.trim();
const selectedMatrix = caseFilter
  ? MATRIX.filter((spec) => spec.id === caseFilter)
  : MATRIX;
if (caseFilter && selectedMatrix.length === 0) {
  fail(`CXOS_CASE_FILTER does not name a declared case: ${caseFilter}`);
}
const playwrightRoot = requiredAbsolutePath("CXOS_PLAYWRIGHT_PATH");
const chromePath = requiredAbsolutePath("CXOS_CHROME_PATH");
const axePath = requiredAbsolutePath("CXOS_AXE_PATH");
const playwrightPackagePath = join(playwrightRoot, "package.json");
const playwrightPackage = readJson(playwrightPackagePath);
const axePackagePath = join(resolve(axePath, ".."), "package.json");
const axePackage = readJson(axePackagePath);

if (playwrightPackage.version !== EXPECTED.playwrightVersion) {
  fail(`Playwright version ${playwrightPackage.version} does not match ${EXPECTED.playwrightVersion}`);
}
if (sha256(playwrightPackagePath) !== EXPECTED.playwrightPackageSha256) {
  fail("Playwright package identity does not match the pinned SHA-256");
}
if (axePackage.version !== EXPECTED.axeVersion) {
  fail(`Axe version ${axePackage.version} does not match ${EXPECTED.axeVersion}`);
}
if (sha256(axePath) !== EXPECTED.axeScriptSha256) {
  fail("Axe script identity does not match the pinned SHA-256");
}

mkdirSync(evidenceDir, { recursive: true });

const playwright = await import(pathToFileURL(join(playwrightRoot, "index.mjs")).href);
const browser = await playwright.chromium.launch({
  executablePath: chromePath,
  headless: true,
  ignoreDefaultArgs: ["--disable-back-forward-cache"],
  args: ["--disable-background-networking", "--disable-component-update"],
});

function classifyUrlOwnership(rawUrl) {
  try {
    const url = new URL(rawUrl, baseUrl);
    const baseOrigin = new URL(baseUrl).origin;
    const candidateChunkPrefix = `/_next/static/chunks/app${route.replace(/\/$/, "")}/`;
    if (url.origin !== baseOrigin) {
      return { ownership: "external", ownershipEvidence: "cross-origin URL" };
    }
    if (url.pathname === route || url.pathname.startsWith(candidateChunkPrefix)) {
      return {
        ownership: "candidate-owned",
        ownershipEvidence: "candidate route or route-specific chunk path",
      };
    }
    if (
      url.pathname === "/api/auth/session" ||
      url.pathname === "/api/auth/_log" ||
      /\/_next\/static\/chunks\/(?:webpack|main-app|framework|polyfills)-/.test(url.pathname) ||
      /\/_next\/static\/chunks\/\d+-[^/]+\.js$/.test(url.pathname) ||
      /\/_next\/static\/chunks\/app\/(?:layout|error)-/.test(url.pathname)
    ) {
      return {
        ownership: "inherited-framework",
        ownershipEvidence: "explicit Next.js or NextAuth path",
      };
    }
    return {
      ownership: "first-party-unattributed",
      ownershipEvidence: "same-origin URL without a candidate- or framework-specific marker",
    };
  } catch {
    return {
      ownership: "browser-unattributed",
      ownershipEvidence: "URL unavailable or unparsable",
    };
  }
}

function classifyConsoleOwnership(message) {
  const text = message.text();
  if (/\/api\/auth\/(?:session|_log)|CLIENT_FETCH_ERROR/i.test(text)) {
    return {
      ownership: "inherited-framework",
      ownershipEvidence: "explicit NextAuth session error marker",
    };
  }
  return classifyUrlOwnership(message.location().url);
}

function summarizeBy(records, field) {
  return records.reduce((summary, record) => {
    const value = record[field] ?? "unknown";
    summary[value] = (summary[value] ?? 0) + 1;
    return summary;
  }, {});
}

function safeUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return "unavailable";
  try {
    const url = new URL(rawUrl, baseUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return "unavailable";
  }
}

function safeEvidenceText(value, maximumLength = 2000) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(
      /((?:aria-label|placeholder|value|name|title|alt|href|src)\s*=\s*)(["']).*?\2/gi,
      "$1<redacted>",
    )
    .replace(
      /((?:aria-label|placeholder|value|name|title|alt|href|src)\s*:\s*)(?:["'][^"']*["']|[^,;\s]+)/gi,
      "$1<redacted>",
    );
  return normalized.replace(/https?:\/\/[^\s)]+/g, (url) => safeUrl(url)).slice(0, maximumLength);
}

function safeErrorSummary(error) {
  return {
    name: error instanceof Error ? safeEvidenceText(error.name, 120) : "Error",
    message: safeEvidenceText(error instanceof Error ? error.message : error, 1000),
  };
}

function sanitizeAxeTarget(target) {
  if (Array.isArray(target)) return target.map((item) => sanitizeAxeTarget(item));
  return safeEvidenceText(target, 500);
}

function summarizeAxeRelatedNode(node) {
  const target = sanitizeAxeTarget(node?.target ?? []);
  return {
    target,
    targetSha256: createHash("sha256")
      .update(JSON.stringify(target))
      .digest("hex"),
  };
}

function summarizeAxeCheck(check) {
  return {
    id: safeEvidenceText(check?.id, 200),
    impact: check?.impact ?? null,
    message: safeEvidenceText(check?.message, 1000),
    relatedNodes: (check?.relatedNodes ?? []).map(summarizeAxeRelatedNode),
  };
}

function summarizeAxeRule(rule) {
  return {
    id: safeEvidenceText(rule?.id, 200),
    impact: rule?.impact ?? null,
    tags: (rule?.tags ?? []).map((tag) => safeEvidenceText(tag, 100)),
    description: safeEvidenceText(rule?.description, 1000),
    help: safeEvidenceText(rule?.help, 1000),
    helpUrl: safeUrl(rule?.helpUrl),
    nodeCount: rule?.nodes?.length ?? 0,
    nodes: (rule?.nodes ?? []).map((node) => {
      const target = sanitizeAxeTarget(node.target ?? []);
      return {
        impact: node.impact ?? null,
        target,
        targetSha256: createHash("sha256")
          .update(JSON.stringify(target))
          .digest("hex"),
        failureSummary: safeEvidenceText(node.failureSummary, 2000),
        any: (node.any ?? []).map(summarizeAxeCheck),
        all: (node.all ?? []).map(summarizeAxeCheck),
        none: (node.none ?? []).map(summarizeAxeCheck),
      };
    }),
  };
}

function summarizeBfcacheExplanation(explanation) {
  return {
    type: safeEvidenceText(explanation?.type, 200),
    reason: safeEvidenceText(explanation?.reason, 1000),
    contextPresent: Boolean(explanation?.context),
    details: (explanation?.details ?? []).map((detail) => ({
      url: safeUrl(detail.url),
      function: safeEvidenceText(detail.function, 500),
      lineNumber: Number.isInteger(detail.lineNumber) ? detail.lineNumber : null,
      columnNumber: Number.isInteger(detail.columnNumber) ? detail.columnNumber : null,
    })),
  };
}

function summarizeBfcacheExplanationTree(node) {
  if (!node || typeof node !== "object") return null;
  return {
    url: safeUrl(node.url),
    explanations: (node.explanations ?? []).map(summarizeBfcacheExplanation),
    children: (node.children ?? [])
      .map(summarizeBfcacheExplanationTree)
      .filter(Boolean),
  };
}

function summarizeBfcacheNotUsedEvent(event, phase) {
  return {
    phase,
    reasons: (event?.notRestoredExplanations ?? []).map(
      summarizeBfcacheExplanation,
    ),
    explanationTree: summarizeBfcacheExplanationTree(event?.notRestoredExplanationsTree),
  };
}

const probeInit = ({ candidateRoute, constrained, coarse }) => {
  const ledger = {
    documentId: crypto.randomUUID(),
    currentPhase: "navigation",
    fetch: [],
    xhr: [],
    webSocket: [],
    eventSource: [],
    beacon: [],
    storage: [],
    cookie: [],
    indexedDb: [],
    cache: [],
    serviceWorker: [],
    layoutShift: [],
    longTask: [],
    longAnimationFrame: [],
    raf: [],
    rafCallbacks: 0,
    pageShow: [],
    pageHide: [],
    visibilityChange: [],
    resize: [],
    instrumentation: [],
  };
  Object.defineProperty(window, "__cxosEvidence", {
    value: ledger,
    configurable: false,
    writable: false,
  });

  const sourceUrlFromStack = () => {
    const stack = String(new Error().stack ?? "");
    return stack.match(/https?:\/\/[^\s)]+/)?.[0] ?? null;
  };
  const privacySafeUrl = (rawUrl) => {
    try {
      const url = new URL(String(rawUrl), location.href);
      url.username = "";
      url.password = "";
      url.search = "";
      return url.toString();
    } catch {
      return "unavailable";
    }
  };
  const classifyOwnership = ({ key = null, sourceUrl = null, url = null } = {}) => {
    if (typeof key === "string" && /^(?:nextauth\.|next-auth\.)/i.test(key)) {
      return {
        ownership: "inherited-framework",
        ownershipEvidence: "NextAuth-owned persistence key",
      };
    }
    const rawUrl = url ?? sourceUrl;
    if (!rawUrl) {
      return {
        ownership: "first-party-unattributed",
        ownershipEvidence: "no attributable script or request URL",
      };
    }
    try {
      const parsed = new URL(rawUrl, location.href);
      const candidateChunkPrefix = `/_next/static/chunks/app${candidateRoute.replace(/\/$/, "")}/`;
      if (parsed.origin !== location.origin) {
        return { ownership: "external", ownershipEvidence: "cross-origin URL" };
      }
      if (parsed.pathname === candidateRoute || parsed.pathname.startsWith(candidateChunkPrefix)) {
        return {
          ownership: "candidate-owned",
          ownershipEvidence: "candidate route or route-specific chunk path",
        };
      }
      if (
        parsed.pathname === "/api/auth/session" ||
        parsed.pathname === "/api/auth/_log" ||
        /\/_next\/static\/chunks\/(?:webpack|main-app|framework|polyfills)-/.test(parsed.pathname) ||
        /\/_next\/static\/chunks\/\d+-[^/]+\.js$/.test(parsed.pathname) ||
        /\/_next\/static\/chunks\/app\/(?:layout|error)-/.test(parsed.pathname)
      ) {
        return {
          ownership: "inherited-framework",
          ownershipEvidence: "explicit Next.js or NextAuth path",
        };
      }
      return {
        ownership: "first-party-unattributed",
        ownershipEvidence: "same-origin URL without a candidate- or framework-specific marker",
      };
    } catch {
      return {
        ownership: "browser-unattributed",
        ownershipEvidence: "URL unavailable or unparsable",
      };
    }
  };
  const record = (sink, event, attribution = {}) => {
    const rawSourceUrl = attribution.sourceUrl ?? sourceUrlFromStack();
    const sourceUrl = rawSourceUrl ? privacySafeUrl(rawSourceUrl) : null;
    const ownership = classifyOwnership({ ...attribution, sourceUrl });
    const initiatorOwnership = sourceUrl
      ? classifyOwnership({ sourceUrl })
      : {
          ownership: "browser-unattributed",
          ownershipEvidence: "no initiating script URL",
        };
    sink.push({
      ...event,
      ...(event.url ? { url: privacySafeUrl(event.url) } : {}),
      recordedPhase: ledger.currentPhase,
      at: performance.now(),
      sourceUrl,
      ...ownership,
      initiatorOwnership: initiatorOwnership.ownership,
      initiatorOwnershipEvidence: initiatorOwnership.ownershipEvidence,
    });
  };

  if (constrained) {
    Object.defineProperty(navigator, "deviceMemory", { value: 2, configurable: true });
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
  }
  if (coarse) {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      query === "(pointer: coarse)"
        ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }
        : original(query);
  }
  const originalRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    const scheduledAt = performance.now();
    const scheduledPhase = ledger.currentPhase;
    const sourceUrl = sourceUrlFromStack();
    return originalRaf((time) => {
      ledger.rafCallbacks += 1;
      record(
        ledger.raf,
        { scheduledAt, scheduledPhase },
        { sourceUrl },
      );
      callback(time);
    });
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = (...args) => {
    const input = args[0];
    const requestUrl = input instanceof Request ? input.url : String(input);
    const method = args[1]?.method ?? (input instanceof Request ? input.method : "GET");
    record(ledger.fetch, { method: String(method).toUpperCase(), url: requestUrl }, { url: requestUrl });
    return originalFetch(...args);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    record(
      ledger.xhr,
      { method: String(method).toUpperCase(), url: String(url) },
      { url: String(url) },
    );
    return originalOpen.call(this, method, url, ...rest);
  };
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = class extends OriginalWebSocket {
    constructor(url, protocols) {
      record(ledger.webSocket, { url: String(url) }, { url: String(url) });
      super(url, protocols);
    }
  };
  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) {
    window.EventSource = class extends OriginalEventSource {
      constructor(url, options) {
        record(ledger.eventSource, { url: String(url) }, { url: String(url) });
        super(url, options);
      }
    };
  }
  const originalBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalBeacon) {
    navigator.sendBeacon = (url, data) => {
      record(ledger.beacon, { method: "POST", url: String(url) }, { url: String(url) });
      return originalBeacon(url, data);
    };
  }

  try {
    const storageName = (storage) => {
      try {
        if (storage === window.localStorage) return "localStorage";
        if (storage === window.sessionStorage) return "sessionStorage";
      } catch {
        // Storage access can itself be denied; retain an explicit unknown mechanism.
      }
      return "Storage";
    };
    for (const operation of ["setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[operation];
      Storage.prototype[operation] = function(...args) {
        const key = operation === "clear" ? null : String(args[0]);
        record(
          ledger.storage,
          {
            mechanism: storageName(this),
            operation,
            key,
            valueLength: operation === "setItem" ? String(args[1] ?? "").length : null,
          },
          { key },
        );
        return original.apply(this, args);
      };
    }
  } catch (error) {
    record(ledger.instrumentation, {
      mechanism: "Storage.prototype",
      status: "unavailable",
      error: String(error),
    });
  }

  const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
  if (cookieDescriptor?.set && cookieDescriptor.get) {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: cookieDescriptor.get.bind(document),
      set(value) {
        const serialized = String(value);
        const [pair, ...attributeParts] = serialized.split(";");
        const separator = pair.indexOf("=");
        const key = (separator === -1 ? pair : pair.slice(0, separator)).trim();
        record(
          ledger.cookie,
          {
            mechanism: "document.cookie",
            operation: "set",
            key,
            valueLength: separator === -1 ? 0 : pair.slice(separator + 1).length,
            attributes: attributeParts
              .map((part) => part.trim().split("=", 1)[0])
              .filter(Boolean),
          },
          { key },
        );
        return cookieDescriptor.set.call(document, value);
      },
    });
  }
  if (window.indexedDB) {
    for (const method of ["open", "deleteDatabase"]) {
      const original = window.indexedDB[method].bind(window.indexedDB);
      window.indexedDB[method] = (...args) => {
        const key = String(args[0]);
        record(
          ledger.indexedDb,
          {
            mechanism: "indexedDB",
            operation: method,
            key,
            version: method === "open" && args[1] !== undefined ? Number(args[1]) : null,
          },
          { key },
        );
        return original(...args);
      };
    }
  }
  if (window.caches && window.CacheStorage) {
    const cacheNames = new WeakMap();
    const originalCacheOpen = CacheStorage.prototype.open;
    CacheStorage.prototype.open = function(name) {
      const key = String(name);
      record(
        ledger.cache,
        { mechanism: "CacheStorage", operation: "open", key },
        { key },
      );
      const result = originalCacheOpen.call(this, name);
      result.then((cache) => cacheNames.set(cache, key)).catch(() => {});
      return result;
    };
    const originalCacheDelete = CacheStorage.prototype.delete;
    CacheStorage.prototype.delete = function(name) {
      const key = String(name);
      record(
        ledger.cache,
        { mechanism: "CacheStorage", operation: "delete", key },
        { key },
      );
      return originalCacheDelete.call(this, name);
    };
    if (window.Cache) {
      const requestKeys = (operation, args) => {
        const inputs = operation === "addAll" ? args[0] ?? [] : [args[0]];
        return [...inputs].map((input) => input instanceof Request ? input.url : String(input));
      };
      for (const operation of ["put", "add", "addAll", "delete"]) {
        const original = Cache.prototype[operation];
        Cache.prototype[operation] = function(...args) {
          const keys = requestKeys(operation, args);
          record(
            ledger.cache,
            {
              mechanism: "Cache",
              operation,
              cacheName: cacheNames.get(this) ?? null,
              key: keys.length === 1 ? keys[0] : null,
              keys,
            },
            { key: keys[0] ?? null },
          );
          return original.apply(this, args);
        };
      }
    }
  }
  if (navigator.serviceWorker?.register) {
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (scriptUrl, options) => {
      record(
        ledger.serviceWorker,
        {
          mechanism: "serviceWorker",
          operation: "register",
          key: String(scriptUrl),
          scope: options?.scope ? String(options.scope) : null,
        },
        { url: String(scriptUrl) },
      );
      return originalRegister(scriptUrl, options);
    };
  }

  const observe = (type, sink, options) => {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const serialized = entry.toJSON();
          let attribution;
          if (type === "long-animation-frame") {
            const sources = (serialized.scripts ?? [])
              .map((script) => script.sourceURL)
              .filter(Boolean);
            const owners = [...new Set(sources.map((sourceUrl) =>
              classifyOwnership({ sourceUrl }).ownership,
            ))];
            attribution = owners.length === 1
              ? classifyOwnership({ sourceUrl: sources[0] })
              : owners.length > 1
                ? {
                    ownership: "mixed",
                    ownershipEvidence: `multiple script owners: ${owners.join(", ")}`,
                  }
                : {
                    ownership: "first-party-unattributed",
                    ownershipEvidence: "long animation frame has no script source URL",
                  };
          } else if (type === "longtask") {
            const sourceUrl = (serialized.attribution ?? [])
              .map((item) => item.containerSrc)
              .find(Boolean);
            attribution = sourceUrl
              ? classifyOwnership({ sourceUrl })
              : {
                  ownership: "first-party-unattributed",
                  ownershipEvidence: "long-task attribution did not expose a container source",
                };
          } else {
            attribution = {
              ownership: "first-party-unattributed",
              ownershipEvidence: "layout-shift entries do not expose script ownership",
            };
          }
          sink.push({
            ...serialized,
            recordedPhase: ledger.currentPhase,
            observedAt: performance.now(),
            ...attribution,
          });
        }
      }).observe(options ?? { type, buffered: true });
    } catch {
      // Unsupported entry types are explicitly represented by an empty ledger.
    }
  };
  observe("layout-shift", ledger.layoutShift);
  observe("longtask", ledger.longTask);
  observe("long-animation-frame", ledger.longAnimationFrame);
  window.addEventListener("pageshow", (event) =>
    record(ledger.pageShow, { persisted: event.persisted, trusted: event.isTrusted }));
  window.addEventListener("pagehide", (event) =>
    record(ledger.pageHide, { persisted: event.persisted, trusted: event.isTrusted }));
  document.addEventListener("visibilitychange", (event) =>
    record(ledger.visibilityChange, {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      trusted: event.isTrusted,
    }));
  window.addEventListener("resize", (event) =>
    record(ledger.resize, {
      width: innerWidth,
      height: innerHeight,
      trusted: event.isTrusted,
    }));
};

async function beginPhase(page, phase) {
  return page.evaluate((phaseName) => {
    const ledger = window.__cxosEvidence;
    if (!ledger) throw new Error("CXOS evidence ledger is unavailable");
    ledger.currentPhase = phaseName;
    return {
      phase: phaseName,
      documentId: ledger.documentId,
      startedAt: performance.now(),
    };
  }, phase);
}

async function snapshot(page, phaseCursor, options = {}) {
  return page.evaluate(async ({ cursor, includeTargetSizes, targetSizeSelector }) => {
    // Yield once so pending PerformanceObserver deliveries are present before slicing.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ledger = window.__cxosEvidence;
    if (!ledger) throw new Error("CXOS evidence ledger is unavailable");
    const endedAt = performance.now();
    const documentChanged = Boolean(cursor.documentId) && cursor.documentId !== ledger.documentId;
    const startedAt = cursor.documentId && !documentChanged ? cursor.startedAt : 0;
    const arrayKeys = [
      "fetch",
      "xhr",
      "webSocket",
      "eventSource",
      "beacon",
      "storage",
      "cookie",
      "indexedDb",
      "cache",
      "serviceWorker",
      "layoutShift",
      "longTask",
      "longAnimationFrame",
      "raf",
      "pageShow",
      "pageHide",
      "visibilityChange",
      "resize",
      "instrumentation",
    ];
    const performanceKeys = new Set(["layoutShift", "longTask", "longAnimationFrame"]);
    const phaseEvidence = Object.fromEntries(arrayKeys.map((key) => [
      key,
      ledger[key].filter((entry) => {
        const timestamp = performanceKeys.has(key) ? entry.startTime : entry.at;
        return typeof timestamp === "number" && timestamp >= startedAt && timestamp <= endedAt;
      }),
    ]));
    phaseEvidence.rafCallbacks = phaseEvidence.raf.length;

    const clsFor = (entries) => entries
      .filter((entry) => !entry.hadRecentInput)
      .reduce((sum, entry) => sum + (entry.value ?? 0), 0);
    const durationFor = (entries) => entries
      .reduce((sum, entry) => sum + (entry.duration ?? 0), 0);
    const blockingFor = (entries) => entries
      .reduce((sum, entry) => sum + (entry.blockingDuration ?? 0), 0);
    const ownershipFor = (evidence, keys = arrayKeys) => keys
      .flatMap((key) => evidence[key])
      .reduce((summary, entry) => {
        const ownership = entry.ownership ?? "unknown";
        summary[ownership] = (summary[ownership] ?? 0) + 1;
        return summary;
      }, {});
    const evidenceCounts = Object.fromEntries(arrayKeys.map((key) => [key, ledger[key].length]));
    const phaseCls = clsFor(phaseEvidence.layoutShift);
    const cumulativeCls = clsFor(ledger.layoutShift);
    const root = document.querySelector("main[data-cxos-runtime]");
    // RC2 WP7: motion classification is structural — a running animation's
    // class (continuous/transient/scroll) and ownership are decided purely
    // from its resolved data-cxos-motion-channel token(s), never from a
    // keyframe-name regex. CHANNEL_TOKEN is the sole grammar.
    const CHANNEL_TOKEN = /^(continuous|transient|scroll):[a-z-]+$/;
    // Retained ONLY as a defense-in-depth safety net for detecting an
    // unclassified environment-surface animation (rule (d) below) when a
    // running animation has no ancestor-or-self data-cxos-motion-channel at
    // all. It is NEVER consulted to decide an animation's class or
    // ownership — that decision is 100% structural via CHANNEL_TOKEN. Kept
    // broad (covering every legacy and current Living-mode keyframe name,
    // including the WP2-introduced agencyLivingBreath/
    // agencyLivingBlockedPulse the original RC1 regex omitted) so a future
    // regression that reintroduces a motion-flavored keyframe without a
    // channel token still gets flagged instead of silently passing.
    const LEGACY_ENVIRONMENT_KEYFRAME_SAFETY_NET =
      /agency(?:Sweep|Breath|FlowEntering|FlowAdvancing|FlowWaiting|FlowBlocked|FlowResolving|ArtifactReveal|DistrictTruthDraw|DistrictOperatingMoment|FacilityChannel|ClientFloorSweep|TeamRecognition|ObservatoryScan|EvidenceRecognition|KaiRecognition|CapacityScan|LivingAcquire|LivingHeartbeat|LivingBreath|LivingBlockedPulse|LivingScroll)/;
    // Resolves the single token that applies to THIS running animation when
    // its owner declares more than one (currently only .districtEnvironment,
    // which carries "continuous:chamber-breath transient:chamber-acquire
    // scroll:depth-parallax" for three physically-distinct animations: the
    // breath on the owner itself, and the acquire/scroll pair on its
    // [data-plane="depth"] child, which the CSS cascade makes mutually
    // exclusive per chamber profile). Disambiguation uses only the
    // animation's own computed characteristics — never its keyframe name:
    // a ViewTimeline-backed animation is scroll; an infinite-iteration
    // animation is continuous; anything else is transient.
    const resolveMotionToken = (rawValue, timelineType, iterations) => {
      if (!rawValue) return null;
      const tokens = rawValue.split(/\s+/).filter((token) => CHANNEL_TOKEN.test(token));
      if (tokens.length === 0) return null;
      if (tokens.length === 1) return tokens[0];
      const byPrefix = (prefix) => tokens.find((token) => token.startsWith(`${prefix}:`));
      if (timelineType === "ViewTimeline") return byPrefix("scroll") ?? tokens[0];
      if (iterations === Infinity) return byPrefix("continuous") ?? tokens[0];
      return byPrefix("transient") ?? tokens[0];
    };
    const allAnimations = document.getAnimations({ subtree: true });
    const describeAnimationTime = (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return { value, unit: "ms", text: `${value}ms` };
      }
      if (value && typeof value.value === "number" && Number.isFinite(value.value)) {
        return {
          value: value.value,
          unit: typeof value.unit === "string" ? value.unit : null,
          text: String(value),
        };
      }
      return null;
    };
    const describeElement = (element) => {
      if (!(element instanceof Element)) return null;
      const href = element.getAttribute("href");
      let safeHref = null;
      if (href) {
        try {
          const url = new URL(href, location.href);
          safeHref = `${url.pathname}${url.hash}`;
        } catch {
          safeHref = "unavailable";
        }
      }
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: [...element.classList].slice(0, 4),
        role: element.getAttribute("role"),
        type: element.getAttribute("type"),
        href: safeHref,
      };
    };
    const animations = allAnimations.map((animation, index) => {
      const effect = animation.effect;
      const target = effect && "target" in effect ? effect.target : null;
      const motionOwner = target instanceof Element
        ? target.closest("[data-cxos-motion-channel]")
        : null;
      const timing = effect?.getComputedTiming?.() ?? {};
      const animationName = typeof animation.animationName === "string"
        ? animation.animationName
        : null;
      const motionChannel = motionOwner?.getAttribute("data-cxos-motion-channel") ?? null;
      const timelineType = animation.timeline?.constructor?.name ?? null;
      const iterations = timing.iterations ?? null;
      // Transitions (animationName null — CSS transitions, not CSS
      // animations) remain excluded from classification entirely: no
      // resolved token, not an environment surface, never a candidate for
      // the unclassified-environment-animation fail. Only genuine CSS
      // animations (or other Web Animations with a name) are classified.
      const resolvedMotionToken = animationName
        ? resolveMotionToken(motionChannel, timelineType, iterations)
        : null;
      const resolvedMotionClass = resolvedMotionToken
        ? resolvedMotionToken.slice(0, resolvedMotionToken.indexOf(":"))
        : null;
      // An "environment surface" animation is one that either already
      // resolved to an owned channel token, or is running on a known
      // decorative/environment structural marker ([data-plane] inside a
      // chamber, [data-environment] on the chamber environment host
      // itself), or matches the legacy-keyframe safety net above. Only
      // animations with NO resolvable token are candidates for the
      // unclassified-environment-animation fail; an owner that declares a
      // channel attribute whose value fails to parse into any valid token
      // is also a fail (a malformed/typo'd token is exactly as unowned as
      // no token at all).
      const environmentSurface = Boolean(animationName) && (
        Boolean(motionOwner) ||
        (target instanceof Element && Boolean(target.closest("[data-plane], [data-environment]"))) ||
        LEGACY_ENVIRONMENT_KEYFRAME_SAFETY_NET.test(animationName)
      );
      const unclassifiedEnvironmentAnimation = environmentSurface && !resolvedMotionToken;
      return {
        index,
        name: animationName,
        source: animationName ? "css-animation" : animation.constructor?.name ?? "animation",
        pseudoElement: effect && "pseudoElement" in effect ? effect.pseudoElement : null,
        target: describeElement(target),
        motionOwner: describeElement(motionOwner),
        motionChannel,
        resolvedMotionToken,
        resolvedMotionClass,
        environmentSurface,
        unclassifiedEnvironmentAnimation,
        playState: animation.playState,
        pending: animation.pending,
        playbackRate: animation.playbackRate,
        currentTime: typeof animation.currentTime === "number" ? animation.currentTime : null,
        currentTimeValue: describeAnimationTime(animation.currentTime),
        duration: typeof timing.duration === "number" ? timing.duration : null,
        durationValue: describeAnimationTime(timing.duration),
        progress: typeof timing.progress === "number" ? timing.progress : null,
        timelineType,
        timelineCurrentTimeValue: describeAnimationTime(animation.timeline?.currentTime),
        iterations,
      };
    });
    const runningAnimations = animations.filter((animation) => animation.playState === "running");
    // Rule (a): continuous:* is counted by DISTINCT running token.
    const runningContinuousTokens = [...new Set(
      runningAnimations
        .filter((animation) => animation.resolvedMotionClass === "continuous")
        .map((animation) => animation.resolvedMotionToken),
    )];
    // Rule (b): transient:* is grouped by full token, so staggered spans of
    // one recognition beat (e.g. N staggered list-item spans sharing one
    // ancestor token) count as ONE logical concurrent beat, not N.
    const runningTransientTokens = [...new Set(
      runningAnimations
        .filter((animation) => animation.resolvedMotionClass === "transient")
        .map((animation) => animation.resolvedMotionToken),
    )];
    // Rule (c): scroll:* is tracked for evidence but excluded from the
    // continuous count above (formalizes existing behavior).
    const runningScrollTokens = [...new Set(
      runningAnimations
        .filter((animation) => animation.resolvedMotionClass === "scroll")
        .map((animation) => animation.resolvedMotionToken),
    )];
    // Rule (b) continued: every individual running transient:* animation
    // instance (not just the distinct token) must be a single-iteration,
    // <=1500ms beat.
    const transientTimingViolations = runningAnimations
      .filter((animation) => animation.resolvedMotionClass === "transient")
      .filter((animation) =>
        animation.iterations !== 1 ||
        typeof animation.duration !== "number" ||
        animation.duration > 1500,
      )
      .map((animation) => ({
        name: animation.name,
        token: animation.resolvedMotionToken,
        pseudoElement: animation.pseudoElement,
        target: animation.target,
        iterations: animation.iterations,
        duration: animation.duration,
      }));
    // Rule (d): any running animation on an environment surface with no
    // resolvable channel token — this is the budget-bypass hole the old
    // regex-only classifier left open (a running motion-flavored animation
    // whose token didn't match the legacy declared-channel list was
    // silently invisible to the budget, never a fail).
    const unclassifiedEnvironmentAnimations = runningAnimations
      .filter((animation) => animation.unclassifiedEnvironmentAnimation)
      .map((animation) => ({
        name: animation.name,
        pseudoElement: animation.pseudoElement,
        target: animation.target,
      }));
    const tier = root?.getAttribute("data-cxos-tier") ?? root?.getAttribute("data-tier") ?? "D";
    const tierMaximum = tier === "A" ? 2 : tier === "B" ? 1 : 0;
    const declaredBudget = Number(root?.getAttribute("data-cxos-animation-budget") ?? 0);
    const quietReasons = [];
    if (!root || root.getAttribute("data-cxos-environment-motion") !== "active") {
      quietReasons.push("environment-motion");
    }
    if (root?.getAttribute("data-cxos-idle") !== "engaged") quietReasons.push("idle");
    if (root?.getAttribute("data-cxos-attention") !== "ambient") quietReasons.push("attention");
    if (root?.getAttribute("data-cxos-kai") !== "quiet") quietReasons.push("kai");
    if (root?.getAttribute("data-cxos-phase") !== "operating") quietReasons.push("lifecycle");
    if (root?.getAttribute("data-hidden") === "true") quietReasons.push("hidden");
    if (root?.getAttribute("data-cxos-district-transition") === "passage") quietReasons.push("passage");
    const expectedMaximum = quietReasons.length > 0 ? 0 : tierMaximum;
    const targetSizeTargets = includeTargetSizes
      ? [...document.querySelectorAll(targetSizeSelector)]
          .filter((element) => {
            if (!(element instanceof HTMLElement)) return false;
            if (element.matches("[aria-disabled='true']")) return false;
            if (element.closest("[hidden], [inert], [aria-hidden='true']")) {
              return false;
            }
            const closedDetails = element.closest("details:not([open])");
            if (closedDetails && !element.closest("summary")) return false;
            const style = getComputedStyle(element);
            return style.visibility !== "hidden" &&
              style.display !== "none" &&
              style.pointerEvents !== "none" &&
              Number(style.opacity) > 0 &&
              element.getClientRects().length > 0;
          })
          .map((element, index) => {
            const rect = element.getBoundingClientRect();
            const width = Math.round(rect.width * 100) / 100;
            const height = Math.round(rect.height * 100) / 100;
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const centerInViewport =
              centerX >= 0 && centerX < innerWidth &&
              centerY >= 0 && centerY < innerHeight;
            const topmost = centerInViewport
              ? document.elementFromPoint(centerX, centerY)
              : null;
            const obstructed = Boolean(
              centerInViewport &&
              topmost &&
              topmost !== element &&
              !element.contains(topmost) &&
              !topmost.contains(element),
            );
            return {
              index,
              source: describeElement(element),
              width,
              height,
              meets44px: width >= 44 && height >= 44,
              centerInViewport,
              obstructed,
              occluder: obstructed ? describeElement(topmost) : null,
              // sampleOffViewportObstruction() (Node-side, post-CLS) fills
              // these in for every target whose center was off-viewport at
              // rest; a naturally in-viewport target is already sampled.
              sampled: centerInViewport,
              skipReason: null,
            };
          })
      : [];
    const undersizedTargets = targetSizeTargets.filter((target) => !target.meets44px);
    const obstructedTargets = targetSizeTargets.filter((target) => target.obstructed);
    return {
      href: location.href,
      title: document.title,
      root: root
        ? Object.fromEntries(
            [...root.attributes]
              .filter((attribute) => attribute.name.startsWith("data-"))
              .map((attribute) => [attribute.name, attribute.value]),
          )
        : null,
      activeElement: describeElement(document.activeElement),
      districtCount: document.querySelectorAll("[data-cxos-district]").length,
      visibleDistricts: [...document.querySelectorAll("[data-cxos-district]")]
        .filter((element) => !element.hidden && element.getClientRects().length > 0)
        .map((element) => element.id),
      animations: {
        total: allAnimations.length,
        running: allAnimations.filter((animation) => animation.playState === "running").length,
        paused: allAnimations.filter((animation) => animation.playState === "paused").length,
        details: animations,
        motionBudget: {
          tier,
          tierMaximum,
          declaredBudget,
          expectedMaximum,
          quietReasons,
          // Structural (RC2 WP7) fields — the actual classification.
          runningContinuousTokens,
          runningTransientTokens,
          runningScrollTokens,
          transientTimingViolations,
          unclassifiedEnvironmentAnimations,
          // Backward-compatible fields other report/gate code still reads
          // (scripts/cxos-living-environment/browser.mjs's own
          // evaluateCaseAcceptance and evaluateReportAcceptance, plus the
          // "idle-work" check). Their names are unchanged; their meaning is
          // now the structural continuous-channel count/list and the
          // structural unclassified-animation list, replacing the old
          // regex+declared-list computation.
          runningChannels: runningContinuousTokens,
          runningChannelCount: runningContinuousTokens.length,
          runningEnvironmentAnimationCount: runningContinuousTokens.length,
          unownedRunningEnvironmentAnimations: unclassifiedEnvironmentAnimations,
          passes:
            declaredBudget <= expectedMaximum &&
            runningContinuousTokens.length <= expectedMaximum &&
            runningTransientTokens.length <= 3 &&
            transientTimingViolations.length === 0 &&
            unclassifiedEnvironmentAnimations.length === 0,
        },
      },
      targetSize: includeTargetSizes
        ? {
            minimumPx: 44,
            measured: targetSizeTargets.length,
            failures: undersizedTargets.length,
            obstructionMeasured: targetSizeTargets.filter(
              (target) => target.centerInViewport,
            ).length,
            obstructionFailures: obstructedTargets.length,
            targets: targetSizeTargets,
          }
        : null,
      inspection: {
        openIds: [...document.querySelectorAll("details[data-cxos-inspection][open]")]
          .map((element) => element.id || null),
      },
      kai: {
        turnCount: document.querySelectorAll(
          "div[aria-label='Route-local Kai preview continuity'] > ol > li",
        ).length,
        inputLength: document.querySelector("#kai-synthetic-command")?.value?.length ?? 0,
      },
      phase: {
        name: cursor.phase,
        documentId: ledger.documentId,
        documentChangedSinceStart: documentChanged,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
      },
      performance: {
        phase: {
          cls: phaseCls,
          layoutShiftCount: phaseEvidence.layoutShift.length,
          longTaskCount: phaseEvidence.longTask.length,
          longTaskDurationMs: durationFor(phaseEvidence.longTask),
          longAnimationFrameCount: phaseEvidence.longAnimationFrame.length,
          longAnimationFrameDurationMs: durationFor(phaseEvidence.longAnimationFrame),
          longAnimationFrameBlockingDurationMs: blockingFor(phaseEvidence.longAnimationFrame),
          rafCallbacks: phaseEvidence.rafCallbacks,
          ownership: ownershipFor(
            phaseEvidence,
            ["layoutShift", "longTask", "longAnimationFrame", "raf"],
          ),
        },
        cumulative: {
          cls: cumulativeCls,
          layoutShiftCount: ledger.layoutShift.length,
          longTaskCount: ledger.longTask.length,
          longTaskDurationMs: durationFor(ledger.longTask),
          longAnimationFrameCount: ledger.longAnimationFrame.length,
          longAnimationFrameDurationMs: durationFor(ledger.longAnimationFrame),
          longAnimationFrameBlockingDurationMs: blockingFor(ledger.longAnimationFrame),
          rafCallbacks: ledger.rafCallbacks,
          ownership: ownershipFor(
            ledger,
            ["layoutShift", "longTask", "longAnimationFrame", "raf"],
          ),
        },
      },
      // Compatibility fields now intentionally mean this phase, not the whole case.
      cls: phaseCls,
      cumulativeCls,
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      physicalViewport: {
        width: Math.round(innerWidth * devicePixelRatio),
        height: Math.round(innerHeight * devicePixelRatio),
      },
      evidence: phaseEvidence,
      evidenceTotals: {
        counts: evidenceCounts,
        rafCallbacks: ledger.rafCallbacks,
        ownership: ownershipFor(ledger),
      },
    };
  }, {
    cursor: phaseCursor,
    includeTargetSizes: options.includeTargetSizes === true,
    targetSizeSelector: TARGET_SIZE_SELECTOR,
  });
}

async function visibleLocator(page, selector) {
  const matches = page.locator(selector);
  const count = await matches.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = matches.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  throw new Error(`No visible element matched ${selector}`);
}

async function waitForUiCommit(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  ));
}

async function measureScrollLinkedChoreography(page, districtId) {
  const read = () => page.evaluate(() => {
    const describeTime = (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return { value, unit: "ms", text: `${value}ms` };
      }
      if (value && typeof value.value === "number" && Number.isFinite(value.value)) {
        return {
          value: value.value,
          unit: typeof value.unit === "string" ? value.unit : null,
          text: String(value),
        };
      }
      return null;
    };
    const root = document.querySelector("main[data-cxos-runtime]");
    const target = root?.querySelector(
      "section[data-current='true']:not([hidden]) [data-plane='depth']",
    ) ?? null;
    const animation = target?.getAnimations().find((candidate) =>
      /agencyLivingScroll/.test(candidate.animationName ?? "")
    ) ?? null;
    const timing = animation?.effect?.getComputedTiming?.() ?? null;
    const computedTransform = target ? getComputedStyle(target).transform : null;
    let transform = null;
    if (computedTransform) {
      try {
        const matrix = new DOMMatrixReadOnly(
          computedTransform === "none" ? undefined : computedTransform,
        );
        transform = {
          text: computedTransform,
          translateX: matrix.m41,
          translateY: matrix.m42,
        };
      } catch {
        transform = { text: computedTransform, translateX: null, translateY: null };
      }
    }
    return {
      supported: CSS.supports("animation-timeline: view()"),
      rootProfile: root?.getAttribute("data-cxos-profile") ?? null,
      targetFound: Boolean(target),
      animationFound: Boolean(animation),
      animationName: animation?.animationName ?? null,
      playState: animation?.playState ?? null,
      timelineType: animation?.timeline?.constructor?.name ?? null,
      timelineSubjectMatches: animation?.timeline?.subject === target,
      timelineSourceIsDocumentScroller:
        animation?.timeline?.source === document.scrollingElement,
      timelineCurrentTime: describeTime(animation?.timeline?.currentTime),
      currentTime: describeTime(animation?.currentTime),
      duration: describeTime(timing?.duration),
      progress: typeof timing?.progress === "number" ? timing.progress : null,
      transform,
      scrollY,
      maxScrollY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    };
  });

  const scrollSetup = await page.evaluate(() => {
    const priorInlineScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    return { originalScrollY: scrollY, priorInlineScrollBehavior };
  });
  const originalScrollY = scrollSetup.originalScrollY;
  await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "auto" }));
  await waitForUiCommit(page);
  const start = await read();
  const endY = Math.max(0, start.maxScrollY);
  await page.evaluate(
    (nextY) => scrollTo({ top: nextY, left: 0, behavior: "auto" }),
    endY,
  );
  await waitForUiCommit(page);
  const end = await read();
  await page.evaluate(
    ({ nextY, priorInlineScrollBehavior }) => {
      scrollTo({ top: nextY, left: 0, behavior: "auto" });
      document.documentElement.style.scrollBehavior = priorInlineScrollBehavior;
    },
    { nextY: originalScrollY, priorInlineScrollBehavior: scrollSetup.priorInlineScrollBehavior },
  );
  await waitForUiCommit(page);

  const progressDelta =
    typeof start.progress === "number" && typeof end.progress === "number"
      ? Math.abs(end.progress - start.progress)
      : null;
  const currentTimeDelta =
    start.currentTime?.unit === end.currentTime?.unit &&
      typeof start.currentTime?.value === "number" &&
      typeof end.currentTime?.value === "number"
      ? Math.abs(end.currentTime.value - start.currentTime.value)
      : null;
  const endpointResponsive =
    (progressDelta !== null && progressDelta >= 0.05) ||
    (currentTimeDelta !== null && currentTimeDelta >= 5);
  const genuineViewTimeline =
    start.timelineType === "ViewTimeline" &&
    end.timelineType === "ViewTimeline" &&
    start.timelineSubjectMatches &&
    end.timelineSubjectMatches &&
    start.timelineSourceIsDocumentScroller &&
    end.timelineSourceIsDocumentScroller;
  const nonzeroDuration =
    typeof start.duration?.value === "number" && start.duration.value > 0 &&
    typeof end.duration?.value === "number" && end.duration.value > 0;
  const transformDelta =
    typeof start.transform?.translateX === "number" &&
      typeof start.transform?.translateY === "number" &&
      typeof end.transform?.translateX === "number" &&
      typeof end.transform?.translateY === "number"
      ? Math.hypot(
          end.transform.translateX - start.transform.translateX,
          end.transform.translateY - start.transform.translateY,
        )
      : null;
  const renderedTransformResponsive = transformDelta !== null && transformDelta >= 4;
  const traversedScrollDistance = Math.abs(end.scrollY - start.scrollY);

  return {
    supported: start.supported && end.supported,
    originalScrollY,
    start,
    end,
    progressDelta,
    currentTimeDelta,
    endpointResponsive,
    transformDelta,
    renderedTransformResponsive,
    traversedScrollDistance,
    genuineViewTimeline,
    nonzeroDuration,
    passed:
      start.supported &&
      start.rootProfile === districtId &&
      start.animationFound &&
      end.animationFound &&
      genuineViewTimeline &&
      nonzeroDuration &&
      endpointResponsive &&
      renderedTransformResponsive &&
      traversedScrollDistance > 1,
  };
}

// RC2 WP7: post-CLS scroll-restored obstruction probe. Runs strictly AFTER
// the calling site's normal capture() for that state, so it never
// contaminates the CLS/animation-sensitive numbers already recorded on
// `state`. For every target whose center was off-viewport at rest, this
// scrolls it to the viewport center, hit-tests its true center point, then
// restores the exact prior scroll position before moving to the next
// target. Mutates `state.targetSize` in place (additive: width/height/
// meets44px from the original at-rest measurement are left untouched,
// since element size does not depend on scroll position).
async function sampleOffViewportObstruction(page, state) {
  if (!state.targetSize) return;
  const offViewportIndices = state.targetSize.targets
    .filter((target) => !target.centerInViewport)
    .map((target) => target.index);
  const sampling = offViewportIndices.length > 0
    ? await page.evaluate(async ({ selector, indices }) => {
        const priorInlineScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        const isEligible = (element) => {
          if (!(element instanceof HTMLElement)) return false;
          if (element.matches("[aria-disabled='true']")) return false;
          if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
          const closedDetails = element.closest("details:not([open])");
          if (closedDetails && !element.closest("summary")) return false;
          const style = getComputedStyle(element);
          return style.visibility !== "hidden" &&
            style.display !== "none" &&
            style.pointerEvents !== "none" &&
            Number(style.opacity) > 0 &&
            element.getClientRects().length > 0;
        };
        const describeElement = (element) => {
          if (!(element instanceof Element)) return null;
          const href = element.getAttribute("href");
          let safeHref = null;
          if (href) {
            try {
              const url = new URL(href, location.href);
              safeHref = `${url.pathname}${url.hash}`;
            } catch {
              safeHref = "unavailable";
            }
          }
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            classes: [...element.classList].slice(0, 4),
            role: element.getAttribute("role"),
            type: element.getAttribute("type"),
            href: safeHref,
          };
        };
        // Re-derives the exact same ordered candidate list snapshot()
        // built (same selector, same admission filter, same order); the
        // DOM has not changed since that capture, so index correspondence
        // holds.
        const candidates = [...document.querySelectorAll(selector)];
        const results = [];
        for (const index of indices) {
          const element = candidates[index];
          if (!element || !element.isConnected) {
            results.push({ index, sampled: false, skipReason: "detached" });
            continue;
          }
          if (!isEligible(element)) {
            results.push({ index, sampled: false, skipReason: "covered-by-definition" });
            continue;
          }
          const originalScrollX = scrollX;
          const originalScrollY = scrollY;
          element.scrollIntoView({ block: "center" });
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          const rect = element.getBoundingClientRect();
          const width = Math.round(rect.width * 100) / 100;
          const height = Math.round(rect.height * 100) / 100;
          if (width <= 0 || height <= 0) {
            scrollTo({ top: originalScrollY, left: originalScrollX, behavior: "auto" });
            results.push({ index, sampled: false, skipReason: "zero-size", width, height });
            continue;
          }
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const topmost = document.elementFromPoint(centerX, centerY);
          const obstructed = Boolean(
            topmost &&
            topmost !== element &&
            !element.contains(topmost) &&
            !topmost.contains(element),
          );
          scrollTo({ top: originalScrollY, left: originalScrollX, behavior: "auto" });
          results.push({
            index,
            sampled: true,
            skipReason: null,
            obstructed,
            occluder: obstructed ? describeElement(topmost) : null,
          });
        }
        document.documentElement.style.scrollBehavior = priorInlineScrollBehavior;
        return results;
      }, { selector: TARGET_SIZE_SELECTOR, indices: offViewportIndices })
    : [];

  const byIndex = new Map(sampling.map((entry) => [entry.index, entry]));
  for (const target of state.targetSize.targets) {
    if (target.centerInViewport) {
      target.sampled = true;
      target.skipReason = null;
      continue;
    }
    const entry = byIndex.get(target.index);
    if (!entry) {
      target.sampled = false;
      target.skipReason = "detached";
      continue;
    }
    target.sampled = entry.sampled;
    target.skipReason = entry.skipReason;
    if (entry.sampled) {
      target.obstructed = entry.obstructed;
      target.occluder = entry.occluder ?? null;
    }
  }

  const measured = state.targetSize.targets.filter((target) => target.sampled).length;
  const skipped = state.targetSize.targets.filter((target) => !target.sampled).length;
  const reasons = state.targetSize.targets.reduce((tally, target) => {
    if (!target.sampled && target.skipReason) {
      tally[target.skipReason] = (tally[target.skipReason] ?? 0) + 1;
    }
    return tally;
  }, {});
  state.targetSize.obstructionMeasured = measured;
  state.targetSize.obstructionFailures = state.targetSize.targets.filter(
    (target) => target.sampled && target.obstructed,
  ).length;
  state.targetSize.obstructionSampling = { measured, skipped, reasons };
}

// RC2 WP7 post-processing only: never mutates the raw browser-captured
// longTask/longAnimationFrame entries themselves, only adds a sibling
// `attributionResolved` field per long task. Long Tasks with no
// script-attributed source (containerType "window", empty containerSrc —
// the Long Task API's own ceiling; it cannot name a script) inherit the
// script-derived ownership of a containing Long Animation Frame recorded in
// the SAME case/step window when one exists.
function resolveLongTaskAttribution(state) {
  const longTasks = state.evidence?.longTask ?? [];
  const longAnimationFrames = state.evidence?.longAnimationFrame ?? [];
  for (const task of longTasks) {
    const taskStart = task.startTime;
    const taskEnd = task.startTime + (task.duration ?? 0);
    const matchingLoaf = longAnimationFrames.find(
      (loaf) =>
        typeof loaf.startTime === "number" &&
        typeof loaf.duration === "number" &&
        loaf.startTime <= taskStart &&
        loaf.startTime + loaf.duration >= taskEnd,
    );
    if (matchingLoaf) {
      task.attributionResolved = {
        source: "long-animation-frame-join",
        ownership: matchingLoaf.ownership,
        ownershipEvidence: `inherited from a containing Long Animation Frame: ${matchingLoaf.ownershipEvidence}`,
        loafStartTime: matchingLoaf.startTime,
        loafDuration: matchingLoaf.duration,
      };
      continue;
    }
    const rawAttribution = Array.isArray(task.attribution) ? task.attribution : [];
    const windowContainerNoSrc =
      rawAttribution.length > 0 &&
      rawAttribution.every(
        (item) => item?.containerType === "window" && !item?.containerSrc,
      );
    task.attributionResolved = windowContainerNoSrc
      ? {
          source: "long-task-api-unattributable",
          ownership: "first-party-unattributed",
          ownershipEvidence:
            "long-task-api-unattributable: containerType window with no script source, and no containing Long Animation Frame recorded a script-derived owner",
        }
      : {
          source: "long-task-attribution",
          ownership: task.ownership,
          ownershipEvidence: task.ownershipEvidence,
        };
  }
}

// Additive median/max aggregation across a case's repeated
// chamber:cycle-N states (WP7 landscape breadth: n>=3 samples instead of a
// single potentially-noisy data point).
function summarizeBlockingDurations(values) {
  const finite = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return { samples: 0, median: null, max: null };
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return { samples: sorted.length, median, max: sorted[sorted.length - 1] };
}

// Idempotent: safe to call before every axe run (the single full-page audit
// and each per-chamber audit) regardless of call order.
async function ensureAxeLoaded(page) {
  const loaded = await page.evaluate(() => typeof window.axe !== "undefined");
  if (!loaded) await page.addScriptTag({ path: axePath });
}

async function runAxeAudit(page) {
  return page.evaluate(
    async (runOnlyValues) =>
      window.axe.run(document, { runOnly: { type: "tag", values: runOnlyValues } }),
    AXE_RUNONLY_TAGS,
  );
}

async function activate(locator, mode) {
  await locator.scrollIntoViewIfNeeded();
  if (mode === "touch") {
    await locator.tap();
    return;
  }
  if (mode === "keyboard") {
    await locator.focus();
    await locator.press("Enter");
    return;
  }
  await locator.click();
}

async function setControlledInput(locator, value) {
  await locator.focus();
  await locator.evaluate((element, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (!descriptor?.set) {
      throw new Error("Native HTMLInputElement value setter is unavailable");
    }
    descriptor.set.call(element, nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function settleArrival(page, mode, activation) {
  const root = page.locator("main[data-cxos-runtime]");
  if ((await root.getAttribute("data-arrival-settled")) === "true") {
    return "static-auto";
  }

  if (mode === "natural") {
    await page.waitForFunction(() =>
      document.querySelector("main[data-arrival-settled='true']"),
    );
    return "natural";
  }
  if (mode === "escape") {
    await page.keyboard.press("Escape");
  } else {
    const skip = page.getByRole("button", { name: "Skip arrival" });
    await activate(skip, activation);
  }
  await page.waitForFunction(() =>
    document.querySelector("main[data-arrival-settled='true']"),
  );
  return mode;
}

async function waitForSettledShot(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector("main[data-cxos-runtime]");
    const threshold = document.querySelector(
      "[aria-label='Agency Command arrival']",
    );
    const gate = threshold?.parentElement;
    if (root?.getAttribute("data-arrival-settled") !== "true") return false;
    if (!(gate instanceof HTMLElement)) return true;
    const style = getComputedStyle(gate);
    return style.visibility === "hidden" && Number(style.opacity) <= 0.001;
  });
  await waitForUiCommit(page);
}

async function waitForDistrict(page, district) {
  await page.waitForFunction(
    (id) => {
      const root = document.querySelector("main[data-cxos-runtime]");
      return root?.getAttribute("data-active-district") === id &&
        root.getAttribute("data-cxos-district-transition") === "settled";
    },
    district,
  );
  await waitForUiCommit(page);
}

async function waitForHistoryDistrict(page) {
  let converged = true;
  let timeoutError = null;
  try {
    await page.waitForFunction((districts) => {
      let hashDistrict;
      try {
        hashDistrict = decodeURIComponent(location.hash.replace(/^#/, ""));
      } catch {
        hashDistrict = "";
      }
      const expectedDistrict = districts.includes(hashDistrict)
        ? hashDistrict
        : districts[0];
      const root = document.querySelector("main[data-cxos-runtime]");
      return root?.getAttribute("data-active-district") === expectedDistrict &&
        root.getAttribute("data-cxos-district-transition") === "settled";
    }, DISTRICTS);
  } catch (error) {
    converged = false;
    timeoutError = error instanceof Error ? error.name : "history-timeout";
  }
  await waitForUiCommit(page);
  return page.evaluate(({ districts, didConverge, errorName }) => {
    let hashDistrict;
    try {
      hashDistrict = decodeURIComponent(location.hash.replace(/^#/, ""));
    } catch {
      hashDistrict = "";
    }
    const root = document.querySelector("main[data-cxos-runtime]");
    return {
      hash: location.hash,
      expectedDistrict: districts.includes(hashDistrict) ? hashDistrict : districts[0],
      activeDistrict: root?.getAttribute("data-active-district") ?? null,
      transition: root?.getAttribute("data-cxos-district-transition") ?? null,
      converged: didConverge,
      timeoutError: errorName,
    };
  }, { districts: DISTRICTS, didConverge: converged, errorName: timeoutError });
}

async function navigateToDistrict(page, district, { activation, method = "direct" }) {
  const current = await page.locator("main").getAttribute("data-active-district");
  if (current === district) return false;

  let selector;
  if (method === "next" || method === "previous") {
    selector = `section[data-current='true'] nav[aria-label$='facility navigation'] a[href='#${district}']`;
  } else {
    selector = `nav[aria-label='Agency Command facility map'] a[href='#${district}']`;
  }

  let link;
  try {
    link = await visibleLocator(page, selector);
  } catch {
    const mapSummary = await visibleLocator(
      page,
      `nav[aria-label='Agency Command facility map'] details:has(a[href='#${district}']) > summary`,
    );
    await activate(mapSummary, activation);
    link = await visibleLocator(page, selector);
  }
  await activate(link, activation);
  await waitForDistrict(page, district);
  return true;
}

async function setSyntheticVisibility(page, hidden) {
  return page.evaluate((nextHidden) => {
    const state = window.__cxosSyntheticVisibility ?? { hidden: false, installed: false };
    state.hidden = nextHidden;
    if (!state.installed) {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => state.hidden,
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state.hidden ? "hidden" : "visible",
      });
      state.installed = true;
      Object.defineProperty(window, "__cxosSyntheticVisibility", {
        value: state,
        configurable: true,
      });
    }
    document.dispatchEvent(new Event("visibilitychange"));
    return {
      mechanism: "document-property-override",
      hidden: document.hidden,
      visibilityState: document.visibilityState,
    };
  }, hidden);
}

async function dispatchSyntheticPageTransition(page, type, persisted = true) {
  await page.evaluate(({ eventType, isPersisted }) => {
    let event;
    try {
      event = new PageTransitionEvent(eventType, { persisted: isPersisted });
    } catch {
      event = new Event(eventType);
      Object.defineProperty(event, "persisted", { value: isPersisted });
    }
    window.dispatchEvent(event);
  }, { eventType: type, isPersisted: persisted });
  await waitForUiCommit(page);
}

function evaluateCaseAcceptance(result) {
  const findings = [];
  const observations = [];
  const add = (code, phase, message, evidence = {}) => {
    const item = { severity: "P1", code, phase, message, evidence };
    if (captureMissingFeatures) observations.push(item);
    else findings.push(item);
  };

  for (const state of result.states) {
    const budget = state.animations.motionBudget;
    if (!budget.passes) {
      add(
        "motion-budget",
        state.step,
        "The structural continuous/transient/scroll motion-channel budget failed.",
        {
          tier: budget.tier,
          declaredBudget: budget.declaredBudget,
          expectedMaximum: budget.expectedMaximum,
          runningChannels: budget.runningChannels,
          runningEnvironmentAnimationCount:
            budget.runningEnvironmentAnimationCount,
          unownedRunningEnvironmentAnimations:
            budget.unownedRunningEnvironmentAnimations,
          runningTransientTokens: budget.runningTransientTokens,
          runningScrollTokens: budget.runningScrollTokens,
          transientTimingViolations: budget.transientTimingViolations,
          quietReasons: budget.quietReasons,
        },
      );
    }
    if (budget.unclassifiedEnvironmentAnimations.length > 0) {
      add(
        "unclassified-environment-animation",
        state.step,
        "A running animation on an environment/decorative surface has no resolvable data-cxos-motion-channel token.",
        { animations: budget.unclassifiedEnvironmentAnimations },
      );
    }
    if (state.overflowX > 0) {
      add("horizontal-overflow", state.step, "The document has horizontal overflow.", {
        overflowX: state.overflowX,
        viewport: state.viewport,
      });
    }
    if (state.targetSize?.failures > 0) {
      add("target-size", state.step, "One or more visible controls are smaller than 44px.", {
        failures: state.targetSize.failures,
        measured: state.targetSize.measured,
        targets: state.targetSize.targets.filter((target) => !target.meets44px),
      });
    }
    if (state.targetSize?.obstructionFailures > 0) {
      add("control-obstruction", state.step, "One or more in-viewport controls are obstructed at their center point.", {
        failures: state.targetSize.obstructionFailures,
        measured: state.targetSize.obstructionMeasured,
        targets: state.targetSize.targets.filter((target) => target.obstructed),
      });
    }
    if (state.cls > 0.01) {
      add("phase-cls", state.step, "Non-input CLS exceeded the approximately-zero 0.01 phase budget.", {
        cls: state.cls,
        maximum: 0.01,
      });
    }

    if (
      ["inspection:toggle-close", "inspection:escape-close"].includes(state.step) &&
      (state.inspection.openIds.length > 0 || state.closeVerified !== true)
    ) {
      add("inspection-close", state.step, "The inspection did not reach a verified closed state.", {
        openIds: state.inspection.openIds,
      });
    }
    if (state.step === "inspection:escape-close" && state.focusRestored !== true) {
      add("inspection-focus", state.step, "Escape did not restore focus to the inspection summary.");
    }
    if (
      state.step === "kai:stage" &&
      state.root?.["data-cxos-kai"] !== "staged"
    ) {
      add("kai-stage", state.step, "Kai did not expose the explicit staged presentation state.");
    }
    if (
      state.step === "kai:resolve" &&
      (state.root?.["data-cxos-kai"] !== "resolved" || state.kai.turnCount !== 1)
    ) {
      add("kai-resolve", state.step, "Kai did not resolve exactly one deterministic preview.", {
        kaiState: state.root?.["data-cxos-kai"],
        turnCount: state.kai.turnCount,
      });
    }
    if (
      state.step === "kai:clear" &&
      (state.root?.["data-cxos-kai"] !== "quiet" ||
        state.kai.turnCount !== 0 ||
        state.kai.inputLength !== 0)
    ) {
      add("kai-clear", state.step, "Clearing Kai left route-local presentation state behind.", {
        kaiState: state.root?.["data-cxos-kai"],
        turnCount: state.kai.turnCount,
        inputLength: state.kai.inputLength,
      });
    }
    if (
      state.step === "visibility:hidden" &&
      state.root?.["data-hidden"] !== "true"
    ) {
      add("visibility-hidden", state.step, "The hidden-document projection was not applied.");
    }
    if (
      state.step === "visibility:visible" &&
      state.root?.["data-hidden"] !== "false"
    ) {
      add("visibility-visible", state.step, "The visible-document projection was not restored.");
    }
    if (state.step === "lifecycle:pagehide-persisted") {
      const hasEvent = state.evidence.pageHide.some(
        (event) => event.persisted === true && event.trusted === false,
      );
      if (
        !hasEvent ||
        state.root?.["data-active-district"] !== "central-command" ||
        state.root?.["data-cxos-idle"] !== "settled" ||
        state.root?.["data-cxos-kai"] !== "quiet" ||
        state.inspection.openIds.length !== 0
      ) {
        add("pagehide-reset", state.step, "Synthetic persisted pagehide did not clear all route-local presentation state.", {
          eventRecorded: hasEvent,
          activeDistrict: state.root?.["data-active-district"],
          idle: state.root?.["data-cxos-idle"],
          kai: state.root?.["data-cxos-kai"],
          openInspectionIds: state.inspection.openIds,
        });
      }
    }
    if (state.step === "lifecycle:pageshow-persisted") {
      const hasEvent = state.evidence.pageShow.some(
        (event) => event.persisted === true && event.trusted === false,
      );
      if (
        !hasEvent ||
        state.restoredHistory?.converged !== true ||
        state.root?.["data-active-district"] !== "kai-suite" ||
        state.root?.["data-cxos-kai"] !== "quiet" ||
        state.inspection.openIds.length !== 0
      ) {
        add("pageshow-reset", state.step, "Synthetic persisted pageshow restored stale state or the wrong declared chamber.", {
          eventRecorded: hasEvent,
          activeDistrict: state.root?.["data-active-district"],
          kai: state.root?.["data-cxos-kai"],
          openInspectionIds: state.inspection.openIds,
        });
      }
    }
    if (
      state.step === "idle:quiescence" &&
      (state.idleRafDelta !== 0 ||
        budget.runningChannelCount !== 0 ||
        budget.runningTransientTokens.length !== 0 ||
        budget.runningScrollTokens.length !== 0)
    ) {
      add("idle-work", state.step, "The settled idle window retained app rAF work or running environment channels.", {
        rafCallbacks: state.idleRafDelta,
        runningChannels: budget.runningChannels,
        runningTransientTokens: budget.runningTransientTokens,
        runningScrollTokens: budget.runningScrollTokens,
      });
    }
    if (state.step.startsWith("history:")) {
      const restoredHash = new URL(state.href).hash.replace(/^#/, "");
      if (
        state.restoredHistory?.converged !== true ||
        (restoredHash &&
          DISTRICTS.includes(restoredHash) &&
          state.root?.["data-active-district"] !== restoredHash)
      ) {
        add("history-restore", state.step, "The active chamber does not match the browser history hash.", {
          hash: restoredHash,
          activeDistrict: state.root?.["data-active-district"],
        });
      }
    }
    if (
      state.step === "departure:destination" &&
      new URL(state.href).pathname !== "/review/mission-control"
    ) {
      add("departure-destination", state.step, "The bounded departure did not reach Mission Control.");
    }
    if (
      state.step === "departure:return" &&
      (new URL(state.href).pathname !== route || state.focusRestored !== true)
    ) {
      add("departure-return", state.step, "Back navigation did not restore the Agency route with meaningful focus.", {
        path: new URL(state.href).pathname,
        focusRestored: state.focusRestored,
      });
    }
    if (
      state.step === "departure:return" &&
      state.trustedBfcache?.proven !== true
    ) {
      add(
        "trusted-bfcache",
        state.step,
        "The history.back traversal did not prove BFCache restoration with a reused document ID and a trusted persisted pageshow event.",
        state.trustedBfcache ?? { evidence: "unavailable" },
      );
    }
  }

  if (result.spec.id === "desktop-large") {
    for (const districtId of SCROLL_LINKED_DISTRICTS) {
      const step = `choreography:scroll-linked:${districtId}`;
      const choreography = result.states.find(
        (state) => state.step === step,
      )?.scrollLinkedChoreography;
      if (choreography?.passed !== true) {
        add(
          "scroll-linked-choreography",
          step,
          `The ${districtId} travel chamber did not prove a visible-subject, document-scroller ViewTimeline with nonzero timing and rendered endpoint response.`,
          choreography ?? { evidence: "unavailable" },
        );
      }
    }
  }

  const measuredCycles = result.states.filter(
    (state) => state.step.startsWith("chamber:cycle-") && state.measured === true,
  ).length;
  if (result.spec.measuredCycles && measuredCycles < result.spec.measuredCycles) {
    add("measured-cycles", "case", "Fewer than three measured chamber cycles completed.", {
      expected: result.spec.measuredCycles,
      measured: measuredCycles,
    });
  }
  for (const failure of result.requestFailures) {
    if (/ERR_ABORTED/i.test(failure.errorText)) continue;
    if (failure.ownership === "inherited-framework") continue;
    add("request-failure", failure.phase, "A browser request failed.", failure);
  }
  for (const response of result.httpFailures) {
    if (response.ownership === "inherited-framework") continue;
    add("http-failure", response.phase, "A browser response returned HTTP 4xx/5xx.", response);
  }
  for (const error of result.pageErrors) {
    add("page-error", error.phase, "The page raised an uncaught runtime error.", error);
  }
  for (const message of result.console.filter((entry) => entry.type === "error")) {
    if (message.ownership === "inherited-framework") continue;
    add("console-error", message.phase, "The browser console recorded an error.", message);
  }
  for (const violation of result.axe.violations.filter(
    (item) => item.impact === "critical" || item.impact === "serious",
  )) {
    add("axe-blocking", "accessibility:audit", "Axe reported a serious or critical violation.", violation);
  }
  if (result.axe.manualReview?.auditError) {
    add(
      "axe-audit-unavailable",
      "accessibility:audit",
      "The Axe audit could not run in missing-feature capture mode.",
      result.axe.manualReview.auditError,
    );
  }
  if (result.spec.id === "desktop-large" || result.spec.id === "mobile") {
    for (const districtId of DISTRICTS) {
      const districtAxe = result.perDistrictAxe?.[districtId];
      const step = `district:${districtId}`;
      if (!districtAxe) {
        add(
          "axe-district-missing",
          step,
          "The per-chamber Axe audit did not record a result for this chamber.",
          { district: districtId },
        );
        continue;
      }
      for (const violation of districtAxe.violations.filter(
        (item) => item.impact === "critical" || item.impact === "serious",
      )) {
        add(
          "axe-blocking-district",
          step,
          `Axe reported a serious or critical violation for the ${districtId} chamber.`,
          { district: districtId, ...violation },
        );
      }
    }
  }

  const appLongWork = result.states.flatMap((state) => [
    ...state.evidence.longTask,
    ...state.evidence.longAnimationFrame,
  ]).filter((entry) =>
    entry.duration > 50 &&
    (entry.ownership === "candidate-owned" || entry.ownership === "mixed"),
  );
  if (appLongWork.length > 1) {
    add("repeated-long-work", "case", "Repeated candidate-attributable work exceeded 50ms.", {
      count: appLongWork.length,
      entries: appLongWork.map((entry) => ({
        duration: entry.duration,
        ownership: entry.ownership,
        recordedPhase: entry.recordedPhase,
      })),
    });
  }

  return {
    passed: captureMissingFeatures ? null : findings.length === 0,
    findingCount: findings.length,
    findings,
    observationCount: observations.length,
    observations,
  };
}

async function runCase(spec) {
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: spec.deviceScaleFactor ?? 1,
    isMobile: spec.mobile === true,
    hasTouch: spec.mobile === true,
    reducedMotion: spec.reduced ? "reduce" : "no-preference",
    serviceWorkers: "block",
  });
  await context.addInitScript(probeInit, {
    candidateRoute: route,
    constrained: spec.constrained === true,
    coarse: spec.coarse === true,
  });
  const page = await context.newPage();
  if (captureMissingFeatures) {
    const strictWaitForFunction = page.waitForFunction.bind(page);
    page.waitForFunction = async (pageFunction, arg, options = {}) => {
      try {
        return await strictWaitForFunction(pageFunction, arg, {
          ...options,
          timeout: Math.min(options.timeout ?? 2500, 2500),
        });
      } catch {
        return null;
      }
    };
  }
  const consoleEvents = [];
  const pageErrors = [];
  const requests = [];
  const responses = [];
  const requestFailures = [];
  let nodePhase = "navigation";
  const bfcacheNotUsedEvents = [];
  const bfcacheNotUsedWaiters = new Set();
  const cdpBfcache = {
    available: false,
    protocolEvent: "Page.backForwardCacheNotUsed",
    setupError: null,
  };
  try {
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send("Page.enable");
    cdpBfcache.available = true;
    cdpSession.on("Page.backForwardCacheNotUsed", (event) => {
      bfcacheNotUsedEvents.push(
        summarizeBfcacheNotUsedEvent(event, nodePhase),
      );
      for (const resolveWaiter of bfcacheNotUsedWaiters) resolveWaiter();
      bfcacheNotUsedWaiters.clear();
    });
  } catch (error) {
    cdpBfcache.setupError = safeErrorSummary(error);
  }
  const beginCasePhase = async (phase) => {
    nodePhase = phase;
    return beginPhase(page, phase);
  };
  page.on("console", (message) => {
    const attribution = classifyConsoleOwnership(message);
    consoleEvents.push({
      phase: nodePhase,
      type: message.type(),
      text: message.text().slice(0, 2000),
      location: safeUrl(message.location().url),
      ...attribution,
    });
  });
  page.on("pageerror", (error) => pageErrors.push({ phase: nodePhase, error: String(error) }));
  page.on("request", (request) => {
    const attribution = classifyUrlOwnership(request.url());
    requests.push({
      phase: nodePhase,
      method: request.method(),
      url: safeUrl(request.url()),
      resourceType: request.resourceType(),
      ...attribution,
    });
  });
  page.on("response", (response) => {
    const request = response.request();
    const attribution = classifyUrlOwnership(response.url());
    responses.push({
      phase: nodePhase,
      method: request.method(),
      url: safeUrl(response.url()),
      resourceType: request.resourceType(),
      status: response.status(),
      ok: response.ok(),
      ...attribution,
    });
  });
  page.on("requestfailed", (request) => {
    const attribution = classifyUrlOwnership(request.url());
    requestFailures.push({
      phase: nodePhase,
      method: request.method(),
      url: safeUrl(request.url()),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText ?? "unavailable",
      ...attribution,
    });
  });

  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main[data-cxos-runtime]");
  const states = [];
  const screenshots = [];
  const capture = async (step, cursor, metadata = {}, options = {}) => {
    const state = {
      step,
      ...metadata,
      ...(await snapshot(page, cursor, options)),
    };
    states.push(state);
    return state;
  };
  await capture(
    "navigation",
    { phase: "navigation", documentId: null, startedAt: 0 },
  );

  const arrivalPhase = `arrival:${spec.arrival ?? "skip"}`;
  const settledCursor = await beginCasePhase(arrivalPhase);
  const arrivalResult = await settleArrival(
    page,
    spec.arrival ?? "skip",
    spec.activation ?? "keyboard",
  );
  await waitForSettledShot(page);
  const settledScreenshot = `${label}-${spec.id}-settled.png`;
  await page.screenshot({
    path: join(evidenceDir, settledScreenshot),
    fullPage: true,
    animations: "disabled",
  });
  screenshots.push({
    kind: "arrival-settled",
    file: settledScreenshot,
    animations: "disabled",
  });
  const arrivalState = await capture(
    `arrival:${arrivalResult}`,
    settledCursor,
    { activation: spec.activation ?? "keyboard" },
    { includeTargetSizes: true },
  );
  await sampleOffViewportObstruction(page, arrivalState);

  // RC2 WP7 NEW-B: the <=860px mobile facility map is the primary
  // small-screen navigation and was never opened in any measured state.
  // spec.width <= 860 matches exactly the cases the CSS's second
  // `@media (max-width: 860px)` block switches .mobileFacilityMap to
  // display:block (mobile, mobile-360, mobile-narrow, landscape, and
  // reflow-200's 720px CSS viewport) — data-driven off the declared
  // viewport width rather than a hardcoded case-id list.
  if (spec.width <= 860) {
    const mobileFacilityMapSummary = page.locator(
      "nav[aria-label='Agency Command facility map'] > details > summary",
    );
    const directoryOpenCursor = await beginCasePhase("directory:open");
    await activate(mobileFacilityMapSummary, spec.activation);
    await page.waitForFunction(() =>
      document
        .querySelector("nav[aria-label='Agency Command facility map'] > details")
        ?.hasAttribute("open"),
    );
    await waitForUiCommit(page);
    const directoryScreenshot = `${label}-${spec.id}-directory-open-settled.png`;
    await page.screenshot({
      path: join(evidenceDir, directoryScreenshot),
      fullPage: true,
      animations: "disabled",
    });
    screenshots.push({
      kind: "directory-open-settled",
      file: directoryScreenshot,
      animations: "disabled",
    });
    // On landscape (390px CSS height) the open list is deliberately taller
    // than the viewport; whatever target-size/obstruction/overflow the
    // probe below finds there is measured DATA about that real geometry,
    // not a harness failure — the case still only fails via the normal
    // acceptance gates (e.g. genuine <44px targets or a true obstruction).
    const directoryState = await capture(
      "directory:open",
      directoryOpenCursor,
      { activation: spec.activation },
      { includeTargetSizes: true },
    );
    await sampleOffViewportObstruction(page, directoryState);

    const directoryCloseCursor = await beginCasePhase("directory:close");
    await activate(mobileFacilityMapSummary, spec.activation);
    await page.waitForFunction(() =>
      !document
        .querySelector("nav[aria-label='Agency Command facility map'] > details")
        ?.hasAttribute("open"),
    );
    await capture("directory:close", directoryCloseCursor, {
      activation: spec.activation,
    });
  }

  if (spec.replay) {
    const replayCursor = await beginCasePhase("arrival:replay:start");
    const director = page.locator("details").filter({
      has: page.getByText("DIRECTOR", { exact: true }),
    }).first();
    if (!(await director.evaluate((element) => element.open))) {
      await activate(director.locator("summary").first(), spec.activation);
    }
    await activate(
      page.getByRole("button", { name: "Replay grand arrival" }),
      spec.activation,
    );
    await page.waitForFunction(() =>
      document.querySelector("main[data-arrival-settled='false']"),
    );
    await capture("arrival:replay:active", replayCursor, {
      activation: spec.activation,
    });
    const replaySettleCursor = await beginCasePhase("arrival:replay:escape");
    await settleArrival(page, "escape", "keyboard");
    await capture("arrival:replay:settled", replaySettleCursor, {
      activation: "keyboard",
    });
  }

  const shouldExerciseAll = spec.mode === "full";
  const destinations = shouldExerciseAll ? DISTRICTS : ["client-operations", "kai-suite", "growth-threshold"];
  // RC2 WP7: populated only for desktop-large and mobile (the two mode:full
  // cases whose per-district loop below settles every one of the seven
  // chambers), one independent Axe audit keyed by district id. Any audit
  // error propagates uncaught (no try/catch here) so a per-chamber Axe
  // failure FAILS the run instead of silently skipping a chamber.
  const perDistrictAxe = {};
  // RC2 WP7 landscape breadth: median/max blocking duration across the
  // measured chamber cycles, additive alongside each cycle's own existing
  // single-value performance.phase figures. Populated only when
  // spec.measuredCycles reuses the warmup+cycles traversal below.
  let cycleBlocking = null;
  if (spec.measuredCycles) {
    const warmupCursor = await beginCasePhase("chamber:warmup");
    for (const district of DISTRICTS) {
      await navigateToDistrict(page, district, {
        activation: spec.activation,
        method: "direct",
      });
    }
    await capture("chamber:warmup", warmupCursor, {
      activation: spec.activation,
      method: "direct",
      districtSequence: [...DISTRICTS],
      measured: false,
    });

    for (let cycle = 1; cycle <= spec.measuredCycles; cycle += 1) {
      const reverse = cycle === 2;
      const direct = cycle === 3;
      const order = reverse ? [...DISTRICTS].reverse() : [...DISTRICTS];
      const method = direct ? "direct" : reverse ? "previous" : "next";
      const cursor = await beginCasePhase(`chamber:cycle-${cycle}:${method}`);
      await navigateToDistrict(page, order[0], {
        activation: spec.activation,
        method: "direct",
      });
      for (const district of order.slice(1)) {
        await navigateToDistrict(page, district, {
          activation: spec.activation,
          method,
        });
      }
      await capture(`chamber:cycle-${cycle}`, cursor, {
        activation: spec.activation,
        method,
        districtSequence: order,
        measured: true,
      });
    }

    const measuredCycleStates = states.filter(
      (state) => /^chamber:cycle-\d+$/.test(state.step) && state.measured === true,
    );
    cycleBlocking = {
      longAnimationFrameBlockingDurationMs: summarizeBlockingDurations(
        measuredCycleStates.map(
          (state) => state.performance.phase.longAnimationFrameBlockingDurationMs,
        ),
      ),
      longTaskDurationMs: summarizeBlockingDurations(
        measuredCycleStates.map((state) => state.performance.phase.longTaskDurationMs),
      ),
    };
  } else {
    for (const district of destinations) {
      const step = `district:${district}`;
      const cursor = await beginCasePhase(step);
      await navigateToDistrict(page, district, {
        activation: spec.activation,
        method: "direct",
      });
      if (spec.id === "desktop-large") {
        await waitForSettledShot(page);
        const chamberScreenshot = `${label}-${spec.id}-chamber-${district}-settled.png`;
        await page.screenshot({
          path: join(evidenceDir, chamberScreenshot),
          fullPage: true,
          animations: "disabled",
        });
        screenshots.push({
          kind: "chamber-settled",
          district,
          file: chamberScreenshot,
          animations: "disabled",
        });
      }
      if (spec.id === "desktop-large" || spec.id === "mobile") {
        await ensureAxeLoaded(page);
        const districtAxe = await runAxeAudit(page);
        perDistrictAxe[district] = {
          violations: districtAxe.violations.map(summarizeAxeRule),
          incomplete: districtAxe.incomplete.map(summarizeAxeRule),
          passes: districtAxe.passes.map((rule) => safeEvidenceText(rule?.id, 200)),
        };
      }
      await capture(step, cursor, {
        activation: spec.activation,
        method: "direct",
      });
    }
  }

  if (spec.id === "desktop-large") {
    for (const districtId of SCROLL_LINKED_DISTRICTS) {
      const step = `choreography:scroll-linked:${districtId}`;
      const cursor = await beginCasePhase(step);
      await navigateToDistrict(page, districtId, {
        activation: spec.activation,
        method: "direct",
      });
      const scrollLinkedChoreography = await measureScrollLinkedChoreography(page, districtId);
      await capture(step, cursor, {
        activation: spec.activation,
        method: "native-scroll",
        district: districtId,
        scrollLinkedChoreography,
      });
    }
  }

  await navigateToDistrict(page, "kai-suite", {
    activation: spec.activation,
    method: "direct",
  });
  const inspectionSummary = page.locator(
    "section:not([hidden]) details[data-agency-inspection] > summary",
  ).first();
  if (await inspectionSummary.isVisible().catch(() => false)) {
    const openCursor = await beginCasePhase("inspection:open");
    await activate(inspectionSummary, spec.activation);
    await page.waitForFunction(() =>
      document.querySelector("section:not([hidden]) details[data-agency-inspection][open]") &&
      document.querySelector("main")?.getAttribute("data-cxos-attention") === "inspecting",
    );
    await capture("inspection:open", openCursor, {
      activation: spec.activation,
    });

    const toggleCloseCursor = await beginCasePhase("inspection:toggle-close");
    await activate(inspectionSummary, spec.activation);
    await page.waitForFunction(() =>
      !document.querySelector("section:not([hidden]) details[data-agency-inspection][open]") &&
      document.querySelector("main")?.getAttribute("data-cxos-attention") !== "inspecting",
    );
    await capture("inspection:toggle-close", toggleCloseCursor, {
      activation: spec.activation,
      closeVerified: true,
    });

    const reopenCursor = await beginCasePhase("inspection:reopen");
    await activate(inspectionSummary, spec.activation);
    await page.waitForFunction(() =>
      document.querySelector("section:not([hidden]) details[data-agency-inspection][open]"),
    );
    await capture("inspection:reopen", reopenCursor, {
      activation: spec.activation,
    });

    const escapeCloseCursor = await beginCasePhase("inspection:escape-close");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() =>
      !document.querySelector("section:not([hidden]) details[data-agency-inspection][open]") &&
      document.querySelector("main")?.getAttribute("data-cxos-attention") !== "inspecting",
    );
    await waitForUiCommit(page);
    const focusRestored = await inspectionSummary.evaluate(
      (element) => document.activeElement === element,
    );
    await capture("inspection:escape-close", escapeCloseCursor, {
      activation: "keyboard",
      closeVerified: true,
      focusRestored,
    });
  }

  if (shouldExerciseAll) {
    await navigateToDistrict(page, "kai-suite", {
      activation: spec.activation,
      method: "direct",
    });
    const kaiInput = page.locator("#kai-synthetic-command");
    const kaiStageCursor = await beginCasePhase("kai:stage");
    await setControlledInput(kaiInput, "Prepare my morning priorities");
    await page.waitForFunction(() =>
      document.querySelector("#kai-synthetic-command")?.value.length > 0 &&
      document.querySelector("main")?.getAttribute("data-cxos-kai") === "staged",
    );
    await capture("kai:stage", kaiStageCursor, {
      commandFixture: "fixed-supported-example",
      inputRecorded: false,
    });

    const kaiResolveCursor = await beginCasePhase("kai:resolve");
    await activate(
      page.getByRole("button", { name: "Prepare synthetic preview" }),
      spec.activation,
    );
    await page.waitForFunction(() =>
      document.querySelector("main")?.getAttribute("data-cxos-kai") === "resolved" &&
      document.querySelectorAll(
        "div[aria-label='Route-local Kai preview continuity'] > ol > li",
      ).length === 1,
    );
    await capture("kai:resolve", kaiResolveCursor, {
      activation: spec.activation,
    });

    const kaiClearCursor = await beginCasePhase("kai:clear");
    await activate(
      page.getByRole("button", { name: "Clear route-local Kai session" }),
      spec.activation,
    );
    await page.waitForFunction(() =>
      document.querySelector("main")?.getAttribute("data-cxos-kai") === "quiet" &&
      document.querySelectorAll(
        "div[aria-label='Route-local Kai preview continuity'] > ol > li",
      ).length === 0,
    );
    await capture("kai:clear", kaiClearCursor, {
      activation: spec.activation,
    });

    const hiddenCursor = await beginCasePhase("visibility:hidden");
    const hiddenSimulation = await setSyntheticVisibility(page, true);
    await page.waitForFunction(() =>
      document.querySelector("main")?.getAttribute("data-hidden") === "true",
    );
    await capture("visibility:hidden", hiddenCursor, {
      simulation: hiddenSimulation,
    });

    const visibleCursor = await beginCasePhase("visibility:visible");
    const visibleSimulation = await setSyntheticVisibility(page, false);
    await page.waitForFunction(() =>
      document.querySelector("main")?.getAttribute("data-hidden") === "false",
    );
    await capture("visibility:visible", visibleCursor, {
      simulation: visibleSimulation,
    });

    if (spec.resize) {
      const resizeCursor = await beginCasePhase("resize:tier-b");
      await page.setViewportSize({ width: 760, height: 800 });
      await page.waitForFunction(() =>
        innerWidth === 760 &&
        document.querySelector("main")?.getAttribute("data-cxos-tier") === "B",
      );
      const resizeTierBState = await capture(
        "resize:tier-b",
        resizeCursor,
        { from: { width: spec.width, height: spec.height } },
        { includeTargetSizes: true },
      );
      await sampleOffViewportObstruction(page, resizeTierBState);

      const resizeRestoreCursor = await beginCasePhase("resize:restore");
      await page.setViewportSize({ width: spec.width, height: spec.height });
      await page.waitForFunction(
        ({ width, height }) => innerWidth === width && innerHeight === height,
        { width: spec.width, height: spec.height },
      );
      const resizeRestoreState = await capture(
        "resize:restore",
        resizeRestoreCursor,
        { restored: { width: spec.width, height: spec.height } },
        { includeTargetSizes: true },
      );
      await sampleOffViewportObstruction(page, resizeRestoreState);
    }

    if (spec.lifecycle) {
      await navigateToDistrict(page, "kai-suite", {
        activation: spec.activation,
        method: "direct",
      });
      await setControlledInput(kaiInput, "Prepare my morning priorities");
      await activate(
        page.getByRole("button", { name: "Prepare synthetic preview" }),
        spec.activation,
      );
      await page.waitForFunction(() =>
        document.querySelector("main")?.getAttribute("data-cxos-kai") === "resolved",
      );
      const lifecycleInspection = page.locator(
        "#kai-suite-inspection > summary",
      );
      await activate(lifecycleInspection, spec.activation);
      await page.waitForFunction(() =>
        document.querySelector("#kai-suite-inspection")?.hasAttribute("open"),
      );

      const pageHideCursor = await beginCasePhase("lifecycle:pagehide-persisted");
      await dispatchSyntheticPageTransition(page, "pagehide", true);
      await capture("lifecycle:pagehide-persisted", pageHideCursor, {
        synthetic: true,
        expectedReset: {
          activeDistrict: "central-command",
          idle: "settled",
          kai: "quiet",
          openInspectionCount: 0,
        },
      });

      const pageShowCursor = await beginCasePhase("lifecycle:pageshow-persisted");
      await dispatchSyntheticPageTransition(page, "pageshow", true);
      const restoredHistory = await waitForHistoryDistrict(page);
      await capture("lifecycle:pageshow-persisted", pageShowCursor, {
        synthetic: true,
        restoredHistory,
        expectedReset: {
          restoredFromHash: "kai-suite",
          kai: "quiet",
          openInspectionCount: 0,
        },
      });
    }

    const openInspection = page.locator(
      "section:not([hidden]) details[data-agency-inspection][open] > summary",
    ).first();
    if (await openInspection.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForFunction(() =>
        !document.querySelector("section:not([hidden]) details[data-agency-inspection][open]"),
      );
    }
    await page.locator("main[data-cxos-runtime]").focus();
    await page.waitForFunction(() =>
      document.querySelector("main")?.getAttribute("data-cxos-attention") === "ambient",
    );
    const tier = await page.locator("main").getAttribute("data-cxos-tier");
    if (tier === "A" || tier === "B") {
      await page.waitForFunction(() =>
        document.querySelector("main")?.getAttribute("data-cxos-idle") === "engaged",
      );
      const thresholdCursor = await beginCasePhase("idle:settling");
      await page.waitForFunction(
        () =>
          document.querySelector("main")?.getAttribute("data-cxos-idle") ===
          "settling",
        null,
        { timeout: 9000 },
      );
      await capture("idle:settling", thresholdCursor);

      const settledIdleCursor = await beginCasePhase("idle:settled");
      await page.waitForFunction(() =>
        document.querySelector("main")?.getAttribute("data-cxos-idle") === "settled",
      );
      await capture("idle:settled", settledIdleCursor);
    } else {
      const staticIdleCursor = await beginCasePhase("idle:static");
      await capture("idle:static", staticIdleCursor);
    }

    const idleCursor = await beginCasePhase("idle:quiescence");
    await page.waitForTimeout(1200);
    const afterIdle = await capture("idle:quiescence", idleCursor);
    afterIdle.idleRafDelta = afterIdle.performance.phase.rafCallbacks;

    const backCursor = await beginCasePhase("history:back");
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
    const backHistory = await waitForHistoryDistrict(page);
    await capture("history:back", backCursor, { restoredHistory: backHistory });

    const forwardCursor = await beginCasePhase("history:forward");
    await page.goForward({ waitUntil: "domcontentloaded" }).catch(() => null);
    const forwardHistory = await waitForHistoryDistrict(page);
    await capture("history:forward", forwardCursor, {
      restoredHistory: forwardHistory,
    });

    if (spec.departure) {
      await navigateToDistrict(page, "growth-threshold", {
        activation: spec.activation,
        method: "direct",
      });
      const bfcacheBefore = await page.evaluate(() => {
        const ledger = window.__cxosEvidence;
        return {
          documentId: ledger?.documentId ?? null,
          pageShowCount: ledger?.pageShow?.length ?? 0,
          pageHideCount: ledger?.pageHide?.length ?? 0,
          path: `${location.pathname}${location.hash}`,
        };
      });
      const bfcacheNotUsedCursor = bfcacheNotUsedEvents.length;
      let resolveBfcacheNotUsed;
      const bfcacheNotUsedSignal = new Promise((resolveSignal) => {
        resolveBfcacheNotUsed = resolveSignal;
        bfcacheNotUsedWaiters.add(resolveSignal);
      });
      const returnLink = page.getByRole("link", { name: /Return to Mission Control/ }).last();
      const departureUrl = `${new URL(baseUrl).origin}/review/mission-control`;
      const destinationPromise = page.waitForURL((url) =>
        url.origin === new URL(baseUrl).origin && url.pathname === "/review/mission-control",
      );
      const departureCursor = await beginCasePhase("departure:start");
      await returnLink.evaluate((element) => element.click());
      await page.waitForFunction(() =>
        document.querySelector("main")?.getAttribute("data-departing") === "true",
      );
      await capture("departure:start", departureCursor, {
        destination: departureUrl,
      });
      nodePhase = "departure:destination";
      await destinationPromise;
      await page.waitForSelector("main");
      const destinationCursor = await beginCasePhase("departure:destination");
      await capture("departure:destination", destinationCursor, {
        expectedPath: "/review/mission-control",
      });

      nodePhase = "departure:return";
      const historyBackInvocation = await page.evaluate(() => {
        history.back();
        return "history.back()";
      });
      await page.waitForFunction(
        (expectedPath) => location.pathname === expectedPath,
        route,
      );
      await page.waitForSelector("main[data-cxos-runtime]");
      if (
        (await page.locator("main").getAttribute("data-arrival-settled")) !== "true"
      ) {
        await settleArrival(page, "skip", spec.activation);
      }
      await waitForUiCommit(page);
      const trustedBfcache = await page.evaluate((before) => {
        const ledger = window.__cxosEvidence;
        const documentReused = Boolean(
          before.documentId && ledger?.documentId === before.documentId,
        );
        const pageShowEvents = (
          documentReused
            ? ledger?.pageShow?.slice(before.pageShowCount)
            : ledger?.pageShow
        ) ?? [];
        const pageHideEvents = (
          documentReused
            ? ledger?.pageHide?.slice(before.pageHideCount)
            : ledger?.pageHide
        ) ?? [];
        const summarize = (event) => ({
          persisted: event.persisted === true,
          trusted: event.trusted === true,
          recordedPhase: event.recordedPhase ?? null,
          at: event.at ?? null,
        });
        const trustedPersistedPageShow = pageShowEvents.some(
          (event) => event.persisted === true && event.trusted === true,
        );
        return {
          beforeDocumentId: before.documentId,
          afterDocumentId: ledger?.documentId ?? null,
          documentReused,
          trustedPersistedPageShow,
          pageShowEvents: pageShowEvents.map(summarize),
          pageHideEvents: pageHideEvents.map(summarize),
          beforePath: before.path,
          afterPath: `${location.pathname}${location.hash}`,
          proven: documentReused && trustedPersistedPageShow,
        };
      }, bfcacheBefore);
      if (
        trustedBfcache.proven !== true &&
        cdpBfcache.available &&
        bfcacheNotUsedEvents.length === bfcacheNotUsedCursor
      ) {
        await Promise.race([
          bfcacheNotUsedSignal,
          new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1000)),
        ]);
      }
      bfcacheNotUsedWaiters.delete(resolveBfcacheNotUsed);
      trustedBfcache.historyTraversal = historyBackInvocation;
      trustedBfcache.cdp = {
        ...cdpBfcache,
        notUsedEvents: bfcacheNotUsedEvents.slice(bfcacheNotUsedCursor),
      };
      const returnCursor = await beginCasePhase("departure:return");
      const focusRestored = await page.evaluate(() => {
        const active = document.activeElement;
        const root = document.querySelector("main[data-cxos-runtime]");
        return active instanceof HTMLElement &&
          root?.contains(active) === true &&
          active.getClientRects().length > 0 &&
          active !== document.body &&
          active !== document.documentElement &&
          active !== root;
      });
      const departureReturnState = await capture(
        "departure:return",
        returnCursor,
        { focusRestored, trustedBfcache },
        { includeTargetSizes: true },
      );
      await sampleOffViewportObstruction(page, departureReturnState);
    }
  }

  // RC2 WP7 post-processing only: joins each recorded Long Task to a
  // containing Long Animation Frame in the same case/step window, additive
  // (attributionResolved), never touching the raw captured longTask/
  // longAnimationFrame entries.
  for (const state of states) {
    resolveLongTaskAttribution(state);
  }

  const persistenceEvents = states.flatMap((state) => [
    ...state.evidence.storage,
    ...state.evidence.cookie,
    ...state.evidence.indexedDb,
    ...state.evidence.cache,
    ...state.evidence.serviceWorker,
  ].map((event) => ({ measurementPhase: state.step, ...event })));
  const persistence = {
    events: persistenceEvents,
    byMechanism: summarizeBy(persistenceEvents, "mechanism"),
    byOwnership: summarizeBy(persistenceEvents, "ownership"),
  };
  await beginCasePhase("accessibility:audit");
  let axeAuditError = null;
  let axe = { violations: [], passes: [], incomplete: [] };
  try {
    await ensureAxeLoaded(page);
    axe = await runAxeAudit(page);
  } catch (error) {
    if (!captureMissingFeatures) throw error;
    axeAuditError = safeErrorSummary(error);
  }
  const axeViolations = axe.violations.map(summarizeAxeRule);
  const axeIncomplete = axe.incomplete.map(summarizeAxeRule);
  const axeIncompleteNodeCount = axeIncomplete.reduce(
    (sum, rule) => sum + rule.nodeCount,
    0,
  );
  const cookies = await context.cookies();
  const httpFailures = responses.filter((response) => response.status >= 400);
  await context.close();
  const result = {
    spec,
    screenshots,
    states,
    requests,
    responses,
    requestFailures,
    httpFailures,
    requestSummary: {
      byPhase: summarizeBy(requests, "phase"),
      byOwnership: summarizeBy(requests, "ownership"),
      responsesByStatus: summarizeBy(responses, "status"),
      failuresByOwnership: summarizeBy(requestFailures, "ownership"),
    },
    perDistrictAxe,
    cycleBlocking,
    persistence,
    cookies: cookies.map(({ name, domain, path, sameSite, secure, httpOnly }) => {
      const isNextAuth = /^(?:(?:__Secure-|__Host-)?next-auth\.|nextauth\.)/i.test(name);
      return {
        mechanism: "browser-cookie-jar",
        key: name,
        name,
        domain,
        path,
        sameSite,
        secure,
        httpOnly,
        ownership: isNextAuth ? "inherited-framework" : "first-party-unattributed",
        ownershipEvidence: isNextAuth
          ? "NextAuth cookie-name prefix"
          : "cookie key has no candidate- or framework-specific marker",
      };
    }),
    console: consoleEvents,
    pageErrors,
    axe: {
      violations: axeViolations,
      passes: axe.passes.map((rule) => safeEvidenceText(rule?.id, 200)),
      incomplete: axeIncomplete,
      manualReview: {
        required: axeIncomplete.length > 0 || axeAuditError !== null,
        status: axeAuditError
          ? "required-audit-unavailable"
          : axeIncomplete.length > 0
            ? "required-incomplete-rules"
            : "not-required",
        ruleCount: axeIncomplete.length,
        nodeCount: axeIncompleteNodeCount,
        disposition: "Axe incomplete results require manual review and are not automatically violations.",
        auditError: axeAuditError,
      },
    },
  };
  result.acceptance = evaluateCaseAcceptance(result);
  return result;
}

function missingFeatureCaseResult(spec, error) {
  const captureError = safeErrorSummary(error);
  return {
    spec,
    screenshots: [],
    states: [],
    requests: [],
    responses: [],
    requestFailures: [],
    httpFailures: [],
    requestSummary: {
      byPhase: {},
      byOwnership: {},
      responsesByStatus: {},
      failuresByOwnership: {},
    },
    perDistrictAxe: {},
    cycleBlocking: null,
    persistence: { events: [], byMechanism: {}, byOwnership: {} },
    cookies: [],
    console: [],
    pageErrors: [],
    axe: {
      violations: [],
      passes: [],
      incomplete: [],
      manualReview: {
        required: true,
        status: "required-audit-unavailable",
        ruleCount: 0,
        nodeCount: 0,
        disposition: "Axe incomplete results require manual review and are not automatically violations.",
        auditError: captureError,
      },
    },
    captureError,
    acceptance: {
      passed: null,
      findingCount: 0,
      findings: [],
      observationCount: 1,
      observations: [{
        severity: "P1",
        code: "missing-feature-case-capture",
        phase: "case",
        message: "The baseline case could not complete because required candidate behavior is absent or unavailable.",
        evidence: captureError,
      }],
    },
  };
}

function evaluateReportAcceptance(results, javaScriptDisabled) {
  const findings = results.flatMap((result) =>
    result.acceptance.findings.map((finding) => ({
      caseId: result.spec.id,
      ...finding,
    })),
  );
  const observations = results.flatMap((result) =>
    (result.acceptance.observations ?? []).map((observation) => ({
      caseId: result.spec.id,
      ...observation,
    })),
  );
  const coverage = [];
  const allStates = results.flatMap((result) =>
    result.states.map((state) => ({ caseId: result.spec.id, ...state })),
  );
  const addCoverage = (code, passed, message, evidence = {}) => {
    coverage.push({ code, passed, message, evidence });
    if (!passed) {
      const item = {
        caseId: "matrix",
        severity: "P1",
        code,
        phase: "coverage",
        message,
        evidence,
      };
      if (captureMissingFeatures) observations.push(item);
      else findings.push(item);
    }
  };
  const hasStep = (pattern) => allStates.some((state) => pattern.test(state.step));
  const activations = new Set(
    allStates.map((state) => state.activation).filter(Boolean),
  );
  const viewportKeys = new Set(
    results.map((result) => `${result.spec.width}x${result.spec.height}`),
  );
  const requiredViewports = [
    "1728x1000",
    "1440x900",
    "1024x768",
    "390x844",
    "360x800",
    "320x800",
    "740x390",
  ];
  const reflowResult = results.find((result) => result.spec.id === "reflow-200");
  const reflowSnapshot = reflowResult?.states.find(
    (state) => state.viewport?.width === 720 && state.viewport?.height === 450,
  );
  const desktopLarge = results.find((result) => result.spec.id === "desktop-large");
  const chamberScreenshots = desktopLarge?.screenshots.filter(
    (screenshot) => screenshot.kind === "chamber-settled",
  ) ?? [];
  const trustedBfcacheStates = allStates.filter(
    (state) => state.step === "departure:return",
  );

  addCoverage(
    "coverage:viewports",
    requiredViewports.every((viewport) => viewportKeys.has(viewport)),
    "The required viewport matrix is present.",
    { requiredViewports, measuredViewports: [...viewportKeys] },
  );
  addCoverage(
    "coverage:reflow-200",
    reflowResult?.spec.width === 720 &&
      reflowResult.spec.height === 450 &&
      reflowResult.spec.deviceScaleFactor === 2 &&
      reflowResult.spec.physicalViewport?.width === 1440 &&
      reflowResult.spec.physicalViewport?.height === 900 &&
      reflowSnapshot?.devicePixelRatio === 2 &&
      reflowSnapshot?.physicalViewport?.width === 1440 &&
      reflowSnapshot?.physicalViewport?.height === 900,
    "The 200% reflow case uses a 720x450 CSS viewport at deviceScaleFactor 2 and records its 1440x900 physical surface.",
    {
      spec: reflowResult?.spec ?? null,
      measuredViewport: reflowSnapshot?.viewport ?? null,
      measuredDevicePixelRatio: reflowSnapshot?.devicePixelRatio ?? null,
      measuredPhysicalViewport: reflowSnapshot?.physicalViewport ?? null,
    },
  );
  addCoverage(
    "coverage:arrival",
    hasStep(/^arrival:natural$/) &&
      hasStep(/^arrival:escape$/) &&
      hasStep(/^arrival:replay:active$/) &&
      hasStep(/^arrival:replay:settled$/),
    "Natural, Escape, and replay arrival paths are measured.",
  );
  addCoverage(
    "coverage:activation",
    activations.has("keyboard") && activations.has("touch"),
    "Both keyboard and touch activation paths are measured.",
    { activations: [...activations] },
  );
  addCoverage(
    "coverage:inspection",
    hasStep(/^inspection:toggle-close$/) &&
      hasStep(/^inspection:escape-close$/),
    "Inspection toggle-close, Escape-close, and focus restoration are measured.",
  );
  addCoverage(
    "coverage:kai",
    hasStep(/^kai:stage$/) && hasStep(/^kai:resolve$/) && hasStep(/^kai:clear$/),
    "Kai staged, resolved, and cleared states are measured.",
  );
  addCoverage(
    "coverage:lifecycle",
    hasStep(/^visibility:hidden$/) &&
      hasStep(/^visibility:visible$/) &&
      hasStep(/^lifecycle:pagehide-persisted$/) &&
      hasStep(/^lifecycle:pageshow-persisted$/),
    "Hidden/visible and synthetic persisted page lifecycle paths are measured.",
  );
  addCoverage(
    "coverage:history-resize-departure",
    hasStep(/^history:back$/) &&
      hasStep(/^history:forward$/) &&
      hasStep(/^resize:tier-b$/) &&
      hasStep(/^resize:restore$/) &&
      hasStep(/^departure:start$/) &&
      hasStep(/^departure:destination$/) &&
      hasStep(/^departure:return$/),
    "History, responsive projection, bounded departure, and return focus are measured.",
  );
  addCoverage(
    "coverage:trusted-bfcache",
    // RC2 WP7: BFCache breadth now covers both the desktop AND mobile
    // viewports (a second traversal, a second viewport) — require at
    // least both and every recorded traversal proven, not just the first
    // match found across the matrix.
    trustedBfcacheStates.length >= 2 &&
      trustedBfcacheStates.every(
        (state) =>
          state.trustedBfcache?.historyTraversal === "history.back()" &&
          state.trustedBfcache.proven === true,
      ),
    "A real history.back traversal proves BFCache restoration with document identity and trusted persisted pageshow evidence, independently on both the desktop and mobile viewports.",
    {
      traversals: trustedBfcacheStates.map((state) => ({
        caseId: state.caseId,
        trustedBfcache: state.trustedBfcache ?? { evidence: "unavailable" },
      })),
    },
  );
  addCoverage(
    "coverage:desktop-large-chamber-screenshots",
    DISTRICTS.every((district) =>
      chamberScreenshots.some((screenshot) =>
        screenshot.district === district && screenshot.animations === "disabled",
      ),
    ) && chamberScreenshots.length === DISTRICTS.length,
    "Desktop-large includes one deterministic settled screenshot for each of the seven chambers.",
    {
      requiredDistricts: [...DISTRICTS],
      screenshots: chamberScreenshots,
    },
  );
  addCoverage(
    "coverage:cycles",
    allStates.filter((state) => /^chamber:cycle-/.test(state.step) && state.measured).length >= 3,
    "A warm-up and at least three measured chamber cycles are present.",
  );
  addCoverage(
    "coverage:animation-ledger",
    allStates.some((state) => (state.animations?.details?.length ?? 0) > 0) &&
      allStates.every((state) =>
        Number.isInteger(
          state.animations.motionBudget?.runningEnvironmentAnimationCount,
        ) &&
        Array.isArray(state.animations.motionBudget?.runningTransientTokens) &&
        Array.isArray(state.animations.motionBudget?.runningScrollTokens) &&
        Array.isArray(state.animations.motionBudget?.transientTimingViolations) &&
        Array.isArray(state.animations.motionBudget?.unclassifiedEnvironmentAnimations),
      ),
    "Per-animation identity, a structurally-resolved continuous/transient/scroll channel token, play state, timing/progress, timeline type, and motion-budget evidence (including transient timing and unclassified-animation detection) is present.",
  );
  addCoverage(
    "coverage:scroll-linked-choreography",
    SCROLL_LINKED_DISTRICTS.every((districtId) =>
      allStates.some(
        (state) =>
          state.step === `choreography:scroll-linked:${districtId}` &&
          state.scrollLinkedChoreography?.passed === true,
      ),
    ),
    "Desktop Tier A proves a genuine, nonzero ViewTimeline animation that responds across native scroll endpoints, independently in every one of the four scroll-linked travel chambers.",
    {
      chambers: SCROLL_LINKED_DISTRICTS.map((districtId) => ({
        districtId,
        scrollLinkedChoreography:
          allStates.find((state) => state.step === `choreography:scroll-linked:${districtId}`)
            ?.scrollLinkedChoreography ?? { evidence: "unavailable" },
      })),
    },
  );
  const targetSizeSamplingByCase = results.map((result) => {
    const measuringStates = result.states.filter(
      (state) => state.targetSize?.minimumPx === 44,
    );
    // The gate predicate below requires this to be true for every state
    // that measures target sizes at all — a 0-sample state (obstruction
    // never actually measured, e.g. every target off-viewport and
    // unsampleable) must not silently satisfy the gate the way
    // Number.isInteger(obstructionFailures) used to (0 is an integer too).
    const anyStateActuallyMeasured = measuringStates.some(
      (state) => state.targetSize.obstructionMeasured > 0,
    );
    const measured = measuringStates.reduce(
      (sum, state) => sum + (state.targetSize.obstructionMeasured ?? 0),
      0,
    );
    const skipped = measuringStates.reduce(
      (sum, state) => sum + (state.targetSize.obstructionSampling?.skipped ?? 0),
      0,
    );
    const reasons = measuringStates.reduce((tally, state) => {
      for (const [reason, count] of Object.entries(
        state.targetSize.obstructionSampling?.reasons ?? {},
      )) {
        tally[reason] = (tally[reason] ?? 0) + count;
      }
      return tally;
    }, {});
    return {
      caseId: result.spec.id,
      measuringStateCount: measuringStates.length,
      anyStateActuallyMeasured,
      measured,
      skipped,
      reasons,
    };
  });
  addCoverage(
    "coverage:target-size",
    targetSizeSamplingByCase.every(
      (entry) => entry.measuringStateCount > 0 && entry.anyStateActuallyMeasured,
    ),
    "Every viewport measures at least one 44px target and obtains at least one center-point obstruction sample (obstructionMeasured > 0) — either naturally in-viewport at rest, or scroll-restored (scrollIntoView to center, hit-tested, exact scroll position restored) in a dedicated post-CLS phase.",
    { cases: targetSizeSamplingByCase },
  );
  const directoryOpenCases = results.filter((result) => result.spec.width <= 860);
  addCoverage(
    "coverage:mobile-facility-directory",
    directoryOpenCases.length > 0 &&
      directoryOpenCases.every(
        (result) =>
          result.states.some((state) => state.step === "directory:open") &&
          result.states.some((state) => state.step === "directory:close"),
      ),
    "Every sub-860px viewport opens, measures (target-size and obstruction), and closes the mobile facility map — the primary small-screen navigation.",
    {
      cases: directoryOpenCases.map((result) => ({
        caseId: result.spec.id,
        opened: result.states.some((state) => state.step === "directory:open"),
        closed: result.states.some((state) => state.step === "directory:close"),
      })),
    },
  );
  const perChamberAxeCaseIds = ["desktop-large", "mobile"];
  addCoverage(
    "coverage:per-chamber-axe",
    perChamberAxeCaseIds.every((caseId) => {
      const result = results.find((candidate) => candidate.spec.id === caseId);
      return DISTRICTS.every((district) => {
        const districtAxe = result?.perDistrictAxe?.[district];
        return (
          Array.isArray(districtAxe?.violations) &&
          Array.isArray(districtAxe?.incomplete) &&
          Array.isArray(districtAxe?.passes)
        );
      });
    }),
    "Both the desktop-large and mobile cases run an independent Axe audit against every one of the seven settled chambers (not just whichever chamber happened to be active for the single full-page audit).",
    {
      cases: perChamberAxeCaseIds.map((caseId) => {
        const result = results.find((candidate) => candidate.spec.id === caseId);
        return {
          caseId,
          districts: DISTRICTS.map((district) => ({
            district,
            measured: Boolean(result?.perDistrictAxe?.[district]),
          })),
        };
      }),
    },
  );
  addCoverage(
    "coverage:network-failures",
    results.every((result) =>
      Array.isArray(result.responses) &&
      Array.isArray(result.requestFailures) &&
      Array.isArray(result.httpFailures),
    ),
    "HTTP status and browser request-failure ledgers are present without bodies.",
  );
  addCoverage(
    "coverage:axe-detail-ledger",
    results.every((result) =>
      Array.isArray(result.axe?.violations) &&
      Array.isArray(result.axe?.incomplete) &&
      Array.isArray(result.axe?.passes) &&
      typeof result.axe?.manualReview?.required === "boolean" &&
      result.axe?.manualReview?.auditError === null,
    ),
    "Axe violations and incomplete rules retain privacy-safe rule/node detail, passing rule ids are persisted as an array (not a count), with incomplete results explicitly routed to manual review.",
  );
  addCoverage(
    "coverage:javascript-disabled",
    javaScriptDisabled.districtCount === DISTRICTS.length &&
      javaScriptDisabled.overflowX === 0,
    "The JavaScript-disabled document remains complete and has no horizontal overflow.",
    javaScriptDisabled,
  );

  return {
    passed: captureMissingFeatures ? null : findings.length === 0,
    status: captureMissingFeatures
      ? "captured-missing-feature-ledger"
      : findings.length === 0
        ? "accepted"
        : "hold",
    findingCount: findings.length,
    observationCount: observations.length,
    coverage,
    findings,
    observations,
  };
}

const results = [];
try {
  for (const spec of selectedMatrix) {
    try {
      results.push(await runCase(spec));
    } catch (error) {
      if (!captureMissingFeatures) throw error;
      results.push(missingFeatureCaseResult(spec, error));
    }
  }

  let jsDisabledContext = null;
  let jsDisabled;
  try {
    jsDisabledContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    const jsDisabledPage = await jsDisabledContext.newPage();
    await jsDisabledPage.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    jsDisabled = {
      districtCount: await jsDisabledPage.locator("[data-cxos-district]").count(),
      headings: await jsDisabledPage.locator("h1, h2").allTextContents(),
      overflowX: await jsDisabledPage.evaluate(
        () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      ),
      captureError: null,
    };
    await jsDisabledPage.screenshot({
      path: join(evidenceDir, `${label}-javascript-disabled.png`),
      fullPage: true,
      animations: "disabled",
    });
  } catch (error) {
    if (!captureMissingFeatures) throw error;
    jsDisabled = {
      districtCount: null,
      headings: [],
      overflowX: null,
      captureError: safeErrorSummary(error),
    };
  } finally {
    await jsDisabledContext?.close();
  }

  const acceptance = evaluateReportAcceptance(results, jsDisabled);
  const axeManualReviewCases = results
    .filter((result) => result.axe.manualReview.required)
    .map((result) => ({
      caseId: result.spec.id,
      status: result.axe.manualReview.status,
      ruleCount: result.axe.manualReview.ruleCount,
      nodeCount: result.axe.manualReview.nodeCount,
      auditError: result.axe.manualReview.auditError,
    }));
  const axeManualReview = {
    required: axeManualReviewCases.length > 0,
    status: axeManualReviewCases.length > 0 ? "manual-review-required" : "not-required",
    disposition: "Incomplete Axe results are preserved for manual review and never automatically classified as violations.",
    cases: axeManualReviewCases,
  };
  const report = {
    schemaVersion: 5,
    label,
    capturedAt: new Date().toISOString(),
    sourceRevision,
    captureMode,
    target: `${baseUrl}${route}`,
    measurementContract: {
      phaseSegmentation:
        "API and rAF events are assigned by invocation/execution timestamp; PerformanceObserver entries are assigned by entry.startTime within each non-overlapping phase window.",
      cumulativeFields:
        "Only performance.cumulative and evidenceTotals are cumulative; cls, evidence, performance.phase, and idleRafDelta describe the named phase only.",
      ownershipTaxonomy: {
        "candidate-owned": "Candidate route document or route-specific Next.js chunk path.",
        "inherited-framework": "Explicit Next.js/NextAuth runtime path or NextAuth persistence key.",
        "first-party-unattributed": "Same-origin behavior without enough source evidence to assign ownership.",
        external: "Cross-origin source or request.",
        mixed: "A performance entry containing scripts from more than one ownership class.",
        "long-task-api-unattributable":
          "A Long Task whose own attribution is containerType \"window\" with no script source (the Long Task API's ceiling — it cannot name a script) AND no containing Long Animation Frame in the same case/step window recorded a script-derived owner. Resolved post-processing only, in attributionResolved; the raw longTask entry and its original attribution/ownership fields are never altered.",
      },
      persistencePrivacy:
        "Persistence keys, mechanisms, operation names, and value lengths are recorded; cookie/storage values and request bodies are never recorded.",
      networkPrivacy:
        "Request and response URLs omit query strings and credentials; methods, resource types, status codes, and failure text are recorded, never request or response bodies.",
      animationLedger:
        "Every snapshot records animation name, source kind, pseudo-element, structural target, the raw data-cxos-motion-channel attribute string, and a structurally-resolved single token/class (continuous, transient, or scroll — read from the token's own prefix; never from a keyframe name). For an owner that declares more than one token, the specific running animation's own computed timeline type and iteration count disambiguate which token applies. Continuous channels are counted by distinct running token: Tier A <=2, Tier B <=1, every quiet/static state =0. Transient channels are counted by distinct running token, grouping staggered instances of one recognition beat as one logical beat: <=3 concurrent, each individual running instance a single iteration and <=1500ms. Scroll channels are tracked but excluded from the continuous count. Any running animation on a decorative/environment surface (or matching a retained legacy-keyframe-name safety net, kept only as a backstop for animations with no ancestor-or-self channel attribute at all — never consulted to decide a class) with no resolvable token fails as unclassified-environment-animation. A dedicated native-scroll probe separately proves visible-subject ViewTimeline wiring to the document scroller plus nonzero timing and rendered transform response, independently for each of the four scroll-linked chambers (client-operations, evidence-archive, growth-threshold, business-health).",
      syntheticLifecycle:
        "Synthetic visibility and PageTransitionEvent phases are explicitly labeled, record isTrusted=false, and are diagnostic only—never BFCache proof. Trusted BFCache proof requires a real history.back traversal, reused document ID, and isTrusted=true pageshow.persisted=true; CDP not-used reasons are recorded where available. Proven independently on both the desktop and mobile viewports.",
      reflow200:
        "The 200% reflow case uses a 720x450 CSS viewport at deviceScaleFactor 2, producing a 1440x900 physical surface. It does not modify the root font size.",
      axePrivacyAndManualReview:
        "Axe violations, incomplete results, and passing rule ids (an array, not a count) retain sanitized rule, selector, check, and node detail. Raw node HTML and check data are omitted. Incomplete results are reported for manual review and are not automatically treated as violations. runOnly covers wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22a/wcag22aa. On the desktop-large and mobile cases, an additional independent audit runs once per chamber at that chamber's settled state, keyed by district id; an audit error on any chamber fails the run rather than skipping it.",
      deterministicScreenshots:
        "Each desktop-large chamber screenshot waits on the settled-shot gate and disables animations during capture for deterministic pixels.",
      targetSize:
        "Settled and responsive snapshots measure visible enabled controls against the CXOS 44px minimum. A control already centered in the viewport is hit-tested for obstruction at rest. A control whose center is off-viewport is sampled in a dedicated post-CLS phase, strictly after that state's normal capture: its exact scroll position is recorded, it is scrolled to viewport center, its true center is hit-tested, then the exact prior scroll position is restored before the next target — so the probe never contaminates the CLS/animation-sensitive numbers already recorded for that state. A target that still cannot be resolved is recorded with an explicit skipReason (zero-size, covered-by-definition, or detached) instead of being silently omitted; obstructionMeasured counts only targets actually sampled, never a hollow 0-of-0 pass. No labels or form values are recorded.",
    },
    toolchain: {
      harness: {
        name: basename(harnessPath),
        sha256: sha256(harnessPath),
      },
      playwright: {
        version: playwrightPackage.version,
        packageSha256: sha256(playwrightPackagePath),
        packageName: playwrightPackage.name,
      },
      axe: {
        version: axePackage.version,
        scriptSha256: sha256(axePath),
        scriptName: basename(axePath),
      },
      browserVersion: browser.version(),
    },
    matrix: results,
    javaScriptDisabled: jsDisabled,
    axeManualReview,
    acceptance,
  };
  const reportPath = join(evidenceDir, `${label}-browser-evidence.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (captureMissingFeatures) {
    console.log(`CXOS_BROWSER_EVIDENCE_BASELINE_CAPTURED: ${reportPath}`);
  } else if (acceptance.passed) {
    console.log(`CXOS_BROWSER_EVIDENCE_OK: ${reportPath}`);
  } else {
    console.error(
      `CXOS_BROWSER_EVIDENCE_HOLD: ${acceptance.findingCount} blocking finding(s); report: ${reportPath}`,
    );
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
