#!/usr/bin/env node

/**
 * CXOS Living Environment deterministic handoff builder.
 *
 * Node built-ins only. The tool never installs dependencies, fetches a URL, follows a
 * symlink, overwrites an output, or discovers package members implicitly.
 *
 * Manifest schema (all paths are relative, forward-slash paths):
 * {
 *   "version": 1,
 *   "packageName": "cxos-living-environment-engine-rc1",
 *   "reports": [
 *     {
 *       "source": "reports/final-review.md",
 *       "html": "reports/final-review.html",
 *       "title": "Optional title override",
 *       "status": "Optional status override"
 *     }
 *   ],
 *   "files": [
 *     { "source": "reports/final-review.md", "archive": "reports/final-review.md" },
 *     { "source": "evidence/browser.json", "archive": "evidence/browser.json" }
 *   ],
 *   "integrity": { "path": "SHA256SUMS.json" },
 *   "forbiddenTerms": ["optional-reviewer-handle"],
 *   "allowedEmailDomains": ["creditvector.app"]
 * }
 *
 * Build a new curated stage and deterministic ZIP (existing outputs are rejected):
 *   node scripts/cxos-living-environment/handoff.mjs build \
 *     --manifest handoff.json --root . --out ./handoff-stage --zip ./handoff.zip
 *
 * Validate sources and in-memory renders without writing; optionally validate a stage
 * and/or ZIP against the same manifest:
 *   node scripts/cxos-living-environment/handoff.mjs validate \
 *     --manifest handoff.json --root . [--stage ./handoff-stage] [--zip ./handoff.zip]
 *   node scripts/cxos-living-environment/handoff.mjs --validate-only \
 *     --manifest handoff.json --root .
 *
 * Run the dependency-free temporary fixture suite:
 *   node scripts/cxos-living-environment/handoff.mjs self-test
 */

import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir, userInfo } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";
import process from "node:process";
import { inflateSync } from "node:zlib";

const MANIFEST_VERSION = 1;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_REPORT_BYTES = 12 * 1024 * 1024;
const MAX_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const ZIP_DOS_DATE_1980_01_01 = 33;
const ZIP_UNIX_REGULAR_MODE = 0o100644;

class HandoffError extends Error {
  constructor(message) {
    super(message);
    this.name = "HandoffError";
  }
}

function fail(message) {
  throw new HandoffError(message);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function assertOnlyKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    fail(`${label} contains undeclared field(s): ${unexpected.sort().join(", ")}`);
  }
}

function assertShortText(value, label, { required = false, max = 240 } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max || /[\0\r\n]/.test(trimmed)) {
    fail(`${label} contains invalid or excessive text`);
  }
  return trimmed;
}

function normalizeRelativePath(value, label, expectedExtension) {
  if (typeof value !== "string" || value.trim() !== value || value === "") {
    fail(`${label} must be a non-empty normalized relative path`);
  }
  if (
    value.includes("\\") ||
    value.includes("\0") ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith("/") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`${label} must be a portable relative path`);
  }
  const parts = value.split("/");
  if (
    parts.some(
      (part) =>
        part === "" ||
        part === "." ||
        part === ".." ||
        part.length > 180 ||
        part.normalize("NFC") !== part ||
        /[. ]$/.test(part) ||
        /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part) ||
        /[:*?"<>|]/.test(part),
    )
  ) {
    fail(`${label} contains an unsafe path segment`);
  }
  const normalized = posix.normalize(value);
  if (normalized !== value || Buffer.byteLength(normalized, "utf8") > 600) {
    fail(`${label} is not a canonical archive path`);
  }
  if (expectedExtension && extname(normalized).toLowerCase() !== expectedExtension) {
    fail(`${label} must end with ${expectedExtension}`);
  }
  return normalized;
}

function assertSafeArtifactPath(value, label) {
  const normalized = normalizeRelativePath(value, label);
  const fileName = posix.basename(normalized).toLowerCase();
  if (
    /^\.env(?:\.|$)/.test(fileName) ||
    /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.|$)/.test(fileName) ||
    /^(?:credentials|secrets?)(?:\.|$)/.test(fileName) ||
    /^(?:\.npmrc|\.pypirc|\.netrc)$/.test(fileName) ||
    /\.(?:pem|key|p12|pfx|keystore)$/.test(fileName)
  ) {
    fail(`${label} names a credential-bearing file type`);
  }
  return normalized;
}

function compareArchiveNames(left, right) {
  const leftName = typeof left === "string" ? left : left.name;
  const rightName = typeof right === "string" ? right : right.name;
  return Buffer.compare(Buffer.from(leftName, "utf8"), Buffer.from(rightName, "utf8"));
}

function isWithin(root, target) {
  const delta = relative(root, target);
  return delta === "" || (!delta.startsWith(`..${sep}`) && delta !== ".." && !isAbsolute(delta));
}

async function assertRegularRoot(rootArg) {
  const requested = resolve(rootArg ?? process.cwd());
  let stats;
  try {
    stats = await lstat(requested);
  } catch {
    fail("--root must name an existing directory");
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("--root must be a real directory, not a symlink");
  }
  return realpath(requested);
}

