import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const REPORT_SOURCES = [
  "CREDITVECTOR_BETA_RELEASE_CRITERIA_RC1.md",
  "CREDITVECTOR_BETA_FEATURE_MATRIX.md",
  "CREDITVECTOR_BETA_BLOCKER_BACKLOG.md",
  "CREDITVECTOR_BETA_EXECUTION_REPORT.md",
] as const;

const HANDOFF_SOURCE = "CREDITVECTOR_BETA_FOUNDER_HANDOFF.txt";
const ROOT = process.cwd();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(value: string): string | null {
  const href = value.trim();
  return /^(?:https?:\/\/|#)/i.test(href) ? href : null;
}

function renderInline(source: string): string {
  const codeSpans: string[] = [];
  let rendered = source.replace(/`([^`]+)`/g, (_match, code: string) => {
    const index = codeSpans.push(`<code>${escapeHtml(code)}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  rendered = escapeHtml(rendered);
  rendered = rendered.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
    (_match, label: string, rawHref: string) => {
      const href = safeHref(rawHref.replaceAll("&amp;", "&"));
      if (!href) return `${label} (${rawHref})`;
      const external = /^https?:\/\//i.test(href);
      const attributes = external ? ' target="_blank" rel="noreferrer noopener"' : "";
      return `<a href="${escapeHtml(href)}"${attributes}>${label}</a>`;
    },
  );
  rendered = rendered
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return rendered.replace(/\u0000CODE(\d+)\u0000/g, (_match, rawIndex: string) => {
    return codeSpans[Number(rawIndex)] ?? "";
  });
}

function plainHeading(source: string): string {
  return source
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

function slugify(source: string): string {
  const slug = plainHeading(source)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

function splitTableRow(line: string): string[] {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  let escaped = false;

  for (const character of source) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      current += character;
      continue;
    }
    if (character === "`") inCode = !inCode;
    if (character === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isStructuralLine(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return (
    line.trim() === "" ||
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line.trim()) ||
    /^>\s?/.test(line) ||
    /^\s*[-+*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    (line.includes("|") && isTableDivider(next))
  );
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const output: string[] = [];
  const headingCounts = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = line.trim().match(/^```([^\s`]*)\s*$/);
    if (fence) {
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test((lines[index] ?? "").trim())) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(`<pre><code${language}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const baseSlug = slugify(heading[2]);
      const count = headingCounts.get(baseSlug) ?? 0;
      headingCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
      output.push(`<h${level} id="${id}">${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim() !== "") {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }
      output.push('<div class="table-wrap" role="region" aria-label="Scrollable data table" tabindex="0"><table>');
      output.push(`<thead><tr>${headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("")}</tr></thead>`);
      output.push("<tbody>");
      for (const row of rows) {
        output.push(
          `<tr>${headers
            .map((_header, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "")}</td>`)
            .join("")}</tr>`,
        );
      }
      output.push("</tbody></table></div>");
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote><p>${renderInline(quoteLines.join(" "))}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const matcher = orderedList ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? "").match(matcher);
        if (!item) break;
        let body = item[1];
        const continuation: string[] = [];
        index += 1;
        while (
          index < lines.length &&
          (lines[index] ?? "").trim() !== "" &&
          !/^\s*[-+*]\s+/.test(lines[index] ?? "") &&
          !/^\s*\d+[.)]\s+/.test(lines[index] ?? "") &&
          !isStructuralLine(lines, index)
        ) {
          continuation.push((lines[index] ?? "").trim());
          index += 1;
        }
        if (continuation.length > 0) body += ` ${continuation.join(" ")}`;
        const checkbox = body.match(/^\[([ xX])\]\s+(.+)$/);
        if (checkbox) {
          const checked = checkbox[1].toLowerCase() === "x";
          items.push(
            `<li class="task-item"><input type="checkbox" disabled${checked ? " checked" : ""} aria-label="${
              checked ? "Completed" : "Not completed"
            }"> <span>${renderInline(checkbox[2])}</span></li>`,
          );
        } else {
          items.push(`<li>${renderInline(body)}</li>`);
        }
      }
      const tag = orderedList ? "ol" : "ul";
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !isStructuralLine(lines, index)) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    if (paragraph.length > 0) {
      output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      continue;
    }

    // Defensive progress for an unsupported construct.
    output.push(`<p>${renderInline(line.trim())}</p>`);
    index += 1;
  }

  return output.join("\n");
}

function titleFromMarkdown(markdown: string, sourceName: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1];
  if (heading) return plainHeading(heading);
  return basename(sourceName, ".md").replaceAll("_", " ");
}

