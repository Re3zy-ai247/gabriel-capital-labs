#!/usr/bin/env python3
"""Render a Founder Library volume's canonical Markdown into the shared HTML edition.

Presentation only — never alters text. Volume 0 §Versioning: a new HTML edition
advances no document version.
"""
import html as H
import re
import sys

TAGS = {
    "[Established]": "t-est", "[Observed]": "t-obs", "[Analysis]": "t-ana",
    "[Live]": "t-live", "[Partial]": "t-part", "[Planned]": "t-plan",
}


def inline(t):
    t = H.escape(t, quote=False)
    for lit, cls in TAGS.items():
        t = t.replace("**" + lit + "**", f'<span class="tag {cls}">{H.escape(lit)}</span>')
        t = t.replace(lit, f'<span class="tag {cls}">{H.escape(lit)}</span>')
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    t = t.replace("§", "&sect;")
    return t


def blocks(md):
    """Split markdown into (kind, payload) blocks."""
    out, buf, i = [], [], 0
    lines = md.split("\n")
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("### "):
            out.append(("h3", ln[4:].strip())); i += 1; continue
        if ln.startswith("## "):
            out.append(("h2", ln[3:].strip())); i += 1; continue
        if ln.strip() == "---":
            i += 1; continue
        if ln.startswith("> "):
            q = []
            while i < len(lines) and lines[i].startswith("> "):
                q.append(lines[i][2:]); i += 1
            out.append(("quote", " ".join(q).strip())); continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(lines[i]); i += 1
            out.append(("table", rows)); continue
        if re.match(r"^\d+\.\s", ln):
            items, cur = [], None
            while i < len(lines) and (re.match(r"^\d+\.\s", lines[i]) or (lines[i].startswith("   ") and cur)):
                if re.match(r"^\d+\.\s", lines[i]):
                    if cur: items.append(cur)
                    cur = re.sub(r"^\d+\.\s", "", lines[i]).strip()
                else:
                    cur += " " + lines[i].strip()
                i += 1
            if cur: items.append(cur)
            out.append(("ol", items)); continue
        if ln.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(lines[i][2:].strip()); i += 1
            out.append(("ul", items)); continue
        if ln.strip() == "":
            if buf:
                out.append(("p", " ".join(buf).strip())); buf = []
            i += 1; continue
        buf.append(ln.strip()); i += 1
    if buf:
        out.append(("p", " ".join(buf).strip()))
    return out


def render_p(text):
    # A capability bullet list marker: "- Thing — **[Live]**" handled in ul.
    m = re.match(r"^\*\*(.{2,90}?)\*\*\s+(.*)$", text, re.S)
    if m and not text.startswith("**[") and len(m.group(1)) < 90 and m.group(2):
        return f'<p class="runin"><b>{inline(m.group(1))}</b> {inline(m.group(2))}</p>'
    if re.match(r"^\*Stack layer:.*\*$", text):
        return f'<p class="stacklayer">{inline(text.strip("*"))}</p>'
    return f"<p>{inline(text)}</p>"


def render(md, secmap):
    out, sec_i, opened = [], 0, False
    for kind, payload in blocks(md):
        if kind == "h2":
            if opened: out.append("      </section>\n")
            sec_i += 1
            out.append(f'      <section id="s{sec_i}">')
            out.append(f'        <h2><span class="sec">&sect;{sec_i}</span>{inline(payload)}</h2>')
            secmap.append((f"s{sec_i}", payload))
            opened = True
        elif kind == "h3":
            out.append(f"        <h3>{inline(payload)}</h3>")
        elif kind == "p":
            out.append("        " + render_p(payload))
        elif kind == "quote":
            out.append('        <div class="panel">')
            out.append(f'          <p class="rule-text">{inline(payload)}</p>')
            out.append("        </div>")
        elif kind == "ul":
            cap = any(re.search(r"\[(Live|Partial|Planned)\]", x) for x in payload)
            cls = "caps" if cap else "plain"
            out.append(f'        <ul class="{cls}">')
            for it in payload:
                out.append(f"          <li>{inline(it)}</li>")
            out.append("        </ul>")
        elif kind == "ol":
            out.append('        <ol class="spaced">')
            for it in payload:
                out.append(f"          <li>{inline(it)}</li>")
            out.append("        </ol>")
        elif kind == "table":
            rows = [r for r in payload if not re.match(r"^\|[\s:|-]+\|$", r)]
            out.append('        <div class="table-scroll">')
            out.append('          <table class="index">')
            for n, r in enumerate(rows):
                cells = [c.strip() for c in r.strip().strip("|").split("|")]
                tag = "th" if n == 0 else "td"
                sc = ' scope="col"' if n == 0 else ""
                out.append("            <tr>" + "".join(
                    f"<{tag}{sc}>{inline(c)}</{tag}>" for c in cells) + "</tr>")
            out.append("          </table>")
            out.append("        </div>")
    if opened: out.append("      </section>")
    return "\n".join(out)


