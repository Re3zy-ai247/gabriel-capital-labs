import type { FinancialGraph, GraphNode, GraphEdge, EdgeType, JourneyChain, KnowledgeReason, FinancialKnowledge } from "./types";

// Link-only projections of existing records (ids + foreign keys, never bodies).
export interface GraphRows {
  hasReport: boolean;
  tradelines: { id: string; creditorName: string }[];
  letters: { id: string; tradelineId: string | null; parentLetterId: string | null; strategy: string; recipientName: string; status: string; mailedAt: string | null; responseAt: string | null; responseOutcome: string | null }[];
  campaigns: { id: string; sequence: number; status: string; items: { tradelineId: string; recipientType: string; letterId: string | null; decision: string }[] }[];
  mail: { mailId: string; letterId: string; status: string }[];
  outcomes: { letterId: string; decisionId: string | null; tradelineId: string | null; outcome: string | null }[];
  decisions: { id: string; tradelineId: string | null; strategyId: string | null }[];
}

const OUTCOME_LABEL: Record<string, string> = { deleted: "removed", updated: "updated", verified: "kept", no_response: "no response", unknown: "logged" };

export function buildGraph(r: GraphRows): FinancialGraph {
  const nodes = new Map<string, GraphNode>();
  const add = (n: GraphNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n); };
  const edges: GraphEdge[] = [];
  const link = (from: string, to: string, type: EdgeType, reason: string) => { if (nodes.has(from) && nodes.has(to)) edges.push({ from, to, type, reason }); };
  const letterIds = new Set(r.letters.map((l) => l.id));

  // ---- PASS 1: add EVERY node first, so no edge can reference a not-yet-added
  //      node (a campaign links to a letter defined later in the input). ----
  add({ id: "consumer", type: "consumer", label: "You", href: "/settings", at: null });
  add({ id: "profile", type: "profile", label: "Credit profile", href: "/tradelines", at: null });
  add({ id: "mission", type: "mission", label: "Mission Control", href: "/dashboard", at: null });
  add({ id: "roadmap", type: "roadmap", label: "Financial roadmap", href: "/dashboard", at: null });
  add({ id: "builder", type: "builder", label: "Credit builder", href: "/dashboard", at: null });
  add({ id: "funding_readiness", type: "funding_readiness", label: "Funding readiness", href: "/dashboard", at: null });
  add({ id: "mortgage_readiness", type: "mortgage_readiness", label: "Mortgage readiness", href: "/dashboard", at: null });
  for (const t of r.tradelines) add({ id: `tl:${t.id}`, type: "tradeline", label: t.creditorName, href: "/tradelines", at: null });
  for (const d of r.decisions) add({ id: `dec:${d.id}`, type: "decision", label: `Recommendation (${d.strategyId ?? "strategy"})`, href: "/journey", at: null });
  for (const c of r.campaigns) add({ id: `cmp:${c.id}`, type: "campaign", label: `Campaign ${c.sequence}`, href: "/campaigns", at: null });
  for (const l of r.letters) {
    add({ id: `ltr:${l.id}`, type: "letter", label: `${l.recipientName} · ${l.strategy}`, href: "/letters", at: l.mailedAt ?? null });
    if (l.responseAt) add({ id: `resp:${l.id}`, type: "response", label: `Response (${OUTCOME_LABEL[l.responseOutcome ?? "unknown"] ?? "logged"})`, href: "/letters", at: l.responseAt });
  }
  for (const m of r.mail) add({ id: `mail:${m.mailId}`, type: "mail", label: `Mail ${m.status.toLowerCase()}`, href: "/mail", at: null });
  for (const o of r.outcomes) if (letterIds.has(o.letterId)) add({ id: `out:${o.letterId}`, type: "outcome", label: `Verified outcome (${OUTCOME_LABEL[o.outcome ?? "unknown"] ?? "logged"})`, href: "/journey", at: null });

  // ---- PASS 2: edges (every referenced node now exists) ----
  link("profile", "consumer", "belongs_to", "Your credit profile.");
  link("mission", "profile", "depends_on", "Mission Control orchestrates your profile.");
  link("roadmap", "mission", "depends_on", "The roadmap sequences your missions.");
  link("builder", "profile", "depends_on", "Builder recommendations read your profile.");
  link("mortgage_readiness", "profile", "depends_on", "Mortgage readiness is gated on clearing derogatory items.");
  link("funding_readiness", "profile", "depends_on", "Funding readiness is gated on clearing derogatory items.");
  for (const t of r.tradelines) link(`tl:${t.id}`, "profile", "belongs_to", `${t.creditorName} is on your report.`);
  for (const d of r.decisions) if (d.tradelineId) link(`dec:${d.id}`, `tl:${d.tradelineId}`, "recommended", "Kai recommended disputing this item.");
  for (const c of r.campaigns) {
    const id = `cmp:${c.id}`;
    link(id, "consumer", "belongs_to", `Campaign ${c.sequence}.`);
    link("mission", id, "depends_on", `Mission Control tracks Campaign ${c.sequence}.`);
    for (const it of c.items) {
      if (it.tradelineId) link(id, `tl:${it.tradelineId}`, "recommended", `Campaign ${c.sequence} targets this item.`);
      if (it.letterId) link(id, `ltr:${it.letterId}`, "created", `Campaign ${c.sequence} created this letter.`);
    }
  }
  for (const l of r.letters) {
    const id = `ltr:${l.id}`;
    if (l.tradelineId) link(id, `tl:${l.tradelineId}`, "generated", "Dispute letter generated for this item.");
    if (l.parentLetterId) link(id, `ltr:${l.parentLetterId}`, "superseded", "A follow-up round to a prior letter.");
    if (l.responseAt) link(`resp:${l.id}`, id, "belongs_to", "The bureau/furnisher response to this letter.");
  }
  for (const m of r.mail) link(`ltr:${m.letterId}`, `mail:${m.mailId}`, "triggered", "This letter was queued to mail.");
  for (const o of r.outcomes) {
    if (!letterIds.has(o.letterId)) continue;
    const id = `out:${o.letterId}`;
    link(id, `ltr:${o.letterId}`, "verified_by", "Verified from this letter's logged response.");
    if (o.decisionId) link(id, `dec:${o.decisionId}`, "resolved", "This outcome resolves the recommendation that started it.");
    // Only a REMOVAL is unambiguously favorable; an "updated" result can be
    // neutral or worse, so it never gets an "improved" edge (matches Mail Center).
    if (o.outcome === "deleted") link(id, "profile", "improved", "The item was removed from your profile.");
  }
  return { nodes: [...nodes.values()], edges };
}