const SHARED_CSS = `
:root {
  color-scheme: dark;
  --bg: #071014;
  --surface: #0c181e;
  --surface-strong: #102229;
  --text: #ecf8f8;
  --muted: #9bb1b6;
  --line: #27434b;
  --accent: #55e6de;
  --accent-soft: rgba(85, 230, 222, 0.12);
  --warning: #ffd27d;
  --danger: #ff9e9e;
  --shadow: 0 22px 70px rgba(0, 0, 0, 0.34);
}
* { box-sizing: border-box; }
html { background: var(--bg); scroll-behavior: smooth; }
body {
  margin: 0;
  min-width: 0;
  background:
    radial-gradient(circle at 12% 0%, rgba(85, 230, 222, 0.11), transparent 30rem),
    linear-gradient(180deg, #081318 0%, var(--bg) 38rem);
  color: var(--text);
  font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  text-rendering: optimizeLegibility;
}
a { color: var(--accent); text-underline-offset: 0.18em; overflow-wrap: anywhere; }
a:hover { text-decoration-thickness: 0.14em; }
a:focus-visible, button:focus-visible, [tabindex="0"]:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}
.shell { width: min(100% - 2rem, 1180px); margin: 0 auto; padding: 2.25rem 0 5rem; }
.masthead {
  margin-bottom: 1.25rem;
  padding: 1.15rem 1.35rem;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(12, 24, 30, 0.88);
  box-shadow: var(--shadow);
}
.eyebrow { margin: 0; color: var(--accent); font-size: 0.76rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
.masthead p:last-child { margin-bottom: 0; color: var(--muted); }
.status-badge {
  display: inline-flex;
  margin: 0.7rem 0 0;
  padding: 0.28rem 0.62rem;
  border: 1px solid rgba(255, 158, 158, 0.58);
  border-radius: 999px;
  background: rgba(255, 158, 158, 0.1);
  color: #ffd1d1 !important;
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}
main {
  min-width: 0;
  padding: clamp(1.15rem, 3.5vw, 3rem);
  border: 1px solid var(--line);
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(16, 34, 41, 0.96), rgba(8, 19, 24, 0.98));
  box-shadow: var(--shadow);
}
h1, h2, h3, h4, h5, h6 { line-height: 1.18; letter-spacing: -0.018em; text-wrap: balance; scroll-margin-top: 1rem; }
h1 { margin: 0 0 1.4rem; font-size: clamp(2rem, 6vw, 4.1rem); }
h2 { margin: 3rem 0 1rem; padding-top: 1rem; border-top: 1px solid var(--line); font-size: clamp(1.45rem, 3vw, 2.3rem); }
h3 { margin: 2rem 0 0.7rem; color: #c9fbf7; font-size: clamp(1.16rem, 2vw, 1.55rem); }
h4, h5, h6 { margin: 1.5rem 0 0.5rem; }
p, li { max-width: 82ch; }
p { margin: 0.7rem 0 1rem; }
ul, ol { margin: 0.75rem 0 1.25rem; padding-left: 1.35rem; }
li { margin: 0.35rem 0; padding-left: 0.25rem; }
.task-item { list-style: none; margin-left: -1.3rem; display: flex; gap: 0.55rem; align-items: baseline; }
.task-item input { accent-color: var(--accent); }
strong { color: #fff; }
code {
  padding: 0.12em 0.36em;
  border: 1px solid rgba(85, 230, 222, 0.22);
  border-radius: 0.38rem;
  background: rgba(0, 0, 0, 0.28);
  color: #bdfbf6;
  font: 0.9em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}
pre {
  max-width: 100%;
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #050b0e;
  color: #dcf7f5;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
pre code { padding: 0; border: 0; background: transparent; color: inherit; }
blockquote { margin: 1.25rem 0; padding: 0.7rem 1rem; border-left: 4px solid var(--accent); background: var(--accent-soft); color: #d5efed; }
blockquote p { margin: 0; }
hr { margin: 2.3rem 0; border: 0; border-top: 1px solid var(--line); }
.table-wrap { max-width: 100%; margin: 1rem 0 1.75rem; overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; }
table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 0.8rem 0.85rem; border-bottom: 1px solid var(--line); border-right: 1px solid rgba(39, 67, 75, 0.65); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { position: sticky; top: 0; z-index: 1; background: #12262d; color: #d8fffb; font-size: 0.76rem; letter-spacing: 0.055em; text-transform: uppercase; }
tr:nth-child(even) td { background: rgba(255, 255, 255, 0.018); }
tr:last-child td { border-bottom: 0; }
th:last-child, td:last-child { border-right: 0; }
.handoff-actions { display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center; margin: 1.4rem 0 1rem; }
button {
  min-height: 44px;
  padding: 0.7rem 1rem;
  border: 1px solid #82fff7;
  border-radius: 999px;
  background: var(--accent);
  color: #03211f;
  font: inherit;
  font-weight: 850;
  cursor: pointer;
}
button:hover { filter: brightness(1.08); }
.copy-status { min-height: 1.65em; margin: 0; color: var(--muted); font-weight: 700; }
.fallback { color: var(--muted); font-size: 0.93rem; }
.handoff-text { max-height: none; margin-top: 1rem; white-space: pre-wrap; user-select: text; -webkit-user-select: text; }
footer { padding: 1.2rem 0; color: var(--muted); font-size: 0.82rem; text-align: center; }
@media (max-width: 620px) {
  .shell { width: min(100% - 1rem, 1180px); padding-top: 0.5rem; }
  .masthead, main { border-radius: 14px; }
  .masthead { padding: 0.9rem 1rem; }
  main { padding: 1rem; }
  h1 { font-size: clamp(1.75rem, 10vw, 2.6rem); overflow-wrap: anywhere; }
  h2 { margin-top: 2.2rem; }
  th, td { padding: 0.65rem; }
  .handoff-actions { align-items: stretch; }
  .handoff-actions button { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
@media print {
  :root { color-scheme: light; --bg: #fff; --surface: #fff; --surface-strong: #fff; --text: #111; --muted: #444; --line: #bbb; --accent: #006d68; }
  body { background: #fff; color: #111; }
  .shell { width: 100%; padding: 0; }
  .masthead, main { border: 0; box-shadow: none; background: #fff; }
  .masthead { padding: 0 0 0.5rem; }
  main { padding: 0; }
  .handoff-actions { display: none; }
  .table-wrap { overflow: visible; }
  table { min-width: 0; font-size: 8pt; }
  a { color: #111; }
}
`;

