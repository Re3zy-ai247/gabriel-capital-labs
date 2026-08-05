// Generate the four standalone Growth Center Foundation Preview HTML companions.
//
// Run:   node --import tsx scripts/render-growth-center-docs.ts
// Check: node --import tsx scripts/render-growth-center-docs.ts --check
//
// Markdown is canonical. This dependency-free renderer is deliberately scoped to
// the constructs used by the four Founder reports and produces deterministic HTML.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const ROOT = join(__dirname, "..");
const DOCUMENTS = [
  "GROWTH_CENTER_FOUNDATION.md",
  "GROWTH_CENTER_ARCHITECTURE.md",
  "GROWTH_CENTER_ROADMAP.md",
  "GROWTH_CENTER_FOUNDER_HANDOFF.md",
] as const;
const FINAL_METADATA = {
  previewUrl:
    "https://gabriel-capital-labs-6eb4ws7he-rey-gabriel-s-projects.vercel.app/review/growth-center",
  deploymentId: "dpl_DDYhribJTdiNCtnadYEpbZUdhVp1",
  finalValidation:
    "PASS for protected Founder Preview — typecheck, touched lint, 205/205 Growth Center guard plus regression guards, optimized Preview/production-identity builds, production HTTP 404, protected Preview SSO/authenticated HTTP 200, desktop/tablet/mobile/320px/200% text/Axe/reduced-motion checks, compliance GO, and architecture documentation condition closed. Repository-wide lint remains red only on four unrelated pre-existing files.",
  evidenceHash:
    "3fd5692270a95d7c3579d214d50e59bae02ba6aad9203c2e9353d75ebe2e8125",
} as const;
const REQUIRED_METADATA = Object.values(FINAL_METADATA);
const KNOWN_OUTPUTS = new Set(
  DOCUMENTS.map((sourceName) => sourceName.replace(/\.md$/, ".html")),
);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slug(value: string, used: Map<string, number>): string {
  const base =
    value
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function localHtmlHref(href: string): string {
  return DOCUMENTS.reduce(
    (current, sourceName) =>
      current.replace(
        new RegExp(`^${sourceName.replace(".", "\\.")}(?=($|#))`),
        sourceName.replace(/\.md$/, ".html"),
      ),
    href,
  );
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
    (_match, label: string, href: string) =>
      `<a href="${escapeHtml(localHtmlHref(href.trim()))}">${label}</a>`,
  );
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  value = value.replace(
    /\u0000CODE(\d+)\u0000/g,
    (_match, index: string) => code[Number(index)] ?? "",
  );
  return value;
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
  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(" ", "")))
  );
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

function renderListItem(item: string): string {
  const task = /^\[([ xX])\]\s+(.+)$/.exec(item);
  if (!task) return `<li>${inline(item)}</li>`;
  const checked = task[1].toLowerCase() === "x";
  return `<li class="task"><input type="checkbox" disabled${checked ? " checked" : ""} aria-label="${checked ? "Completed" : "Pending"}"><span>${inline(task[2])}</span></li>`;
}

