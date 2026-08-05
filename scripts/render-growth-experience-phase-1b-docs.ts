// Generate standalone mobile-friendly HTML companions for the canonical
// Growth Experience Phase 1B Founder-review reports.
//
// Run:   node --import tsx scripts/render-growth-experience-phase-1b-docs.ts
// Check: node --import tsx scripts/render-growth-experience-phase-1b-docs.ts --check
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = join(__dirname, "..");
const DOCUMENTS = [
  "GROWTH_EXPERIENCE_PHASE_1B_CAPABILITY_CONTRACT.md",
  "GROWTH_EXPERIENCE_PHASE_1B_ARCHITECTURE.md",
  "GROWTH_EXPERIENCE_PHASE_1B_PRODUCT_SPEC.md",
  "GROWTH_EXPERIENCE_PHASE_1B_FOUNDER_HANDOFF.md",
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inline(raw: string): string {
  const code: string[] = [];
  let value = raw.replace(/`([^`]+)`/g, (_match, body: string) => {
    code.push(`<code>${escapeHtml(body)}</code>`);
    return `\u0000CODE${code.length - 1}\u0000`;
  });
  value = escapeHtml(value);
  value = value.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, href: string) => {
      const clean = href.trim();
      const local = DOCUMENTS.includes(clean.split("#")[0] as (typeof DOCUMENTS)[number])
        ? clean.replace(/\.md(?=($|#))/, ".html")
        : clean;
      return `<a href="${escapeHtml(local)}">${label}</a>`;
    },
  );
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return value.replace(
    /\u0000CODE(\d+)\u0000/g,
    (_match, index: string) => code[Number(index)] ?? "",
  );
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

function headingId(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[*`]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function renderListItem(item: string): string {
  const task = /^\[([ xX])\]\s+(.+)$/.exec(item);
  if (!task) return `<li>${inline(item)}</li>`;
  const checked = task[1].toLowerCase() === "x";
  return `<li class="task"><input type="checkbox" disabled${checked ? " checked" : ""} aria-label="${checked ? "Completed" : "Pending"}"><span>${inline(task[2])}</span></li>`;
}

