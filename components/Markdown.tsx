import React from "react";

// Tiny, dependency-free Markdown renderer for AI-authored content (the Strategist
// 90-day plan, etc.). Handles the subset those outputs actually use: ATX headings
// (#..######), bold/italic/inline-code, GFM pipe tables, horizontal rules, and
// bullet lists. Builds React elements (no dangerouslySetInnerHTML), so text is
// escaped and XSS-safe by construction. Anything it doesn't recognize renders as
// a plain paragraph, so it degrades gracefully.

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "hr" }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[] }
  | { type: "table"; rows: string[][] };

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

const isSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", lines: para });
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (t === "") { flush(); i++; continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); blocks.push({ type: "hr" }); i++; continue; }

    const heading = t.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { flush(); blocks.push({ type: "heading", level: heading[1].length, text: heading[2] }); i++; continue; }

    if (/^\|/.test(t)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      blocks.push({ type: "table", rows });
      continue;
    }

    // Bullet list: "- " or "* " (a single marker + space, so "**bold**" isn't a list).
    if (/^[-*]\s+/.test(t)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    para.push(t);
    i++;
  }
  flush();
  return blocks;
}

// Inline formatting: **bold**, *italic*, `code`. Bold is tried before italic.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={key++} className="font-semibold text-white">{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={key++} className="italic text-slate-200">{m[3]}</em>);
    else if (m[4] !== undefined) nodes.push(<code key={key++} className="rounded bg-ink-800 px-1 py-0.5 text-[12px] text-brand-200">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Table({ rows }: { rows: string[][] }) {
  if (!rows.length) return null;
  const hasSeparator = rows.length > 1 && isSeparatorRow(rows[1]);
  const header = rows[0];
  const body = hasSeparator ? rows.slice(2) : rows.slice(1);
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr>
            {header.map((c, i) => (
              <th key={i} className="border-b border-ink-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {renderInline(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="align-top">
              {r.map((c, ci) => (
                <td key={ci} className="border-b border-ink-700/60 px-3 py-2 text-slate-300">
                  {renderInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-1 mb-3 text-lg font-bold text-white",
  2: "mt-6 mb-2 border-t border-ink-700/70 pt-4 text-sm font-bold uppercase tracking-wide text-emerald-300",
  3: "mt-4 mb-1.5 text-sm font-semibold text-slate-100",
};

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const Tag = `h${Math.min(b.level, 6)}` as React.ElementType;
            return (
              <Tag key={i} className={HEADING_CLASS[b.level] || HEADING_CLASS[3]}>
                {renderInline(b.text)}
              </Tag>
            );
          }
          case "hr":
            return <hr key={i} className="my-4 border-ink-700/70" />;
          case "list":
            return (
              <ul key={i} className="my-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-slate-300">
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ul>
            );
          case "table":
            return <Table key={i} rows={b.rows} />;
          case "paragraph":
            return (
              <p key={i} className="my-2 text-[13px] leading-relaxed text-slate-300">
                {b.lines.map((ln, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(ln)}
                  </React.Fragment>
                ))}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