async function resolveDeclaredFile(root, declaredPath, label, sizeLimit = MAX_ENTRY_BYTES) {
  const normalized = normalizeRelativePath(declaredPath, label);
  const parts = normalized.split("/");
  let cursor = root;
  for (let index = 0; index < parts.length; index += 1) {
    cursor = join(cursor, parts[index]);
    let stats;
    try {
      stats = await lstat(cursor);
    } catch {
      fail(`${label} does not exist: ${normalized}`);
    }
    if (stats.isSymbolicLink()) {
      fail(`${label} traverses a symlink: ${normalized}`);
    }
    if (index < parts.length - 1 && !stats.isDirectory()) {
      fail(`${label} traverses a non-directory: ${normalized}`);
    }
    if (index === parts.length - 1) {
      if (!stats.isFile()) fail(`${label} must be a regular file: ${normalized}`);
      if (stats.size > sizeLimit) fail(`${label} exceeds its size limit: ${normalized}`);
    }
  }
  const canonical = await realpath(cursor);
  if (!isWithin(root, canonical)) fail(`${label} resolves outside --root`);
  return { absolute: canonical, relative: normalized };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripInlineMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function slugBase(value) {
  const slug = stripInlineMarkdown(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "section";
}

function createSlugger() {
  const seen = new Map();
  return (value) => {
    const base = slugBase(value);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

function renderInline(input) {
  if (input.includes("\0")) fail("Markdown contains a NUL byte");
  const slots = [];
  const reserve = (html) => {
    const token = `\uE000${slots.length}\uE001`;
    slots.push(html);
    return token;
  };

  let value = input;
  value = value.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_match, alt) =>
    reserve(`<span class="image-reference">Image reference omitted: ${escapeHtml(alt)}</span>`),
  );
  value = value.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_match, label, target) => {
    const cleanLabel = escapeHtml(stripInlineMarkdown(label));
    const trimmedTarget = target.trim();
    if (/^#[A-Za-z0-9_-]+$/.test(trimmedTarget)) {
      return reserve(`<a href="${escapeHtml(trimmedTarget)}">${cleanLabel}</a>`);
    }
    return reserve(`<span class="reference">${cleanLabel}</span>`);
  });
  value = value.replace(/`([^`\n]+)`/g, (_match, code) =>
    reserve(`<code>${escapeHtml(code)}</code>`),
  );

  value = escapeHtml(value);
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  value = value.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  value = value.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  value = value.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  value = value.replace(/ {2}$/g, "<br>");
  value = value.replace(/\uE000(\d+)\uE001/g, (_match, index) => slots[Number(index)]);
  return value;
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  const cells = [];
  let current = "";
  let escaped = false;
  let inCode = false;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "`") {
      inCode = !inCode;
      current += character;
    } else if (character === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (escaped) current += "\\";
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isListLine(line) {
  return /^\s*(?:[-+*]|\d+\.)\s+/.test(line);
}

function isBlockStart(lines, index) {
  const line = lines[index] ?? "";
  if (/^\s*$/.test(line)) return true;
  if (/^\s*```/.test(line)) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^\s*>\s?/.test(line)) return true;
  if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) return true;
  if (isListLine(line)) return true;
  if (line.includes("|") && isTableSeparator(lines[index + 1] ?? "")) return true;
  return false;
}

function extractReportMetadata(markdown, declaredTitle, declaredStatus) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (!titleMatch) fail("Every declared Markdown report must contain one level-one title");
  const title = declaredTitle ?? stripInlineMarkdown(titleMatch[1]);
  const statusMatch = markdown.match(
    /^\s*(?:[-*]\s+)?\*\*Status:\*\*\s*(.+?)\s*$/im,
  );
  const status = declaredStatus ?? (statusMatch ? stripInlineMarkdown(statusMatch[1]) : "Report");
  return {
    title: assertShortText(title, "report title", { required: true, max: 180 }),
    status: assertShortText(status, "report status", { required: true, max: 240 }),
    firstTitleLine: titleMatch[0],
  };
}

function renderMarkdown(markdown, metadata) {
  const lines = markdown.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const slug = createSlugger();
  const output = [];
  const headings = [];
  let skippedTitle = false;

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (/^\s*$/.test(line)) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```\s*([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) fail("Markdown contains an unclosed fenced code block");
      index += 1;
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
      output.push(`<pre><code${language}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const sourceLevel = heading[1].length;
      const text = heading[2];
      if (sourceLevel === 1 && !skippedTitle) {
        skippedTitle = true;
        index += 1;
        continue;
      }
      const level = sourceLevel === 1 ? 2 : sourceLevel;
      const id = slug(text);
      output.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      headings.push({ level, id, text: stripInlineMarkdown(text) });
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableSeparator(lines[index + 1] ?? "")) {
      const headerCells = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && !/^\s*$/.test(lines[index])) {
        const cells = splitTableRow(lines[index]);
        while (cells.length < headerCells.length) cells.push("");
        rows.push(cells.slice(0, headerCells.length));
        index += 1;
      }
      const context = headings.at(-1)?.text ?? metadata.title;
      output.push(
        `<div class="table-wrap" role="region" aria-label="Table: ${escapeHtml(context)}" tabindex="0">`,
        "<table>",
        `<caption class="sr-only">Table associated with ${escapeHtml(context)}</caption>`,
        `<thead><tr>${headerCells.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("")}</tr></thead>`,
        `<tbody>${rows
          .map(
            (cells) =>
              `<tr>${cells
                .map((cell, cellIndex) =>
                  cellIndex === 0
                    ? `<th scope="row">${renderInline(cell)}</th>`
                    : `<td>${renderInline(cell)}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody>`,
        "</table>",
        "</div>",
      );
      continue;
    }

    if (isListLine(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (index < lines.length && isListLine(lines[index])) {
        const nextOrdered = /^\s*\d+\.\s+/.test(lines[index]);
        if (nextOrdered !== ordered) break;
        const body = lines[index].replace(/^\s*(?:[-+*]|\d+\.)\s+/, "");
        const task = body.match(/^\[([ xX])\]\s+(.*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === "x";
          items.push(
            `<li class="task"><span class="task-mark" aria-hidden="true">${checked ? "☑" : "☐"}</span>${renderInline(task[2])}</li>`,
          );
        } else {
          items.push(`<li>${renderInline(body)}</li>`);
        }
        index += 1;
      }
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote><p>${renderInline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return { body: output.join("\n"), headings };
}

function renderStandaloneHtml(markdown, declaredTitle, declaredStatus) {
  const metadata = extractReportMetadata(markdown, declaredTitle, declaredStatus);
  const rendered = renderMarkdown(markdown, metadata);
  const toc = rendered.headings
    .filter((heading) => heading.level <= 3)
    .map(
      (heading) =>
        `<li class="toc-level-${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; script-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    :root { color-scheme: dark light; --page:#07111d; --surface:#0d1c2c; --surface-2:#12263a; --text:#eef6fa; --muted:#b4c6d2; --line:#315069; --brand:#65e0d8; --amber:#ffd184; --shadow:0 18px 42px rgba(0,0,0,.25); }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--page); color:var(--text); font:16px/1.65 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    a { color:var(--brand); text-underline-offset:.18em; }
    a:focus-visible, textarea:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--amber); outline-offset:3px; }
    .skip-link { position:fixed; z-index:10; top:1rem; left:1rem; transform:translateY(-180%); padding:.7rem 1rem; border-radius:.5rem; background:var(--amber); color:#111; }
    .skip-link:focus { transform:translateY(0); }
    .shell { width:min(1080px,calc(100% - 2rem)); margin-inline:auto; }
    header { padding:3.75rem 0 2rem; border-bottom:1px solid var(--line); }
    .eyebrow { color:var(--brand); font-size:.76rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { max-width:25ch; margin:.45rem 0 1rem; font-size:clamp(2.2rem,6vw,4.5rem); line-height:1.04; letter-spacing:-.04em; }
    h2,h3,h4,h5,h6 { scroll-margin-top:1rem; line-height:1.22; letter-spacing:-.02em; }
    h2 { margin-top:3rem; font-size:clamp(1.6rem,3vw,2.35rem); }
    h3 { margin-top:2rem; }
    p,li { max-width:88ch; }
    .status-badge { display:inline-block; padding:.28rem .66rem; border:1px solid var(--amber); border-radius:999px; color:var(--amber); font-size:.82rem; font-weight:800; }
    .boundary { max-width:82ch; color:var(--muted); }
    nav { padding:1rem 0; border-bottom:1px solid var(--line); background:var(--surface); }
    nav h2 { margin:0 0 .45rem; font-size:1rem; }
    nav ul { display:flex; flex-wrap:wrap; gap:.35rem 1rem; margin:0; padding:0; list-style:none; }
    nav a { display:inline-block; min-height:44px; padding:.55rem 0; }
    .toc-level-3 { padding-left:.65rem; }
    main { padding:2rem 0 4rem; }
    blockquote { margin:1.4rem 0; padding:.8rem 1rem; border-left:4px solid var(--brand); background:var(--surface); color:var(--muted); }
    blockquote p { margin:0; }
    hr { margin:2.5rem 0; border:0; border-top:1px solid var(--line); }
    pre { overflow:auto; padding:1rem; border:1px solid var(--line); border-radius:.75rem; background:#050b12; color:#edf7fa; }
    code { border:1px solid var(--line); border-radius:.3rem; padding:.08em .3em; background:var(--surface-2); color:var(--brand); }
    pre code { border:0; padding:0; background:transparent; color:inherit; }
    .table-wrap { overflow-x:auto; margin:1.25rem 0; border:1px solid var(--line); border-radius:.85rem; }
    table { width:100%; min-width:620px; border-collapse:collapse; background:var(--surface); }
    th,td { padding:.72rem .82rem; border-top:1px solid var(--line); text-align:left; vertical-align:top; }
    thead th { border-top:0; background:var(--surface-2); color:var(--brand); }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
    .task { list-style:none; margin-left:-1.5rem; }
    .task-mark { display:inline-block; width:1.6rem; color:var(--brand); }
    .reference,.image-reference { color:var(--muted); text-decoration:underline dotted; }
    .copy-panel { margin-top:4rem; padding:1rem; border:1px solid var(--line); border-radius:1rem; background:var(--surface); box-shadow:var(--shadow); }
    .copy-panel h2 { margin-top:0; font-size:1.35rem; }
    .copy-panel p { color:var(--muted); }
    textarea { width:100%; min-height:20rem; resize:vertical; padding:1rem; border:1px solid var(--line); border-radius:.75rem; background:var(--page); color:var(--text); font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
    footer { padding:2rem 0 3rem; border-top:1px solid var(--line); color:var(--muted); }
    @media (prefers-color-scheme: light) { :root { --page:#fff; --surface:#f4f8fa; --surface-2:#e9f2f5; --text:#14202b; --muted:#4c6070; --line:#9eb0bc; --brand:#07666b; --amber:#7a4b00; --shadow:none; } pre { background:#eef4f7; color:#14202b; } }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior:auto; } }
    @media (max-width:680px) { header { padding-top:2.5rem; } nav ul { display:block; } table { min-width:560px; } .shell { width:min(100% - 1.1rem,1080px); } }
    @page { size:auto; margin:16mm; }
    @media print { :root { color-scheme:light; --page:#fff; --surface:#fff; --surface-2:#eef4f7; --text:#111827; --muted:#425466; --line:#93a4b2; --brand:#075e63; --amber:#7a4b00; --shadow:none; } body { font-size:10.5pt; } .shell { width:100%; } header { padding-top:0; } nav,.skip-link,.copy-panel { display:none; } main { padding-bottom:0; } h1 { font-size:28pt; } h2 { font-size:18pt; break-after:avoid; } h3 { font-size:13pt; break-after:avoid; } .table-wrap { overflow:visible; border:0; } table { min-width:0; font-size:8.5pt; } thead { display:table-header-group; } tr,pre,blockquote { break-inside:avoid; } a { color:inherit; text-decoration:none; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#content">Skip to report</a>
  <header>
    <div class="shell">
      <div class="eyebrow">CreditVector Experience OS · deterministic handoff</div>
      <h1>${escapeHtml(metadata.title)}</h1>
      <p><span class="status-badge">${escapeHtml(metadata.status)}</span></p>
      <p class="boundary">Offline report mirror. It loads no external asset, script, font, frame, or network resource.</p>
    </div>
  </header>
  ${toc ? `<nav aria-label="Report contents"><div class="shell"><h2>Contents</h2><ul>${toc}</ul></div></nav>` : ""}
  <main id="content" class="shell">
    <article>
${rendered.body}
    </article>
    <section class="copy-panel" aria-labelledby="copy-ready-title">
      <h2 id="copy-ready-title">Copy-ready Markdown</h2>
      <p id="copy-ready-help">This native read-only field performs no clipboard action. Select the text and use your platform’s normal copy command.</p>
      <textarea readonly spellcheck="false" aria-describedby="copy-ready-help" aria-label="Copy-ready Markdown source">${escapeHtml(markdown)}</textarea>
    </section>
  </main>
  <footer><div class="shell">Generated deterministically from the declared Markdown source. No release authority is implied.</div></footer>
</body>
</html>
`;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dynamicForbiddenTerms() {
  const common = new Set(["root", "runner", "node", "user", "unknown"]);
  const terms = new Set();
  for (const candidate of [
    process.env.USER,
    process.env.LOGNAME,
    basename(homedir()),
    (() => {
      try {
        return userInfo().username;
      } catch {
        return undefined;
      }
    })(),
  ]) {
    const normalized = typeof candidate === "string" ? candidate.trim() : "";
    if (normalized.length >= 3 && !common.has(normalized.toLowerCase())) terms.add(normalized);
  }
  return [...terms];
}

function scanEmails(text, allowedEmailDomains, label) {
  const emailPattern = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
  for (const match of text.matchAll(emailPattern)) {
    const domain = match[1].toLowerCase();
    if (!allowedEmailDomains.has(domain)) {
      fail(`${label} contains a non-allowlisted email address`);
    }
  }
}

function looksLikeLuhnNumber(raw) {
  const digits = raw.replace(/[ -]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function scanSensitiveText(label, text, policy) {
  const patterns = [
    ["a local Unix path", /(?:^|[\s("'`])\/(?:Users|root|workspace|Volumes|private\/(?:tmp|var)|var\/folders|tmp)\/[A-Za-z0-9._-]+/m],
    ["a local Linux home path", /(?:^|[\s("'`])\/home\/[A-Za-z0-9._-]+\//m],
    ["a local Windows path", /\b[A-Za-z]:\\(?:Users|Documents and Settings|Windows)\\/i],
    ["a file URL", /\bfile:\/\//i],
    ["a private key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i],
    ["a Stripe credential", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/],
    ["a Git provider credential", /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,})\b/],
    ["a Slack credential", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
    ["an AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["a Google API credential", /\bAIza[A-Za-z0-9_-]{30,}\b/],
    ["a bearer credential", /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~-]{8,}/i],
    ["a credential-bearing URL", /:\/\/[^\s/:@]+:[^\s/@]+@/],
    ["a JWT-like credential", /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/],
    ["a credential assignment", /\b(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|DATABASE_URL)\b["']?\s*[:=]\s*(?!["']?(?:REDACTED|UNSET|NONE|OFF)\b)["']?[^\s,"';<]{8,}/i],
    ["a Social Security number", /\b\d{3}-\d{2}-\d{4}\b/],
    ["a phone number", /(?:^|\D)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?:\D|$)/m],
    ["a customer-data assignment", /\b(?:customer|client|consumer|user)\s*(?:id|name|email|phone|address|ssn|dob)\b["']?\s*[:=]\s*["']?[^\s,"'<]{3,}/i],
    ["a Stripe customer or payment identifier", /\b(?:cus|sub|pi|pm|ch)_[A-Za-z0-9]{8,}\b/],
    ["a private Vercel deployment URL", /\b[A-Za-z0-9-]+\.vercel\.app\b/i],
    ["a private deployment identifier", /\b(?:dpl_[A-Za-z0-9]{8,}|prj_[A-Za-z0-9]{8,}|VERCEL_(?:URL|DEPLOYMENT_ID)|x-vercel-id)\b/i],
    ["a deployment-protection credential", /\bx-vercel-protection-bypass\s*[:=]\s*[A-Za-z0-9._~-]{8,}/i],
    ["a loopback or private host", /(?:\b(?:localhost(?::\d+)?|host\.docker\.internal|127\.0\.0\.1(?::\d+)?|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b|\[?::1\]?)/i],
  ];

  for (const [description, pattern] of patterns) {
    if (pattern.test(text)) fail(`${label} contains ${description}`);
  }

  for (const candidate of text.matchAll(/(?:\d[ -]?){13,19}/g)) {
    if (looksLikeLuhnNumber(candidate[0])) fail(`${label} contains a payment-card-like number`);
  }

  scanEmails(text, policy.allowedEmailDomains, label);
  for (const term of policy.forbiddenTerms) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9])${regexEscape(term)}([^A-Za-z0-9]|$)`, "i");
    if (pattern.test(text)) fail(`${label} contains a forbidden identity term`);
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PNG_TEXT_BYTES = 1024 * 1024;

function inflatePngText(buffer, label) {
  try {
    return inflateSync(buffer, { maxOutputLength: MAX_PNG_TEXT_BYTES });
  } catch {
    fail(`${label} contains invalid or excessive compressed PNG text metadata`);
  }
}

function pngTextMetadata(buffer, label) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  const metadata = [];
  let offset = PNG_SIGNATURE.length;
  let sawEnd = false;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) fail(`${label} contains a truncated PNG chunk`);
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) fail(`${label} contains an invalid PNG chunk type`);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > buffer.length) {
      fail(`${label} contains an invalid PNG chunk length`);
    }
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      metadata.push({ type, buffer: data });
    } else if (type === "zTXt") {
      const separator = data.indexOf(0);
      if (separator < 1 || separator + 2 > data.length || data[separator + 1] !== 0) {
        fail(`${label} contains malformed zTXt metadata`);
      }
      metadata.push({
        type,
        buffer: Buffer.concat([
          data.subarray(0, separator),
          Buffer.from("\n"),
          inflatePngText(data.subarray(separator + 2), label),
        ]),
      });
    } else if (type === "iTXt") {
      const keywordEnd = data.indexOf(0);
      if (keywordEnd < 1 || keywordEnd + 3 > data.length) {
        fail(`${label} contains malformed iTXt metadata`);
      }
      const compressionFlag = data[keywordEnd + 1];
      const compressionMethod = data[keywordEnd + 2];
      const languageEnd = data.indexOf(0, keywordEnd + 3);
      const translatedEnd = languageEnd < 0 ? -1 : data.indexOf(0, languageEnd + 1);
      if (
        (compressionFlag !== 0 && compressionFlag !== 1) ||
        compressionMethod !== 0 ||
        languageEnd < 0 ||
        translatedEnd < 0
      ) {
        fail(`${label} contains malformed iTXt metadata`);
      }
      const text = data.subarray(translatedEnd + 1);
      metadata.push({
        type,
        buffer: Buffer.concat([
          data.subarray(0, keywordEnd),
          Buffer.from("\n"),
          compressionFlag === 1 ? inflatePngText(text, label) : text,
        ]),
      });
    } else if (type === "eXIf") {
      metadata.push({ type, buffer: data });
    }

    offset = chunkEnd;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd || offset !== buffer.length) fail(`${label} contains an invalid PNG structure`);
  return metadata;
}

function scanSensitiveContent(label, buffer, policy) {
  const pngMetadata = pngTextMetadata(buffer, label);
  if (pngMetadata) {
    for (const entry of pngMetadata) {
      scanSensitiveText(`${label} ${entry.type} metadata`, entry.buffer.toString("utf8"), policy);
    }
    return;
  }
  scanSensitiveText(label, buffer.toString("utf8"), policy);
}

function validateOfflineHtml(html, label, { requireGeneratedContract }) {
  const forbiddenPatterns = [
    ["a script element", /<script\b/i],
    ["an external-resource element", /<(?:link|img|iframe|object|embed|video|audio|source)\b/i],
    ["a form", /<form\b/i],
    ["an inline event handler", /\son[a-z]+\s*=/i],
    ["a CSS import", /@import\b/i],
    ["a CSS URL", /url\s*\(/i],
    ["an external URL", /\b(?:https?|ftp|file):\/\//i],
    ["a protocol-relative URL", /(?:src|href)\s*=\s*["']\/\//i],
    ["a source attribute", /\ssrc\s*=/i],
  ];
  for (const [description, pattern] of forbiddenPatterns) {
    if (pattern.test(html)) fail(`${label} contains ${description}`);
  }

  if (!/^<!doctype html>\n<html lang="en">/.test(html)) fail(`${label} lacks an HTML5 language declaration`);
  if (!/<meta name="viewport"/.test(html)) fail(`${label} lacks a mobile viewport`);
  if (!/Content-Security-Policy/.test(html) || !/script-src 'none'/.test(html)) {
    fail(`${label} lacks the offline script-blocking CSP`);
  }
  if (!/<h1>[^<]+<\/h1>/.test(html) || !/<main\b/.test(html) || !/<article\b/.test(html)) {
    fail(`${label} lacks semantic report structure`);
  }
  if (requireGeneratedContract) {
    if (!/@media \(prefers-color-scheme: light\)/.test(html)) fail(`${label} lacks dark/light support`);
    if (!/@media \(prefers-reduced-motion: reduce\)/.test(html)) fail(`${label} lacks reduced-motion support`);
    if (!/@media print/.test(html)) fail(`${label} lacks print styling`);
    if (!/class="status-badge"/.test(html)) fail(`${label} lacks a textual status badge`);
    if (!/<textarea readonly\b/.test(html)) {
      fail(`${label} lacks the script-free copy-ready control`);
    }
  }

  const ids = [...html.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) fail(`${label} contains duplicate HTML ids`);
  const idSet = new Set(ids);
  for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = match[1];
    if (!/^#[A-Za-z0-9_-]+$/.test(href)) fail(`${label} contains a non-local link target`);
    if (!idSet.has(href.slice(1))) fail(`${label} contains a missing local link target`);
  }
}

async function readManifest(root, manifestArg) {
  const declared = normalizeRelativePath(manifestArg, "--manifest", ".json");
  const source = await resolveDeclaredFile(root, declared, "manifest", MAX_MANIFEST_BYTES);
  const raw = await readFile(source.absolute);
  let value;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    fail("manifest is not valid JSON");
  }
  assertObject(value, "manifest");
  assertOnlyKeys(
    value,
    [
      "version",
      "packageName",
      "reports",
      "files",
      "integrity",
      "forbiddenTerms",
      "allowedEmailDomains",
    ],
    "manifest",
  );
  if (value.version !== MANIFEST_VERSION) fail(`manifest.version must equal ${MANIFEST_VERSION}`);
  const packageName = assertShortText(value.packageName, "manifest.packageName", {
    required: true,
    max: 100,
  });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(packageName)) {
    fail("manifest.packageName contains unsafe characters");
  }
  if (!Array.isArray(value.reports) || value.reports.length === 0 || value.reports.length > 50) {
    fail("manifest.reports must declare between 1 and 50 final reports");
  }
  if (!Array.isArray(value.files) || value.files.length > 500) {
    fail("manifest.files must be an array of at most 500 curated files");
  }
  assertObject(value.integrity, "manifest.integrity");
  assertOnlyKeys(value.integrity, ["path"], "manifest.integrity");
  const integrityPath = assertSafeArtifactPath(normalizeRelativePath(
    value.integrity.path,
    "manifest.integrity.path",
    ".json",
  ), "manifest.integrity.path");

  const reports = value.reports.map((report, index) => {
    assertObject(report, `manifest.reports[${index}]`);
    assertOnlyKeys(report, ["source", "html", "title", "status"], `manifest.reports[${index}]`);
    return {
      source: assertSafeArtifactPath(
        normalizeRelativePath(report.source, `manifest.reports[${index}].source`, ".md"),
        `manifest.reports[${index}].source`,
      ),
      html: assertSafeArtifactPath(
        normalizeRelativePath(report.html, `manifest.reports[${index}].html`, ".html"),
        `manifest.reports[${index}].html`,
      ),
      title: assertShortText(report.title, `manifest.reports[${index}].title`, { max: 180 }),
      status: assertShortText(report.status, `manifest.reports[${index}].status`, { max: 240 }),
    };
  });
  const files = value.files.map((file, index) => {
    assertObject(file, `manifest.files[${index}]`);
    assertOnlyKeys(file, ["source", "archive"], `manifest.files[${index}]`);
    return {
      source: assertSafeArtifactPath(
        normalizeRelativePath(file.source, `manifest.files[${index}].source`),
        `manifest.files[${index}].source`,
      ),
      archive: assertSafeArtifactPath(
        normalizeRelativePath(file.archive, `manifest.files[${index}].archive`),
        `manifest.files[${index}].archive`,
      ),
    };
  });

  const forbiddenTerms = [...dynamicForbiddenTerms()];
  if (value.forbiddenTerms !== undefined) {
    if (!Array.isArray(value.forbiddenTerms) || value.forbiddenTerms.length > 50) {
      fail("manifest.forbiddenTerms must be an array of at most 50 terms");
    }
    for (const [index, term] of value.forbiddenTerms.entries()) {
      const normalized = assertShortText(term, `manifest.forbiddenTerms[${index}]`, {
        required: true,
        max: 100,
      });
      if (normalized.length < 3) fail("forbidden identity terms must contain at least 3 characters");
      forbiddenTerms.push(normalized);
    }
  }

  const allowedEmailDomains = new Set([
    "creditvector.app",
    "gabrielcapitallabs.com",
    "example.com",
    "example.test",
  ]);
  if (value.allowedEmailDomains !== undefined) {
    if (!Array.isArray(value.allowedEmailDomains) || value.allowedEmailDomains.length > 30) {
      fail("manifest.allowedEmailDomains must be an array of at most 30 domains");
    }
    for (const [index, domain] of value.allowedEmailDomains.entries()) {
      const normalized = assertShortText(domain, `manifest.allowedEmailDomains[${index}]`, {
        required: true,
        max: 100,
      }).toLowerCase();
      if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(normalized)) {
        fail(`manifest.allowedEmailDomains[${index}] is not a valid domain`);
      }
      allowedEmailDomains.add(normalized);
    }
  }

  const archiveNames = [
    ...reports.map((report) => report.html),
    ...files.map((file) => file.archive),
    integrityPath,
  ];
  if (new Set(archiveNames).size !== archiveNames.length) {
    fail("manifest declares duplicate archive members");
  }
  const portableArchiveNames = archiveNames.map((name) => name.normalize("NFC").toLowerCase());
  if (new Set(portableArchiveNames).size !== portableArchiveNames.length) {
    fail("manifest declares archive members that collide on portable filesystems");
  }
  if (new Set(reports.map((report) => report.source)).size !== reports.length) {
    fail("manifest.reports contains duplicate Markdown sources");
  }

  const policy = {
    forbiddenTerms: [...new Set(forbiddenTerms)],
    allowedEmailDomains,
  };
  for (const archiveName of archiveNames) {
    scanSensitiveContent(`archive member ${archiveName}`, Buffer.from(archiveName, "utf8"), policy);
  }

  return {
    raw,
    packageName,
    reports,
    files,
    integrityPath,
    policy,
  };
}

function addEntry(entries, name, buffer, origin) {
  const normalized = normalizeRelativePath(name, `${origin} archive path`);
  if (!Buffer.isBuffer(buffer)) fail(`${origin} did not produce a Buffer`);
  if (buffer.length > MAX_ENTRY_BYTES) fail(`${origin} exceeds the per-entry size limit`);
  if (entries.has(normalized)) fail(`duplicate archive member: ${normalized}`);
  entries.set(normalized, { name: normalized, buffer, origin });
}

async function assembleEntries(root, manifest) {
  const entries = new Map();

  for (const report of manifest.reports) {
    const source = await resolveDeclaredFile(root, report.source, "report source", MAX_REPORT_BYTES);
    const markdownBuffer = await readFile(source.absolute);
    scanSensitiveContent(`report ${report.source}`, markdownBuffer, manifest.policy);
    const markdown = markdownBuffer.toString("utf8");
    const html = renderStandaloneHtml(markdown, report.title, report.status);
    validateOfflineHtml(html, `generated report ${report.html}`, {
      requireGeneratedContract: true,
    });
    const htmlBuffer = Buffer.from(html, "utf8");
    scanSensitiveContent(`generated report ${report.html}`, htmlBuffer, manifest.policy);
    addEntry(entries, report.html, htmlBuffer, `generated report ${report.source}`);
  }

  for (const file of manifest.files) {
    const source = await resolveDeclaredFile(root, file.source, "curated file");
    const buffer = await readFile(source.absolute);
    scanSensitiveContent(`curated file ${file.archive}`, buffer, manifest.policy);
    if (extname(file.archive).toLowerCase() === ".html") {
      validateOfflineHtml(buffer.toString("utf8"), `curated HTML ${file.archive}`, {
        requireGeneratedContract: false,
      });
    }
    addEntry(entries, file.archive, buffer, `curated file ${file.source}`);
  }

  const dataEntries = [...entries.values()].sort(compareArchiveNames);
  const integrity = {
    schemaVersion: 1,
    packageName: manifest.packageName,
    deterministic: true,
    hashAlgorithm: "sha256",
    sourceManifestSha256: sha256(manifest.raw),
    entries: dataEntries.map((entry) => ({
      path: entry.name,
      bytes: entry.buffer.length,
      sha256: sha256(entry.buffer),
    })),
  };
  const integrityBuffer = Buffer.from(`${JSON.stringify(integrity, null, 2)}\n`, "utf8");
  scanSensitiveContent(`integrity manifest ${manifest.integrityPath}`, integrityBuffer, manifest.policy);
  addEntry(entries, manifest.integrityPath, integrityBuffer, "integrity manifest");

  const sorted = [...entries.values()].sort(compareArchiveNames);
  const totalBytes = sorted.reduce((sum, entry) => sum + entry.buffer.length, 0);
  if (totalBytes > MAX_ARCHIVE_BYTES) fail("curated package exceeds the total size limit");
  return { entries: sorted, integrity, integrityBuffer };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[value] = current >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let current = 0xffffffff;
  for (const byte of buffer) current = CRC32_TABLE[(current ^ byte) & 0xff] ^ (current >>> 8);
  return (current ^ 0xffffffff) >>> 0;
}

function buildDeterministicZip(entries) {
  const canonicalEntries = [...entries].sort(compareArchiveNames);
  if (canonicalEntries.length > 0xffff) fail("ZIP64 is intentionally unsupported: too many members");
  if (new Set(canonicalEntries.map((entry) => entry.name)).size !== canonicalEntries.length) {
    fail("ZIP input contains duplicate members");
  }
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of canonicalEntries) {
    const name = normalizeRelativePath(entry.name, "ZIP member");
    const nameBuffer = Buffer.from(name, "utf8");
    const size = entry.buffer.length;
    if (size > 0xffffffff || nameBuffer.length > 0xffff) {
      fail(`ZIP64 is intentionally unsupported: ${name}`);
    }
    const checksum = crc32(entry.buffer);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(ZIP_DOS_DATE_1980_01_01, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, entry.buffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(ZIP_DOS_DATE_1980_01_01, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((ZIP_UNIX_REGULAR_MODE << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, nameBuffer);

    localOffset += localHeader.length + nameBuffer.length + size;
    if (localOffset > 0xffffffff) fail("ZIP64 is intentionally unsupported: archive is too large");
  }

  const central = Buffer.concat(centralParts);
  if (central.length > 0xffffffff) fail("ZIP64 is intentionally unsupported: central directory is too large");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(canonicalEntries.length, 8);
  end.writeUInt16LE(canonicalEntries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail("ZIP is missing its end-of-central-directory record");
}

function parseZip(buffer) {
  if (buffer.length < 22) fail("ZIP is truncated");
  const endOffset = findEndOfCentralDirectory(buffer);
  const commentLength = buffer.readUInt16LE(endOffset + 20);
  if (endOffset + 22 + commentLength !== buffer.length) fail("ZIP contains trailing or malformed data");
  if (buffer.readUInt16LE(endOffset + 4) !== 0 || buffer.readUInt16LE(endOffset + 6) !== 0) {
    fail("multi-disk ZIP archives are rejected");
  }
  const count = buffer.readUInt16LE(endOffset + 10);
  if (count !== buffer.readUInt16LE(endOffset + 8)) fail("ZIP member counts disagree");
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) fail("ZIP central directory bounds are invalid");

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > endOffset || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      fail("ZIP central directory is malformed");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentSize = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const recordEnd = cursor + 46 + nameLength + extraLength + commentSize;
    if (recordEnd > endOffset) fail("ZIP central member is truncated");
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    normalizeRelativePath(name, "ZIP member");
    if ((flags & 1) !== 0) fail(`encrypted ZIP member is rejected: ${name}`);
    if ((flags & ZIP_UTF8_FLAG) === 0) fail(`ZIP member lacks UTF-8 identity: ${name}`);
    if (method !== ZIP_STORE_METHOD || compressedSize !== size) {
      fail(`non-deterministic ZIP compression is rejected: ${name}`);
    }
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0o170000) === 0o120000) fail(`ZIP symlink is rejected: ${name}`);
    if ((unixMode & 0o170000) !== 0o100000) fail(`ZIP non-regular member is rejected: ${name}`);

    if (localOffset + 30 > centralOffset || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      fail(`ZIP local header is malformed: ${name}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localName = buffer
      .subarray(localOffset + 30, localOffset + 30 + localNameLength)
      .toString("utf8");
    if (localName !== name) fail(`ZIP local/central names disagree: ${name}`);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + size;
    if (dataEnd > centralOffset) fail(`ZIP member data is truncated: ${name}`);
    const data = buffer.subarray(dataStart, dataEnd);
    if (crc32(data) !== checksum) fail(`ZIP member CRC does not match: ${name}`);
    entries.push({ name, buffer: data });
    cursor = recordEnd;
  }
  if (cursor !== endOffset) fail("ZIP contains undeclared central-directory bytes");
  if (new Set(entries.map((entry) => entry.name)).size !== entries.length) {
    fail("ZIP contains duplicate members");
  }
  return entries;
}

function validateZipBuffer(zipBuffer, expectedEntries) {
  const parsed = parseZip(zipBuffer).sort(compareArchiveNames);
  const expected = [...expectedEntries].sort(compareArchiveNames);
  if (parsed.length !== expected.length) fail("ZIP member count differs from the explicit manifest");
  for (let index = 0; index < expected.length; index += 1) {
    if (parsed[index].name !== expected[index].name) {
      fail("ZIP contains an undeclared or missing member");
    }
    if (sha256(parsed[index].buffer) !== sha256(expected[index].buffer)) {
      fail(`ZIP member hash differs from the declared source: ${expected[index].name}`);
    }
  }
  const deterministic = buildDeterministicZip(expected);
  if (!zipBuffer.equals(deterministic)) fail("ZIP bytes are not the canonical deterministic encoding");
}

function expectedDirectories(entries) {
  const directories = new Set();
  for (const entry of entries) {
    let current = posix.dirname(entry.name);
    while (current !== ".") {
      directories.add(current);
      current = posix.dirname(current);
    }
  }
  return directories;
}

async function walkStage(root, current = root, files = [], directories = []) {
  for (const item of await readdir(current, { withFileTypes: true })) {
    const absolute = join(current, item.name);
    const stats = await lstat(absolute);
    const archiveName = relative(root, absolute).split(sep).join("/");
    normalizeRelativePath(archiveName, "staging member");
    if (stats.isSymbolicLink()) fail(`staging symlink is rejected: ${archiveName}`);
    if (stats.isDirectory()) {
      directories.push(archiveName);
      await walkStage(root, absolute, files, directories);
    } else if (stats.isFile()) {
      files.push({ name: archiveName, absolute });
    } else {
      fail(`staging non-regular member is rejected: ${archiveName}`);
    }
  }
  return { files, directories };
}

async function validateStaging(stageArg, expectedEntries) {
  const stage = resolve(stageArg);
  let stats;
  try {
    stats = await lstat(stage);
  } catch {
    fail("staging directory does not exist");
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("staging path must be a real directory, not a symlink");
  }
  const root = await realpath(stage);
  const walked = await walkStage(root);
  const expected = new Map(expectedEntries.map((entry) => [entry.name, entry.buffer]));
  const expectedDirs = expectedDirectories(expectedEntries);
  for (const directory of walked.directories) {
    if (!expectedDirs.has(directory)) fail(`staging contains undeclared directory: ${directory}`);
  }
  if (walked.files.length !== expected.size) fail("staging member count differs from the explicit manifest");
  for (const file of walked.files) {
    const expectedBuffer = expected.get(file.name);
    if (!expectedBuffer) fail(`staging contains undeclared member: ${file.name}`);
    const actual = await readFile(file.absolute);
    if (sha256(actual) !== sha256(expectedBuffer)) {
      fail(`staging member hash differs from the declared source: ${file.name}`);
    }
  }
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeStage(stageArg, entries) {
  const stage = resolve(stageArg);
  if (await pathExists(stage)) fail("--out already exists; refusing to overwrite it");
  await mkdir(dirname(stage), { recursive: true });
  try {
    await mkdir(stage, { recursive: false, mode: 0o755 });
  } catch (error) {
    if (error && error.code === "EEXIST") fail("--out already exists; refusing to overwrite it");
    throw error;
  }
  for (const entry of entries) {
    const destination = join(stage, ...entry.name.split("/"));
    if (!isWithin(stage, destination)) fail("output member escaped the staging directory");
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, entry.buffer, { flag: "wx", mode: 0o644 });
  }
  await validateStaging(stage, entries);
}

async function writeZip(zipArg, zipBuffer, stageArg) {
  const zipPath = resolve(zipArg);
  if (stageArg && isWithin(resolve(stageArg), zipPath)) fail("--zip must remain outside --out");
  if (await pathExists(zipPath)) fail("--zip already exists; refusing to overwrite it");
  await mkdir(dirname(zipPath), { recursive: true });
  await writeFile(zipPath, zipBuffer, { flag: "wx", mode: 0o644 });
}

function parseArguments(argv) {
  if (argv.length === 0) return { mode: "help" };
  let mode;
  let index = 0;
  if (argv[0] === "build" || argv[0] === "validate" || argv[0] === "self-test") {
    mode = argv[0];
    index = 1;
  } else if (argv[0] === "--validate-only") {
    mode = "validate";
    index = 1;
  } else if (argv[0] === "--self-test") {
    mode = "self-test";
    index = 1;
  } else if (argv[0] === "--help" || argv[0] === "-h") {
    return { mode: "help" };
  } else {
    fail(`unknown mode: ${argv[0]}`);
  }

  const options = { mode, root: "." };
  const allowed = new Set(["--manifest", "--root", "--out", "--stage", "--zip"]);
  const seen = new Set();
  while (index < argv.length) {
    const key = argv[index];
    if (!allowed.has(key)) fail(`unknown option: ${key}`);
    if (seen.has(key)) fail(`${key} was supplied more than once`);
    seen.add(key);
    if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
      fail(`${key} requires a value`);
    }
    const property = key.slice(2);
    options[property] = argv[index + 1];
    index += 2;
  }
  return options;
}

function usage() {
  return `CXOS deterministic handoff utility

Build (new outputs only):
  node scripts/cxos-living-environment/handoff.mjs build \\
    --manifest handoff.json --root . --out ./handoff-stage --zip ./handoff.zip

Validate only (writes nothing):
  node scripts/cxos-living-environment/handoff.mjs validate \\
    --manifest handoff.json --root . [--stage ./handoff-stage] [--zip ./handoff.zip]
  node scripts/cxos-living-environment/handoff.mjs --validate-only \\
    --manifest handoff.json --root .

Self-test:
  node scripts/cxos-living-environment/handoff.mjs self-test

The manifest schema and safety boundary are documented at the top of this file.
`;
}

async function executePackage(options) {
  if (!options.manifest) fail("--manifest is required");
  if (options.mode === "build" && (!options.out || !options.zip)) {
    fail("build requires both --out and --zip");
  }
  if (options.mode === "build" && options.stage) fail("build uses --out, not --stage");
  if (options.mode === "validate" && options.out) fail("validate uses --stage, not --out");

  const root = await assertRegularRoot(options.root);
  const manifest = await readManifest(root, options.manifest);
  const assembled = await assembleEntries(root, manifest);
  const zipBuffer = buildDeterministicZip(assembled.entries);
  validateZipBuffer(zipBuffer, assembled.entries);

  if (options.mode === "build") {
    const stagePath = resolve(options.out);
    const zipPath = resolve(options.zip);
    if (stagePath === zipPath || isWithin(stagePath, zipPath)) {
      fail("--zip must remain outside --out");
    }
    if (await pathExists(stagePath)) fail("--out already exists; refusing to overwrite it");
    if (await pathExists(zipPath)) fail("--zip already exists; refusing to overwrite it");
    await writeStage(options.out, assembled.entries);
    await writeZip(options.zip, zipBuffer, options.out);
  } else {
    if (options.stage) await validateStaging(options.stage, assembled.entries);
    if (options.zip) {
      const zipSource = resolve(options.zip);
      const stats = await lstat(zipSource).catch(() => null);
      if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
        fail("--zip must name an existing regular file, not a symlink");
      }
      const actualZip = await readFile(zipSource);
      validateZipBuffer(actualZip, assembled.entries);
    }
  }

  return {
    ok: true,
    mode: options.mode,
    packageName: manifest.packageName,
    reportCount: manifest.reports.length,
    memberCount: assembled.entries.length,
    zipBytes: zipBuffer.length,
    zipSha256: sha256(zipBuffer),
    integrityManifest: manifest.integrityPath,
  };
}

async function expectReject(action, description) {
  try {
    await action();
  } catch (error) {
    if (error instanceof HandoffError) return;
    throw error;
  }
  fail(`self-test expected rejection: ${description}`);
}

async function selfTest() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "cxos-handoff-self-test-"));
  try {
    await mkdir(join(fixtureRoot, "reports"), { recursive: true });
    await mkdir(join(fixtureRoot, "evidence"), { recursive: true });
    const markdown = `# Isolated Fixture Report

- **Status:** FIXTURE ONLY · NO RELEASE AUTHORITY

## Summary

This synthetic fixture validates a deterministic offline handoff.

| Control | Result |
|---|---|
| Network | None |
| Effects | None |

## Code sample

\`\`\`json
{"fixture":true,"writes":0}
\`\`\`

- [x] Semantic heading
- [ ] Founder decision remains separate
`;
    await writeFile(join(fixtureRoot, "reports", "fixture.md"), markdown, "utf8");
    await writeFile(
      join(fixtureRoot, "evidence", "fixture.json"),
      `${JSON.stringify({ synthetic: true, networkWrites: 0 }, null, 2)}\n`,
      "utf8",
    );
    const manifest = {
      version: 1,
      packageName: "cxos-handoff-fixture",
      reports: [{ source: "reports/fixture.md", html: "reports/fixture.html" }],
      files: [
        { source: "reports/fixture.md", archive: "reports/fixture.md" },
        { source: "evidence/fixture.json", archive: "evidence/fixture.json" },
      ],
      integrity: { path: "SHA256SUMS.json" },
    };
    await writeFile(
      join(fixtureRoot, "handoff.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    const stage = join(fixtureRoot, "stage");
    const zip = join(fixtureRoot, "fixture.zip");
    const build = await executePackage({
      mode: "build",
      root: fixtureRoot,
      manifest: "handoff.json",
      out: stage,
      zip,
    });
    const validation = await executePackage({
      mode: "validate",
      root: fixtureRoot,
      manifest: "handoff.json",
      stage,
      zip,
    });
    if (build.zipSha256 !== validation.zipSha256) fail("self-test deterministic ZIP hashes disagree");

    const html = await readFile(join(stage, "reports", "fixture.html"), "utf8");
    if (
      !/<textarea readonly\b/.test(html) ||
      !/<table>/.test(html) ||
      !/<pre><code class="language-json">/.test(html) ||
      /<script\b/i.test(html)
    ) {
      fail("self-test generated HTML contract failed");
    }

    const root = await assertRegularRoot(fixtureRoot);
    const loadedManifest = await readManifest(root, "handoff.json");
    const assembled = await assembleEntries(root, loadedManifest);
    const maliciousZip = buildDeterministicZip([
      ...assembled.entries,
      { name: "undeclared.txt", buffer: Buffer.from("extra\n"), origin: "self-test" },
    ]);
    await expectReject(
      () => Promise.resolve(validateZipBuffer(maliciousZip, assembled.entries)),
      "undeclared ZIP member",
    );

    await writeFile(join(stage, "undeclared.txt"), "extra\n", "utf8");
    await expectReject(() => validateStaging(stage, assembled.entries), "undeclared staging member");

    await writeFile(join(fixtureRoot, "evidence", "real.txt"), "safe\n", "utf8");
    await symlink("real.txt", join(fixtureRoot, "evidence", "linked.txt"));
    await expectReject(
      () => resolveDeclaredFile(root, "evidence/linked.txt", "self-test symlink"),
      "source symlink",
    );

    await expectReject(
      () =>
        Promise.resolve(
          scanSensitiveContent(
            "self-test secret",
            Buffer.from(`token=${["sk", "live", "syntheticcredential1234"].join("_")}`),
            loadedManifest.policy,
          ),
        ),
      "credential pattern",
    );
    await expectReject(
      () =>
        Promise.resolve(
          scanSensitiveContent(
            "self-test local path",
            Buffer.from(["", "Users", "synthetic", "private", "report.json"].join("/")),
            loadedManifest.policy,
          ),
      ),
      "local absolute path",
    );
    await expectReject(
      () =>
        Promise.resolve(
          scanSensitiveContent(
            "self-test customer marker",
            Buffer.from(`{"${["customer", "Name"].join("")}":"Synthetic Person"}`),
            loadedManifest.policy,
          ),
        ),
      "customer data marker",
    );
    await expectReject(
      () =>
        Promise.resolve(
          scanSensitiveContent(
            "self-test deployment metadata",
            Buffer.from(["private-candidate", "vercel", "app"].join(".")),
            loadedManifest.policy,
          ),
        ),
      "private deployment metadata",
    );

    return {
      ok: true,
      fixture: "temporary-only",
      reports: 1,
      deterministicZipSha256: build.zipSha256,
      negativeControls: 7,
    };
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "help") {
    process.stdout.write(usage());
    return;
  }
  const result = options.mode === "self-test" ? await selfTest() : await executePackage(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof HandoffError ? error.message : "unexpected handoff utility failure";
  process.stderr.write(`handoff: ${message}\n`);
  process.exitCode = 1;
});