function renderMarkdown(markdown: string): { body: string; headings: Heading[] } {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let index = 0;

  const special = (line: string, next = "") =>
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*---+\s*$/.test(line) ||
    (line.includes("|") && isTableDivider(next));

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = headingId(text, used);
      headings.push({ level, text: text.replace(/[*`]/g, ""), id });
      output.push(`<h${level} id="${id}">${inline(text)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`);
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
      output.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        parts.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${parts.map(inline).join("<br>")}</blockquote>`);
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      output.push(`<div class="table-wrap" role="region" aria-label="Scrollable table" tabindex="0"><table><thead><tr>${headers.map((cell) => `<th scope="col">${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${inline(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
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
      output.push(`<${tag}${items.some((item) => /^\[[ xX]\]\s+/.test(item)) ? ' class="task-list"' : ""}>${items.map(renderListItem).join("")}</${tag}>`);
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !special(lines[index], lines[index + 1] ?? "")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return { body: output.join("\n"), headings };
}

const STYLE = `
:root{color-scheme:dark;--bg:#070b14;--panel:#0d1422;--panel2:#111b2c;--line:#293850;--text:#e7edf7;--muted:#a7b5c9;--accent:#9dd7c7;--gold:#e7c98d;--focus:#fff;--max:78rem;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--bg)}body{margin:0;background:radial-gradient(circle at 82% 0,#142c36 0,transparent 32rem),var(--bg);color:var(--text);font-size:16px;line-height:1.65;overflow-wrap:anywhere}
a{color:var(--accent);text-underline-offset:.2em}a:hover{text-decoration-thickness:2px}a:focus-visible,button:focus-visible,.table-wrap:focus-visible{outline:3px solid var(--focus);outline-offset:4px}
.skip{position:fixed;left:1rem;top:1rem;z-index:9;transform:translateY(-180%);padding:.7rem 1rem;background:var(--panel);border:1px solid var(--line);border-radius:.5rem}.skip:focus{transform:none}
.top{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line);background:rgb(7 11 20/.94);backdrop-filter:blur(14px)}.top-inner{width:min(calc(100% - 2rem),var(--max));min-height:4.5rem;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:1rem}.brand{min-width:0}.brand strong,.brand span{display:block}.brand strong{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase}.brand span{font-size:.75rem;color:var(--muted)}
.copy{min-height:44px;padding:.65rem 1rem;border:1px solid var(--line);border-radius:999px;background:var(--panel2);color:var(--text);font:inherit;font-weight:750;cursor:pointer}.copy[data-state="copied"]{border-color:var(--accent);color:var(--accent)}
.shell{width:min(calc(100% - 2rem),var(--max));margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 15rem;gap:3rem;padding:3rem 0 5rem}.content{min-width:0}.toc{position:sticky;top:6rem;align-self:start;padding-left:1.25rem;border-left:1px solid var(--line)}.toc strong{display:block;margin-bottom:.7rem;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}.toc a{display:block;padding:.28rem 0;color:var(--muted);font-size:.8rem;text-decoration:none}.toc a:hover{color:var(--text)}
h1,h2,h3,h4{line-height:1.16;letter-spacing:-.025em;scroll-margin-top:6rem}h1{max-width:20ch;margin:0 0 1.5rem;font-size:clamp(2.25rem,6vw,4.8rem)}h2{margin:4rem 0 1rem;padding-top:1rem;border-top:1px solid var(--line);font-size:clamp(1.55rem,3vw,2.3rem)}h3{margin:2.5rem 0 .75rem;font-size:1.35rem}h4{margin:2rem 0 .6rem;font-size:1.05rem;color:var(--gold)}.anchor{margin-left:.45rem;color:var(--muted);font-size:.7em;text-decoration:none;opacity:.45}h1:hover .anchor,h2:hover .anchor,h3:hover .anchor,h4:hover .anchor,.anchor:focus{opacity:1}
p,li,td,th{max-width:76ch}strong{color:#fff}code{padding:.14em .34em;border:1px solid var(--line);border-radius:.3rem;background:#0a111d;color:#bce9dd;font-size:.88em}pre{overflow:auto;padding:1rem;border:1px solid var(--line);border-radius:.65rem;background:#050913}pre code{padding:0;border:0;background:none;color:#d8e2ef}.table-wrap{overflow-x:auto;margin:1.5rem 0;border:1px solid var(--line);border-radius:.65rem}table{width:100%;border-collapse:collapse;min-width:38rem}th,td{padding:.8rem .9rem;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}th{background:var(--panel2);color:#fff;font-size:.76rem;letter-spacing:.04em}tr:last-child td{border-bottom:0}
blockquote{margin:1.5rem 0;padding:1rem 1.1rem;border-left:3px solid var(--gold);background:var(--panel);color:#dbe4f0}ul,ol{padding-left:1.35rem}li{margin:.4rem 0}.task-list{padding:0;list-style:none}.task{display:flex;gap:.65rem;align-items:flex-start}.task input{width:1.1rem;height:1.1rem;margin-top:.35rem;accent-color:var(--accent)}hr{height:1px;margin:3rem 0;border:0;background:var(--line)}
.footer{width:min(calc(100% - 2rem),var(--max));margin:auto;padding:1.25rem 0 3rem;border-top:1px solid var(--line);color:var(--muted);font-size:.75rem}.copy-source{display:none}
@media(max-width:860px){.shell{display:block;padding-top:2rem}.toc{position:static;margin-top:3rem;padding:1.2rem;border:1px solid var(--line);border-radius:.65rem;background:var(--panel)}h1{font-size:clamp(2rem,11vw,3.3rem)}}
@media(max-width:520px){.top-inner,.shell,.footer{width:min(calc(100% - 1.25rem),var(--max))}.top-inner{min-height:4rem}.brand span{display:none}.copy{padding:.55rem .75rem;font-size:.8rem}.shell{padding-bottom:3rem}h2{margin-top:3rem}.table-wrap{margin-inline:-.1rem}pre{font-size:.78rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
`;

function page(sourceName: (typeof DOCUMENTS)[number], markdown: string): string {
  const rendered = renderMarkdown(markdown);
  const title = rendered.headings[0]?.text ?? basename(sourceName, ".md");
  const hash = createHash("sha256").update(markdown).digest("hex");
  const toc = rendered.headings
    .filter((heading) => heading.level === 2 || heading.level === 3)
    .map((heading) => `<a href="#${heading.id}">${escapeHtml(heading.text)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body><a class="skip" href="#report">Skip to report</a><header class="top"><div class="top-inner"><div class="brand"><strong>CreditVector Growth Network</strong><span>Protected Founder review · standalone report</span></div><button class="copy" id="copy" type="button">Copy Markdown</button></div></header>
<div class="shell"><main class="content" id="report" tabindex="-1">${rendered.body}</main><nav class="toc" aria-label="Report contents"><strong>Contents</strong>${toc}</nav></div>
<footer class="footer">Standalone HTML · embedded CSS · no external assets · source ${escapeHtml(sourceName)} · SHA-256 ${hash}</footer>
<textarea class="copy-source" id="copy-source" aria-hidden="true" tabindex="-1">${escapeHtml(markdown)}</textarea>
<script>(()=>{const b=document.getElementById('copy');const s=document.getElementById('copy-source');if(!b||!s)return;b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(s.value);b.textContent='Copied';b.dataset.state='copied';setTimeout(()=>{b.textContent='Copy Markdown';delete b.dataset.state},1800)}catch{b.textContent='Select Markdown';s.style.display='block';s.removeAttribute('aria-hidden');s.select()}})})()</script></body></html>\n`;
}

const checkOnly = process.argv.includes("--check");
let stale = 0;
for (const sourceName of DOCUMENTS) {
  const sourcePath = join(ROOT, sourceName);
  if (!existsSync(sourcePath)) {
    console.error(`Missing canonical source: ${sourceName}`);
    stale += 1;
    continue;
  }
  const outputName = sourceName.replace(/\.md$/, ".html");
  const outputPath = join(ROOT, outputName);
  const expected = page(sourceName, readFileSync(sourcePath, "utf8"));
  if (checkOnly) {
    if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== expected) {
      console.error(`Stale or missing HTML companion: ${outputName}`);
      stale += 1;
    }
  } else {
    writeFileSync(outputPath, expected);
    console.log(`Rendered ${outputName}`);
  }
}

if (checkOnly) {
  if (stale > 0) process.exit(1);
  console.log(`Phase 1B standalone HTML companions current: ${DOCUMENTS.length}/${DOCUMENTS.length}`);
}
