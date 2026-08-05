// Generate the four standalone Growth Network HTML companions from canonical Markdown.
//
// Run:   node --import tsx scripts/render-growth-network-docs.ts
// Check: node --import tsx scripts/render-growth-network-docs.ts --check
//
// This renderer is intentionally dependency-free and scoped to the Markdown constructs
// used by the four authored reports. The HTML is a reading artifact; Markdown is truth.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const ROOT = join(__dirname, "..");
const DOCUMENTS = [
  "GROWTH_NETWORK_FOUNDATION.md",
  "GROWTH_NETWORK_ARCHITECTURE.md",
  "GROWTH_NETWORK_ROADMAP.md",
  "GROWTH_NETWORK_PRODUCT_SPEC.md",
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slug(value: string, used: Map<string, number>): string {
  const base = value
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function inline(raw: string): string {
  const code: string[] = [];
  let value = raw.replace(/`([^`]+)`/g, (_match, body: string) => {
    code.push(`<code>${escapeHtml(body)}</code>`);
    return `\u0000CODE${code.length - 1}\u0000`;
  });
  value = escapeHtml(value);
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const rawHref = href.trim();
    const safeHref = DOCUMENTS.reduce(
      (current, source) => current.replace(new RegExp(`^${source.replace(".", "\\.")}(?=($|#))`), source.replace(/\.md$/, ".html")),
      rawHref,
    );
    const external = /^https?:\/\//i.test(safeHref);
    return `<a href="${escapeHtml(safeHref)}"${external ? ' rel="noreferrer"' : ""}>${label}</a>`;
  });
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  value = value.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => code[Number(index)] ?? "");
  return value;
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(" ", "")));
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