// ---- traversal ----
export function neighbors(g: FinancialGraph, id: string): { node: GraphNode; edge: GraphEdge }[] {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return g.edges
    .filter((e) => e.from === id || e.to === id)
    .map((e) => { const otherId = e.from === id ? e.to : e.from; const node = byId.get(otherId); return node ? { node, edge: e } : null; })
    .filter((x): x is { node: GraphNode; edge: GraphEdge } => x !== null);
}

// The traceable chain for one letter: recommendation → item → campaign → letter →
// mail → response → outcome. Deterministic; every step is a real node.
function chainForLetter(g: FinancialGraph, r: GraphRows, l: GraphRows["letters"][number]): JourneyChain | null {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const steps: JourneyChain["steps"] = [];
  const push = (id: string, edge: EdgeType | null) => { const n = byId.get(id); if (n) steps.push({ node: n, edge }); };
  const dec = l.tradelineId ? r.decisions.find((d) => d.tradelineId === l.tradelineId) : undefined;
  const camp = r.campaigns.find((c) => c.items.some((it) => it.letterId === l.id));
  if (dec) push(`dec:${dec.id}`, null);
  if (l.tradelineId) push(`tl:${l.tradelineId}`, dec ? "recommended" : null);
  if (camp) push(`cmp:${camp.id}`, "recommended");
  push(`ltr:${l.id}`, camp ? "created" : "generated");
  const mail = r.mail.find((m) => m.letterId === l.id);
  if (mail) push(`mail:${mail.mailId}`, "triggered");
  if (l.responseAt) push(`resp:${l.id}`, "completed");
  const out = r.outcomes.find((o) => o.letterId === l.id);
  if (out) { push(`out:${l.id}`, "verified_by"); if (out.outcome === "deleted") push("profile", "improved"); }
  if (steps.length < 2) return null;
  return { key: l.id, title: `${l.recipientName} · ${l.strategy}`, steps };
}

export function journeyChains(g: FinancialGraph, r: GraphRows): JourneyChain[] {
  // Prefer letters furthest along the journey (outcome > response > mailed), then recent.
  const score = (l: GraphRows["letters"][number]) => (r.outcomes.some((o) => o.letterId === l.id) ? 3 : l.responseAt ? 2 : l.mailedAt ? 1 : 0);
  return [...r.letters]
    .sort((a, b) => score(b) - score(a) || (b.mailedAt ?? "").localeCompare(a.mailedAt ?? "") || a.id.localeCompare(b.id))
    .map((l) => chainForLetter(g, r, l))
    .filter((c): c is JourneyChain => c !== null)
    .slice(0, 5);
}

export function connectedReasons(r: GraphRows): KnowledgeReason[] {
  const out: KnowledgeReason[] = [];
  const withOutcome = r.campaigns.find((c) => c.items.some((it) => it.letterId && r.outcomes.some((o) => o.letterId === it.letterId)));
  if (withOutcome) {
    const it = withOutcome.items.find((i) => i.letterId && r.outcomes.some((o) => o.letterId === i.letterId))!;
    const o = r.outcomes.find((x) => x.letterId === it.letterId)!;
    const tl = r.tradelines.find((t) => t.id === o.tradelineId || t.id === it.tradelineId);
    out.push({ text: `Campaign ${withOutcome.sequence}'s dispute${tl ? ` to ${tl.creditorName}` : ""} got a "${OUTCOME_LABEL[o.outcome ?? "unknown"] ?? "logged"}" response — now a verified outcome linked back to the recommendation that started it.`, evidence: `campaign ${withOutcome.sequence} → letter → verified outcome` });
  }
  const pending = r.letters.find((l) => l.mailedAt && !l.responseAt);
  if (pending) out.push({ text: `You have an open reinvestigation with ${pending.recipientName}. It can end with the item removed, updated, or kept — Kai tracks it either way; readiness improves only as derogatory items are actually cleared.`, evidence: `open letter ${pending.id} → reinvestigation in progress` });
  if (r.outcomes.length > 0) out.push({ text: "Each logged outcome here becomes part of your own verified-outcome history and updates your roadmap — the same record the platform learns from, never a prediction.", evidence: "logged outcomes → own-data history + roadmap" });
  return out.slice(0, 3);
}

export function assembleKnowledge(r: GraphRows): FinancialKnowledge {
  const graph = buildGraph(r);
  return { graph, chains: journeyChains(graph, r), reasons: connectedReasons(r), counts: { nodes: graph.nodes.length, edges: graph.edges.length } };
}
