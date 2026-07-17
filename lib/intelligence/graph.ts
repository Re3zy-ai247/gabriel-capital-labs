// Unified Credit Graph (Phase C, Sprint 2) — CVI module.
// ─────────────────────────────────────────────────────────────────────────────
// One typed graph over the user's ENTIRE case so Kai reasons across
// relationships instead of isolated records. PURE: built from rows the caller
// already loaded (no queries here — CVI's snapshot/loaders own I/O; this module
// owns only structure). DETERMINISTIC: nodes and edges are emitted in a stable,
// documented order (insertion by section, then code-unit id sort); no clock, no
// randomness. Every node keeps a `ref` ("node:<kind>:<id>") that downstream
// reasoning cites as EVIDENCE — the graph is the ground truth Kai points at.
export type CreditNodeKind =
  | "consumer" | "tradeline" | "collection" | "inquiry" | "public_record"
  | "letter" | "response" | "bureau" | "furnisher" | "dispute_window"
  | "readiness_goal" | "business_entity";

export type CreditEdgeKind =
  | "reported_by"      // tradeline → bureau
  | "furnished_by"     // tradeline → furnisher
  | "disputed_via"     // tradeline → letter
  | "answered_by"      // letter → response
  | "window_of"        // dispute_window → letter
  | "blocks"           // tradeline → readiness_goal
  | "owned_by";        // any → consumer