function standaloneDocument(options: { title: string; body: string; description: string; script?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="description" content="${escapeHtml(options.description)}">
  <title>${escapeHtml(options.title)}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="shell">
    <header class="masthead">
      <p class="eyebrow">CreditVector Beta Readiness · Founder Review Artifact</p>
      <p>Standalone, sanitized, and network-independent. This artifact does not grant production approval.</p>
      <p class="status-badge">No-Go · External Beta Blocked</p>
    </header>
    ${options.body}
    <footer>CreditVector by Gabriel Capital Labs · Review artifact</footer>
  </div>${options.script ? `\n  <script>${options.script}</script>` : ""}
</body>
</html>
`;
}

function renderReport(sourceName: string): void {
  const sourcePath = resolve(ROOT, sourceName);
  const markdown = readFileSync(sourcePath, "utf8");
  const title = titleFromMarkdown(markdown, sourceName);
  const body = `<main id="main-content"><article aria-labelledby="document-title">${markdownToHtml(markdown).replace(
    /<h1 id="([^"]+)">/,
    '<h1 id="document-title">',
  )}</article></main>`;
  const outputName = sourceName.replace(/\.md$/i, ".html");
  writeFileSync(
    resolve(ROOT, outputName),
    standaloneDocument({
      title,
      body,
      description: `${title}. CreditVector beta release-readiness review artifact.`,
    }),
    "utf8",
  );
  process.stdout.write(`Rendered ${outputName}\n`);
}

function renderHandoff(): void {
  const sourcePath = resolve(ROOT, HANDOFF_SOURCE);
  const handoff = readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const title = "CreditVector Beta Founder Handoff";
  const body = `<main id="main-content">
      <article aria-labelledby="document-title">
        <h1 id="document-title">${title}</h1>
        <p>This page contains the complete plain-text Founder handoff. Use the button once to copy the full text.</p>
        <div class="handoff-actions">
          <button id="copy-handoff" type="button">Copy complete handoff</button>
          <p id="copy-status" class="copy-status" role="status" aria-live="polite"></p>
        </div>
        <p class="fallback">If browser clipboard access is blocked—common when opening a downloaded file directly—the handoff will be selected. Choose Copy from the browser or device menu.</p>
        <pre id="handoff-text" class="handoff-text" tabindex="0" aria-label="Complete plain-text Founder handoff">${escapeHtml(
          handoff,
        )}</pre>
      </article>
    </main>`;
  const script = `
(() => {
  "use strict";
  const button = document.getElementById("copy-handoff");
  const source = document.getElementById("handoff-text");
  const status = document.getElementById("copy-status");
  if (!button || !source || !status) return;

  const selectHandoff = () => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(source);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  button.addEventListener("click", async () => {
    const text = source.textContent || "";
    status.textContent = "Copying…";
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = "Complete handoff copied.";
        return;
      } catch {
        // File-backed pages may deny the async Clipboard API; use the explicit fallback below.
      }
    }

    selectHandoff();
    let copied = false;
    try {
      copied = typeof document.execCommand === "function" && document.execCommand("copy");
    } catch {
      copied = false;
    }
    status.textContent = copied
      ? "Complete handoff copied using the browser fallback."
      : "Clipboard access was blocked. The full handoff is selected; choose Copy from the browser or device menu.";
  });
})();`;

  writeFileSync(
    resolve(ROOT, HANDOFF_SOURCE.replace(/\.txt$/i, ".html")),
    standaloneDocument({
      title,
      body,
      description: "Complete copy-and-paste CreditVector beta Founder handoff.",
      script,
    }),
    "utf8",
  );
  process.stdout.write("Rendered CREDITVECTOR_BETA_FOUNDER_HANDOFF.html\n");
}

const requiredSources = [...REPORT_SOURCES, HANDOFF_SOURCE];
const missingSources = requiredSources.filter((source) => !existsSync(resolve(ROOT, source)));

if (missingSources.length > 0) {
  process.stderr.write(`Cannot render beta-readiness artifacts. Missing:\n${missingSources.map((source) => `- ${source}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  for (const source of REPORT_SOURCES) renderReport(source);
  renderHandoff();
}