if __name__ == "__main__":
    md_path, head_path, out_path, vol, title, lede, meta_extra, rail_json = sys.argv[1:9]
    import json
    md = open(md_path, encoding="utf-8").read()
    body_md = md.split("## Evidence Standard", 1)
    body_md = "## Evidence Standard" + body_md[1] if len(body_md) > 1 else md
    body_md = body_md.split("\n---\n\n*Governance, revision history")[0]
    secmap = []
    body = render(body_md, secmap)
    rail = json.loads(rail_json)
    head = open(head_path, encoding="utf-8").read()

    toc_items = "\n".join(
        f'      <li><a href="#{sid}">{H.escape(rail.get(sid, [name, name])[0])}</a></li>'
        for sid, name in secmap)
    rail_items = "\n".join(
        f'        <li><a href="#{sid}">{H.escape(rail.get(sid, [name, name])[1])}</a></li>'
        for sid, name in secmap)

    tpl = f"""</style>
</head>
<body>

<a class="skip" href="#doc-main">Skip to document</a>

<div class="wrap">

  <header class="masthead">
    <p class="org">Gabriel Capital Labs · CreditVector Founder Library</p>
    <p class="volume-line">Volume {vol}</p>
    <h1>{H.escape(title)}</h1>
    <p class="lede">{lede}</p>
  </header>

  <section class="meta" aria-label="Document metadata">
    <div><span class="k">Volume</span><span class="v">{vol}</span></div>
    <div><span class="k">Version</span><span class="v">1.0</span></div>
    <div><span class="k">Status</span><span class="v status">Draft</span></div>
    <div><span class="k">Date</span><span class="v">2026&#8209;07&#8209;27</span></div>
    {meta_extra}
  </section>

  <section class="audience" aria-label="Intended audience">
    <span class="k">Intended audience</span>
    <p>Investors · Enterprise customers · Regulators · Financial institutions · Product leaders · Engineers · Attorneys</p>
  </section>

  <section class="audience" aria-label="Relationship to other volumes">
    <span class="k">Relationship to other volumes</span>
    <p>This volume is <strong>entirely dependent on Volume 3</strong>. Every claim traces to a failure diagnosed there, and the mapping is explicit in &sect;4. Nothing appears here that Volume 3 did not diagnose. It also depends on <strong>Volume 2</strong> for the definition of financial trust and the company philosophy the design principles derive from. Per <strong>Volume 0 &sect;6</strong>, this volume describes reasoning and position — it does not establish product capability, technical fact, or legal authority, and production truth governs absolutely.</p>
  </section>

  <section class="controls" aria-label="Document actions">
    <span class="k">This document</span>
    <div class="btn-row">
      <button type="button" class="btn" id="btn-download">Download This Document</button>
      <button type="button" class="btn" id="btn-print">Print / Save as PDF</button>
    </div>
    <p class="hint">Downloading saves a complete copy of this page as a single HTML file that opens offline with no network access. Printing opens your browser's print dialog, where you can choose “Save as PDF”; navigation and these controls are omitted from the printed copy.</p>
    <p class="status-msg" id="dl-status" role="status" aria-live="polite"></p>
  </section>

  <details class="toc">
    <summary>Contents — {len(secmap)} sections</summary>
    <ol>
{toc_items}
    </ol>
  </details>

  <div class="body-grid">

    <nav class="rail" aria-label="Document sections">
      <ol>
{rail_items}
      </ol>
    </nav>

    <main class="doc" id="doc-main">

{body}

    </main>
  </div>

  <footer class="colophon">
    <p class="mark">Gabriel Capital Labs · CreditVector Founder Library · Volume {vol} · v1.0 · Draft · 2026-07-27</p>
    <p>Governance, revision history, founder ratifications, and open items are recorded in the Founder Library revision log. Implementation statuses reflect the engineering record as documented on 2026-07-27 and were not independently verified against production; per Volume 0 &sect;6, production truth governs. This HTML edition is a presentation of the canonical Markdown document and carries no independent authority; where the two differ, the Markdown governs.</p>
  </footer>

</div>
"""
    script = open("VOLUME-03-THE-FINANCIAL-TRUST-PROBLEM.html", encoding="utf-8").read()
    script = script.split("</div>\n\n<script>", 1)[1]
    script = script.replace("VOLUME-03-THE-FINANCIAL-TRUST-PROBLEM.html",
                            out_path.split("/")[-1])
    open(out_path, "w", encoding="utf-8").write(head + tpl + "\n<script>" + script)
    print(f"wrote {out_path}: {len(secmap)} sections")