function renderMarkdown(markdown: string): {
  body: string;
  headings: Heading[];
} {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let index = 0;

  const isSpecial = (line: string, next = ""): boolean =>
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
      const id = slug(text, used);
      headings.push({ level, text: text.replace(/[*`]/g, ""), id });
      html.push(
        `<h${level} id="${id}">${inline(text)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`,
      );
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
      html.push(
        `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`,
      );
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
      html.push(
        `<blockquote>${body.map((part) => inline(part)).join("<br>")}</blockquote>`,
      );
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (
        index < lines.length &&
        lines[index].includes("|") &&
        lines[index].trim()
      ) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      html.push(
        `<div class="table-wrap" role="region" aria-label="Scrollable table" tabindex="0"><table><thead><tr>${headers
          .map((cell) => `<th scope="col">${inline(cell)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${headers
                .map(
                  (_header, cellIndex) =>
                    `<td>${inline(row[cellIndex] ?? "")}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`,
      );
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
      const taskClass = items.some((item) => /^\[[ xX]\]\s+/.test(item))
        ? ' class="task-list"'
        : "";
      html.push(
        `<${tag}${taskClass}>${items.map(renderListItem).join("")}</${tag}>`,
      );
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isSpecial(lines[index], lines[index + 1] ?? "")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return { body: html.join("\n"), headings };
}

const STYLE = `
:root{color-scheme:dark;--bg:#07100f;--bg-2:#0b1715;--panel:#101e1b;--panel-2:#142521;--ink:#f1f7f4;--copy:#c5d2cd;--muted:#8fa39b;--line:#294039;--line-strong:#3f6258;--accent:#77d5b6;--accent-2:#d6bc72;--danger:#eeaa93;--code:#091411;--max:86rem}
@media(prefers-color-scheme:light){:root{color-scheme:light;--bg:#eef4f0;--bg-2:#e4ede8;--panel:#ffffff;--panel-2:#f5faf7;--ink:#14231f;--copy:#31453e;--muted:#5d716a;--line:#c4d5ce;--line-strong:#93b3a7;--accent:#156f58;--accent-2:#745714;--danger:#98462d;--code:#e5eee9}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 82% -10%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 34rem),linear-gradient(180deg,var(--bg),var(--bg-2));color:var(--copy);font:16px/1.68 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-wrap:anywhere}a{color:var(--accent);text-underline-offset:.2em}.skip{position:absolute;z-index:100;top:-6rem;left:1rem;padding:.7rem 1rem;border-radius:.5rem;background:var(--ink);color:var(--bg);font-weight:800}.skip:focus{top:1rem}.mast{position:relative;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 90%,transparent)}.mast-inner{width:min(calc(100% - 2rem),var(--max));margin:auto;padding:1.1rem 0;display:flex;gap:1rem;align-items:center;justify-content:space-between}.brand{display:flex;gap:.7rem;align-items:center;color:var(--ink);font-size:.75rem;font-weight:850;letter-spacing:.13em;text-transform:uppercase}.brand-mark{display:grid;width:2rem;height:2rem;place-items:center;border:1px solid var(--line-strong);border-radius:50%;color:var(--accent)}.copy-wrap{display:flex;align-items:center;gap:.7rem}.copy-button{min-height:44px;padding:.65rem 1rem;border:1px solid var(--line-strong);border-radius:999px;background:var(--panel);color:var(--ink);font:inherit;font-size:.78rem;font-weight:800;cursor:pointer}.copy-button:hover{border-color:var(--accent);background:var(--panel-2)}.copy-status{min-width:5.5rem;color:var(--muted);font-size:.72rem}.truth{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--panel) 74%,transparent)}.truth-grid{width:min(calc(100% - 2rem),var(--max));margin:auto;padding:.8rem 0;display:grid;grid-template-columns:1.15fr 1fr 1.35fr 1fr;gap:.65rem}.truth-item{min-width:0;padding:.55rem .7rem;border-left:2px solid var(--line-strong)}.truth-item span{display:block;color:var(--muted);font-size:.64rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.truth-item strong,.truth-item code{display:block;margin-top:.18rem;color:var(--ink);font-size:.73rem;line-height:1.35}.docnav{width:min(calc(100% - 2rem),var(--max));margin:auto;padding:.75rem 0;display:flex;gap:.45rem;overflow-x:auto;scrollbar-width:thin}.docnav a{display:inline-flex;min-height:44px;align-items:center;flex:0 0 auto;padding:.5rem .8rem;border:1px solid var(--line);border-radius:.45rem;color:var(--copy);font-size:.73rem;font-weight:750;text-decoration:none}.docnav a[aria-current="page"]{border-color:var(--accent);color:var(--ink);background:var(--panel-2)}.layout{width:min(calc(100% - 2rem),var(--max));margin:auto;padding:clamp(1.5rem,4vw,3.5rem) 0;display:grid;grid-template-columns:minmax(13rem,18rem) minmax(0,1fr);gap:clamp(1.5rem,4vw,4rem)}.toc{position:sticky;top:1rem;align-self:start;max-height:calc(100vh - 2rem);overflow:auto;padding:1rem;border:1px solid var(--line);border-radius:.75rem;background:color-mix(in srgb,var(--panel) 78%,transparent);font-size:.78rem;line-height:1.42}.toc summary{min-height:44px;display:flex;align-items:center;color:var(--ink);font-size:.68rem;font-weight:850;letter-spacing:.11em;text-transform:uppercase;cursor:pointer}.toc ol{padding:0;margin:.55rem 0 0;list-style:none}.toc li{margin:.42rem 0}.toc .l3{padding-left:.8rem}.toc a{color:var(--muted);text-decoration:none}.toc a:hover{color:var(--ink)}.document{min-width:0}.artifact{margin:0 0 2rem;padding:1rem 1.1rem;border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:.65rem;background:var(--panel);color:var(--muted);font-size:.76rem}.artifact code{display:inline-block;margin-top:.2rem}.document h1,.document h2,.document h3,.document h4{color:var(--ink);font-weight:780;line-height:1.12;letter-spacing:-.025em;text-wrap:balance}.document h1{max-width:19ch;margin:.15rem 0 1.5rem;font-size:clamp(2.35rem,7vw,5.6rem);line-height:.97;letter-spacing:-.05em}.document h2{margin:3.8rem 0 1rem;padding-top:.85rem;border-top:1px solid var(--line);font-size:clamp(1.55rem,3.5vw,2.45rem)}.document h3{margin:2.25rem 0 .75rem;font-size:1.25rem}.document h4{margin:1.75rem 0 .6rem;font-size:1rem}.anchor{margin-left:.35rem;opacity:0;font-weight:500;text-decoration:none}.document :is(h1,h2,h3,h4):hover .anchor,.anchor:focus{opacity:1}.document p,.document li{max-width:78ch}.document strong{color:var(--ink)}.document blockquote{margin:1.5rem 0;padding:1rem 1.15rem;border:1px solid var(--line);border-left:4px solid var(--accent-2);border-radius:.5rem;background:var(--panel);color:var(--copy);font-style:normal}.document code{padding:.11em .34em;border:1px solid var(--line);border-radius:.25rem;background:var(--code);color:var(--accent);font:.86em/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.document pre{overflow:auto;padding:1rem;border:1px solid var(--line);border-radius:.55rem;background:var(--code)}.document pre code{padding:0;border:0;background:none;color:var(--copy)}.document ul,.document ol{padding-left:1.35rem}.document li+li{margin-top:.38rem}.task-list{padding:0!important;list-style:none}.task{display:flex;gap:.7rem;align-items:flex-start;max-width:84ch!important;margin:.55rem 0!important;padding:.68rem .75rem;border:1px solid var(--line);border-radius:.45rem;background:color-mix(in srgb,var(--panel) 72%,transparent)}.task input{width:1.05rem;height:1.05rem;margin:.18rem 0 0;flex:0 0 auto;accent-color:var(--accent)}.table-wrap{max-width:100%;overflow:auto;margin:1.35rem 0;border:1px solid var(--line);border-radius:.55rem;background:var(--panel)}table{width:100%;min-width:40rem;border-collapse:collapse;font-size:.86rem;line-height:1.48}th,td{padding:.78rem .85rem;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{position:sticky;top:0;background:var(--panel-2);color:var(--ink);font-size:.7rem;letter-spacing:.05em;text-transform:uppercase}tr:last-child td{border-bottom:0}hr{margin:2.5rem 0;border:0;border-top:1px solid var(--line)}.foot{width:min(calc(100% - 2rem),var(--max));margin:auto;padding:1.25rem 0 3rem;border-top:1px solid var(--line);color:var(--muted);font-size:.72rem;line-height:1.55}.foot strong{color:var(--copy)}:focus-visible{outline:3px solid var(--accent-2);outline-offset:3px}
@media(max-width:980px){.truth-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.layout{grid-template-columns:minmax(12rem,15rem) minmax(0,1fr);gap:1.5rem}}
@media(max-width:760px){.mast-inner{align-items:flex-start}.copy-wrap{align-items:flex-end;flex-direction:column;gap:.25rem}.copy-status{min-width:0;text-align:right}.truth-grid{grid-template-columns:1fr}.layout{display:block}.toc{position:static;max-height:none;margin-bottom:2rem}.toc .l3{display:none}.document h1{font-size:clamp(2.2rem,12vw,3.8rem)}.document h2{margin-top:3rem}.table-wrap{margin-right:-.5rem}.foot{padding-bottom:2rem}}
@media(max-width:390px){body{font-size:15px}.mast-inner,.truth-grid,.docnav,.layout,.foot{width:min(calc(100% - 1.25rem),var(--max))}.brand{font-size:.65rem}.brand-mark{display:none}.copy-button{padding-inline:.75rem}.truth-item{padding-inline:.55rem}.artifact{padding:.85rem}.document h1{font-size:2.25rem}.task{padding:.6rem}.toc{padding:.8rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{.mast,.truth,.docnav,.toc,.skip,.anchor,.copy-wrap,.copy-source{display:none!important}.layout{display:block;width:auto;padding:0}.artifact{border:1px solid #777}body{background:#fff;color:#111;font-size:10.5pt}.document h1,.document h2,.document h3,.document h4,.document strong{color:#000}.document a,.document code{color:#000}.table-wrap{overflow:visible}table{min-width:0}.document h2{break-after:avoid}.table-wrap,table,pre,blockquote{break-inside:avoid}}
`;

function navLabel(sourceName: (typeof DOCUMENTS)[number]): string {
  return sourceName
    .replace(/^GROWTH_CENTER_/, "")
    .replace(/\.md$/, "")
    .replaceAll("_", " ");
}

function buildDocument(sourceName: (typeof DOCUMENTS)[number], markdown: string): string {
  const sourceHash = createHash("sha256").update(markdown).digest("hex");
  const { body, headings } = renderMarkdown(markdown);
  const title = headings.find((heading) => heading.level === 1)?.text ?? sourceName;
  const toc = headings
    .filter((heading) => heading.level === 2 || heading.level === 3)
    .map(
      (heading) =>
        `<li class="l${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join("");
  const outputName = sourceName.replace(/\.md$/, ".html");
  const nav = DOCUMENTS.map((name) => {
    const nameOutput = name.replace(/\.md$/, ".html");
    return `<a href="${nameOutput}"${nameOutput === outputName ? ' aria-current="page"' : ""}>${escapeHtml(navLabel(name))}</a>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="dark light">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="generator" content="CreditVector Growth Center deterministic documentation renderer">
  <meta name="source-sha256" content="${sourceHash}">
  <title>${escapeHtml(title)} · Gabriel Capital Labs</title>
  <style>${STYLE}</style>
</head>
<body>
  <a class="skip" href="#document">Skip to report</a>
  <header class="mast"><div class="mast-inner">
    <div class="brand"><span class="brand-mark" aria-hidden="true">CG</span><span>Gabriel Capital Labs · CreditVector™</span></div>
    <div class="copy-wrap"><button class="copy-button" id="copy-report" type="button">Copy report</button><span class="copy-status" id="copy-status" role="status" aria-live="polite"></span></div>
  </div></header>
  <section class="truth" aria-label="Founder review metadata"><div class="truth-grid">
    <div class="truth-item"><span>Preview URL</span><code>${escapeHtml(FINAL_METADATA.previewUrl)}</code></div>
    <div class="truth-item"><span>Repository</span><strong>feat/cxos-phase3 · local/uncommitted</strong></div>
    <div class="truth-item"><span>Baseline SHA</span><code>a40a41c5a76028ad5cae2ff655c5bf168fb86a4a</code></div>
    <div class="truth-item"><span>Safety / validation</span><strong>Live economics NO-GO · ${escapeHtml(FINAL_METADATA.finalValidation)}</strong></div>
  </div></section>
  <nav class="docnav" aria-label="Growth Center Founder reports">${nav}</nav>
  <div class="layout">
    <details class="toc" open><summary>On this page</summary><ol>${toc}</ol></details>
    <main class="document" id="document"><div class="artifact"><strong>Standalone Founder review artifact.</strong> Generated deterministically from <a href="${sourceName}">${sourceName}</a>; Markdown is canonical. No external assets, analytics, fonts, or network resources. Source SHA-256: <code>${sourceHash}</code>.</div>${body}</main>
  </div>
  <footer class="foot"><strong>CreditVector Growth Center Foundation Preview</strong> · internal synthetic review only · generated deterministically 2026-07-31 · source ${basename(sourceName)} · SHA-256 ${sourceHash} · branch feat/cxos-phase3 · baseline a40a41c5a76028ad5cae2ff655c5bf168fb86a4a · no external assets or network dependencies.</footer>
  <textarea class="copy-source" id="copy-source" hidden aria-hidden="true">${escapeHtml(markdown)}</textarea>
  <script>
  (() => {
    const button = document.getElementById("copy-report");
    const status = document.getElementById("copy-status");
    const source = document.getElementById("copy-source");
    if (!(button instanceof HTMLButtonElement) || !(source instanceof HTMLTextAreaElement)) return;
    button.addEventListener("click", async () => {
      const report = source.value;
      let copied = false;
      try {
        await navigator.clipboard.writeText(report);
        copied = true;
      } catch (_error) {
        const fallback = document.createElement("textarea");
        fallback.value = report;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        copied = document.execCommand("copy");
        fallback.remove();
      }
      button.textContent = copied ? "Copied" : "Copy unavailable";
      if (status) status.textContent = copied ? "Report copied." : "Select the report text to copy.";
      window.setTimeout(() => {
        button.textContent = "Copy report";
        if (status) status.textContent = "";
      }, 2200);
    });
  })();
  </script>
</body>
</html>\n`;
}

function validateStandalone(outputPath: string, output: string): void {
  const errors: string[] = [];
  if (!output.startsWith("<!doctype html>")) errors.push("missing doctype");
  if (!/<style>[\s\S]+<\/style>/.test(output)) errors.push("missing embedded CSS");
  if (!/<script>[\s\S]+<\/script>/.test(output)) errors.push("missing inline copy script");
  if (!/id="copy-report"/.test(output)) errors.push("missing visible copy button");
  if (!/id="founder-checklist"/.test(output)) errors.push("missing Founder checklist");
  if (/<link\b/i.test(output)) errors.push("link resource element present");
  if (/<(?:img|iframe|audio|video|source|object|embed)\b/i.test(output)) {
    errors.push("external-capable media element present");
  }
  if (/\s(?:src|srcset)=/i.test(output)) errors.push("source attribute present");
  if (/(?:@import|url\s*\(\s*["']?https?:)/i.test(output)) {
    errors.push("external CSS resource present");
  }
  if (/href="(?:https?:|\/\/)/i.test(output)) errors.push("external hyperlink present");
  if (output.includes("{{")) errors.push("unresolved template placeholder");
  for (const value of REQUIRED_METADATA) {
    if (!output.includes(escapeHtml(value))) errors.push(`missing final metadata ${value}`);
  }

  const ids = new Set(
    [...output.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  );
  for (const match of output.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith("#")) {
      if (!ids.has(href.slice(1))) errors.push(`missing anchor ${href}`);
      continue;
    }
    const target = href.split("#")[0];
    if (
      target &&
      !KNOWN_OUTPUTS.has(target) &&
      !existsSync(resolve(dirname(outputPath), target))
    ) {
      errors.push(`missing local target ${target}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `${basename(outputPath)} is not standalone-valid: ${errors.join("; ")}`,
    );
  }
}

const checkMode = process.argv.includes("--check");
let mismatch = false;

for (const sourceName of DOCUMENTS) {
  const sourcePath = join(ROOT, sourceName);
  const markdown = readFileSync(sourcePath, "utf8");
  for (const value of REQUIRED_METADATA) {
    if (!markdown.includes(value)) {
      throw new Error(`${sourceName} is missing final metadata ${value}`);
    }
  }
  const outputPath = sourcePath.replace(/\.md$/, ".html");
  const output = buildDocument(sourceName, markdown);
  validateStandalone(outputPath, output);

  if (checkMode) {
    let current = "";
    try {
      current = readFileSync(outputPath, "utf8");
    } catch {
      // Missing output is reported as deterministic drift below.
    }
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