function renderMarkdown(markdown: string): { body: string; headings: Heading[] } {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let index = 0;

  const isSpecial = (line: string, next = ""): boolean =>
    /^#{1,6}\s+/.test(line) || /^```/.test(line) || /^>\s?/.test(line) ||
    /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) ||
    /^\s*---+\s*$/.test(line) || (line.includes("|") && isTableDivider(next));

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slug(text, used);
      headings.push({ level, text: text.replace(/[*`]/g, ""), id });
      html.push(`<h${level} id="${id}">${inline(text)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`);
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${body.map((part) => inline(part)).join("<br>")}</blockquote>`);
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      html.push("<div class=\"table-wrap\"><table><thead><tr>" + headers.map((cell) => `<th scope="col">${inline(cell)}</th>`).join("") + "</tr></thead><tbody>" + rows.map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${inline(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("") + "</tbody></table></div>");
      continue;
    }

    const unordered = /^\s*[-*]\s+/.test(line);
    const ordered = /^\s*\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const tag = ordered ? "ol" : "ul";
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(lines[index].replace(pattern, ""));
        index += 1;
      }
      html.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`);
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isSpecial(lines[index], lines[index + 1] ?? "")) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return { body: html.join("\n"), headings };
}

const STYLE = `
:root{color-scheme:light dark;--paper:#f7f3e9;--ink:#17201e;--muted:#56615d;--line:#cbc3ae;--gold:#9b6b18;--panel:#fffdf7;--code:#ece5d5;--max:78rem}
@media(prefers-color-scheme:dark){:root{--paper:#111614;--ink:#eef0e9;--muted:#aeb8b2;--line:#3b4540;--gold:#ddb65b;--panel:#171e1b;--code:#202925}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.62 ui-serif,Georgia,Cambria,"Times New Roman",serif}a{color:var(--gold);text-underline-offset:.18em}a:hover{text-decoration-thickness:.14em}.skip{position:absolute;left:1rem;top:-5rem;background:var(--ink);color:var(--paper);padding:.65rem 1rem;z-index:10}.skip:focus{top:1rem}.mast{border-bottom:1px solid var(--line);background:var(--panel)}.mast-inner{max-width:var(--max);margin:auto;padding:1.1rem clamp(1rem,3vw,2rem);display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}.brand{font:700 .86rem/1 ui-sans-serif,system-ui;letter-spacing:.14em;text-transform:uppercase}.docnav{display:flex;gap:.85rem;flex-wrap:wrap;font:600 .82rem/1.2 ui-sans-serif,system-ui}.layout{max-width:var(--max);margin:auto;display:grid;grid-template-columns:minmax(13rem,18rem) minmax(0,1fr);gap:clamp(1.5rem,4vw,4rem);padding:clamp(1.5rem,4vw,3.5rem) clamp(1rem,3vw,2rem)}.toc{position:sticky;top:1rem;align-self:start;max-height:calc(100vh - 2rem);overflow:auto;border-right:1px solid var(--line);padding-right:1.2rem;font:500 .82rem/1.4 ui-sans-serif,system-ui}.toc h2{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;margin:.15rem 0 .65rem}.toc ol{list-style:none;padding:0;margin:0}.toc li{margin:.34rem 0}.toc .l3{padding-left:.9rem}.document{min-width:0}.artifact{border:1px solid var(--line);background:var(--panel);padding:.75rem 1rem;margin:0 0 2rem;font:600 .82rem/1.45 ui-sans-serif,system-ui;color:var(--muted)}h1,h2,h3,h4{font-family:ui-sans-serif,system-ui;line-height:1.16;letter-spacing:-.025em}h1{font-size:clamp(2.2rem,6vw,4.6rem);max-width:18ch;margin:.2rem 0 1.3rem}h2{font-size:clamp(1.45rem,3vw,2.1rem);margin:3.4rem 0 1rem;padding-top:.45rem;border-top:1px solid var(--line)}h3{font-size:1.22rem;margin:2.2rem 0 .8rem}h4{font-size:1rem;margin:1.7rem 0 .6rem}.anchor{opacity:0;margin-left:.35rem;text-decoration:none;font-weight:400}.document :is(h1,h2,h3,h4):hover .anchor,.anchor:focus{opacity:1}p,li{max-width:76ch}blockquote{margin:1.5rem 0;padding:.85rem 1.15rem;border-left:.28rem solid var(--gold);background:var(--panel);font-style:normal}code{font: .88em/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);padding:.08em .3em;border-radius:.2rem}pre{overflow:auto;background:var(--code);border:1px solid var(--line);padding:1rem;border-radius:.25rem}pre code{padding:0;background:none}.table-wrap{overflow:auto;margin:1.3rem 0;border:1px solid var(--line)}table{border-collapse:collapse;width:100%;font: .9rem/1.45 ui-sans-serif,system-ui;background:var(--panel)}th,td{text-align:left;vertical-align:top;padding:.72rem .8rem;border-bottom:1px solid var(--line)}th{font-size:.76rem;letter-spacing:.04em;text-transform:uppercase;background:var(--code)}tr:last-child td{border-bottom:0}hr{border:0;border-top:1px solid var(--line);margin:2.5rem 0}.foot{max-width:var(--max);margin:auto;border-top:1px solid var(--line);padding:1.2rem clamp(1rem,3vw,2rem) 3rem;color:var(--muted);font: .78rem/1.5 ui-sans-serif,system-ui;overflow-wrap:anywhere}:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
@media(max-width:800px){.layout{display:block}.toc{position:static;max-height:none;border:1px solid var(--line);padding:1rem;margin-bottom:2rem}.toc .l3{display:none}.mast-inner{align-items:flex-start}.docnav{line-height:1.6}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{.mast,.toc,.skip,.anchor{display:none}.layout{display:block;max-width:none;padding:0}.artifact{border:1px solid #999}body{background:#fff;color:#000;font-size:11pt}a{color:#000}.table-wrap{overflow:visible}h2{break-after:avoid}table,pre,blockquote{break-inside:avoid}}
`;

function buildDocument(sourceName: string, markdown: string): string {
  const sourceHash = createHash("sha256").update(markdown).digest("hex");
  const { body, headings } = renderMarkdown(markdown);
  const title = headings.find((heading) => heading.level === 1)?.text ?? sourceName;
  const toc = headings.filter((heading) => heading.level === 2 || heading.level === 3)
    .map((heading) => `<li class="l${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`)
    .join("");
  const nav = DOCUMENTS.map((name) => `<a href="${name.replace(/\.md$/, ".html")}">${escapeHtml(name.replace(/^GROWTH_NETWORK_|\.md$/g, "").replaceAll("_", " "))}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="generator" content="CreditVector Growth Network deterministic documentation renderer">
  <meta name="source-sha256" content="${sourceHash}">
  <title>${escapeHtml(title)} · Gabriel Capital Labs</title>
  <style>${STYLE}</style>
</head>
<body>
  <a class="skip" href="#document">Skip to document</a>
  <header class="mast"><div class="mast-inner"><div class="brand">Gabriel Capital Labs · CreditVector™</div><nav class="docnav" aria-label="Growth Network documents">${nav}</nav></div></header>
  <div class="layout">
    <nav class="toc" aria-label="On this page"><h2>On this page</h2><ol>${toc}</ol></nav>
    <main class="document" id="document"><div class="artifact">Standalone reading artifact generated from <a href="${sourceName}">${sourceName}</a>. Markdown is canonical. Source SHA-256: <code>${sourceHash}</code>.</div>${body}</main>
  </div>
  <footer class="foot">CreditVector Growth Network foundation · generated 2026-07-31 · source ${basename(sourceName)} · SHA-256 ${sourceHash} · no external assets, scripts, analytics, or network dependencies.</footer>
</body>
</html>\n`;
}

function validateStandalone(outputPath: string, output: string): void {
  const errors: string[] = [];
  if (!output.startsWith("<!doctype html>")) errors.push("missing doctype");
  if (/<script\b/i.test(output)) errors.push("script element present");
  if (/<link\b[^>]*rel=["']stylesheet/i.test(output)) errors.push("external stylesheet present");
  if (/\ssrc=["']/i.test(output)) errors.push("external source attribute present");

  const ids = new Set([...output.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of output.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith("#")) {
      if (!ids.has(href.slice(1))) errors.push(`missing anchor ${href}`);
      continue;
    }
    if (/^(https?:|mailto:)/i.test(href)) continue;
    const target = href.split("#")[0];
    if (target && !existsSync(resolve(dirname(outputPath), target))) errors.push(`missing local target ${target}`);
  }

  if (errors.length > 0) throw new Error(`${basename(outputPath)} is not standalone-valid: ${errors.join("; ")}`);
}

let mismatch = false;
for (const sourceName of DOCUMENTS) {
  const sourcePath = join(ROOT, sourceName);
  const outputPath = sourcePath.replace(/\.md$/, ".html");
  const output = buildDocument(sourceName, readFileSync(sourcePath, "utf8"));
  validateStandalone(outputPath, output);
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(outputPath, "utf8"); } catch { /* reported as mismatch */ }
    if (current !== output) {
      mismatch = true;
      console.error(`STALE: ${basename(outputPath)}`);
    } else {
      console.log(`CURRENT: ${basename(outputPath)}`);
    }
  } else {
    writeFileSync(outputPath, output, "utf8");
    console.log(`WROTE: ${basename(outputPath)}`);
  }
}

if (mismatch) process.exit(1);