export interface CreditNode {
  ref: string; // "node:<kind>:<id>" — the citable evidence handle
  kind: CreditNodeKind;
  id: string;
  label: string;
  facts: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CreditEdge {
  from: string; // node ref
  to: string; // node ref
  kind: CreditEdgeKind;
}

export interface CreditGraph {
  nodes: readonly CreditNode[];
  edges: readonly CreditEdge[];
  byRef: ReadonlyMap<string, CreditNode>;
}

// Row inputs — the shapes existing loaders already produce. The graph never
// invents a field: absent data stays absent (honesty law).
export interface GraphInput {
  userId: string;
  tradelines: Array<{ id: string; creditorName: string; accountType: string; probability: string; balance: number | null; bureaus?: string[]; isDebtBuyer?: boolean }>;
  inquiries?: Array<{ id: string; name: string; at?: string | null }>;
  publicRecords?: Array<{ id: string; kind: string }>;
  letters: Array<{ id: string; tradelineId?: string | null; recipient?: string | null; bureau?: string | null; round?: number | null; status?: string | null; mailedAt?: string | null; responseOutcome?: string | null; responseAt?: string | null }>;
  // recipientType drives which statute the law stage cites (§611 bureau ·
  // §623 furnisher · FDCPA §809 collector — the letter engine's own distinction);
  // absent = "bureau" for back-compat with kaiHome's deadline shape.
  openWindows?: Array<{ letterId: string; recipient: string; daysElapsed: number; daysLeft: number; recipientType?: "bureau" | "furnisher" | "collector" }>;
  readinessGoals?: Array<{ id: string; label: string; level: string; blockers?: string[] }>;
  businessEntities?: Array<{ id: string; name: string }>;
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const nodeRef = (kind: CreditNodeKind, id: string) => `node:${kind}:${id}`;

export function buildCreditGraph(input: GraphInput): CreditGraph {
  const nodes: CreditNode[] = [];
  const edges: CreditEdge[] = [];
  const consumerRef = nodeRef("consumer", input.userId);
  nodes.push({ ref: consumerRef, kind: "consumer", id: input.userId, label: "Consumer", facts: {} });

  const bureaus = new Map<string, string>(); // name → ref
  const furnishers = new Map<string, string>();
  const ensure = (map: Map<string, string>, kind: CreditNodeKind, name: string): string => {
    // Key and ref derive from the SAME normalization so two distinct nodes can
    // never share a ref (whitespace runs collapse before both).
    const key = name.trim().toLowerCase().replace(/\s+/g, "-");
    const existing = map.get(key);
    if (existing) return existing;
    const ref = nodeRef(kind, key);
    map.set(key, ref);
    nodes.push({ ref, kind, id: key, label: name.trim(), facts: {} });
    return ref;
  };

  for (const t of [...input.tradelines].sort(byId)) {
    const kind: CreditNodeKind = /collection/i.test(t.accountType) ? "collection" : "tradeline";
    const ref = nodeRef(kind, t.id);
    nodes.push({
      ref, kind, id: t.id, label: t.creditorName,
      facts: { accountType: t.accountType, probability: t.probability, balance: t.balance, isDebtBuyer: t.isDebtBuyer ?? false },
    });
    edges.push({ from: ref, to: consumerRef, kind: "owned_by" });
    for (const b of [...(t.bureaus ?? [])].sort()) edges.push({ from: ref, to: ensure(bureaus, "bureau", b), kind: "reported_by" });
    edges.push({ from: ref, to: ensure(furnishers, "furnisher", t.creditorName), kind: "furnished_by" });
  }

  for (const q of [...(input.inquiries ?? [])].sort(byId)) {
    const ref = nodeRef("inquiry", q.id);
    nodes.push({ ref, kind: "inquiry", id: q.id, label: q.name, facts: { at: q.at ?? null } });
    edges.push({ from: ref, to: consumerRef, kind: "owned_by" });
  }
  for (const p of [...(input.publicRecords ?? [])].sort(byId)) {
    const ref = nodeRef("public_record", p.id);
    nodes.push({ ref, kind: "public_record", id: p.id, label: p.kind, facts: {} });
    edges.push({ from: ref, to: consumerRef, kind: "owned_by" });
  }

  for (const l of [...input.letters].sort(byId)) {
    const ref = nodeRef("letter", l.id);
    nodes.push({
      ref, kind: "letter", id: l.id, label: `Letter ${l.round ?? 1} → ${l.recipient ?? l.bureau ?? "recipient"}`,
      facts: { round: l.round ?? 1, status: l.status ?? null, mailedAt: l.mailedAt ?? null, responseOutcome: l.responseOutcome ?? null },
    });
    edges.push({ from: ref, to: consumerRef, kind: "owned_by" });
    if (l.tradelineId) {
      const tlRef = nodes.find((n) => (n.kind === "tradeline" || n.kind === "collection") && n.id === l.tradelineId)?.ref;
      if (tlRef) edges.push({ from: tlRef, to: ref, kind: "disputed_via" });
    }
    if (l.responseOutcome || l.responseAt) {
      const rRef = nodeRef("response", l.id);
      nodes.push({ ref: rRef, kind: "response", id: l.id, label: `Response: ${l.responseOutcome ?? "logged"}`, facts: { outcome: l.responseOutcome ?? null, at: l.responseAt ?? null } });
      edges.push({ from: ref, to: rRef, kind: "answered_by" });
    }
  }

  for (const w of [...(input.openWindows ?? [])].sort((a, b) => (a.letterId < b.letterId ? -1 : a.letterId > b.letterId ? 1 : 0))) {
    const rt = w.recipientType ?? "bureau";
    const label = rt === "bureau" ? `§611 window (${w.recipient})` : rt === "furnisher" ? `§623 window (${w.recipient})` : `Validation follow-up (${w.recipient})`;
    const ref = nodeRef("dispute_window", w.letterId);
    nodes.push({ ref, kind: "dispute_window", id: w.letterId, label, facts: { daysElapsed: w.daysElapsed, daysLeft: w.daysLeft, recipientType: rt } });
    edges.push({ from: ref, to: nodeRef("letter", w.letterId), kind: "window_of" });
  }

  for (const g of [...(input.readinessGoals ?? [])].sort(byId)) {
    const ref = nodeRef("readiness_goal", g.id);
    nodes.push({ ref, kind: "readiness_goal", id: g.id, label: g.label, facts: { level: g.level } });
    edges.push({ from: ref, to: consumerRef, kind: "owned_by" });
    for (const blockerId of [...(g.blockers ?? [])].sort()) {
      const tlRef = nodes.find((n) => (n.kind === "tradeline" || n.kind === "collection") && n.id === blockerId)?.ref;
      if (tlRef) edges.push({ from: tlRef, to: ref, kind: "blocks" });
    }
  }
  for (const b of [...(input.businessEntities ?? [])].sort(byId)) {
    const ref = nodeRef("business_entity", b.id);
    nodes.push({ ref, kind: "business_entity", id: b.id, label: b.name, facts: {} });
    edges.push({ from: ref, to: consumerRef, kind: "owned_by" });
  }

  return { nodes, edges, byRef: new Map(nodes.map((n) => [n.ref, n])) };
}
