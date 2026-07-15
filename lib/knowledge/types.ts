// CreditVector Knowledge Graph (Sprint XIX, ADR-0019). A deterministic
// relationship layer over EXISTING records — not a database, not a graph DB. Every
// node references a canonical id; nothing is duplicated; every edge is a verified
// relationship built from data the platform already stores. No AI, no prediction,
// no inference. Append-only by construction (it is recomputed from immutable rows).

export type NodeType =
  | "consumer" | "profile" | "tradeline" | "campaign" | "letter" | "mail"
  | "response" | "outcome" | "decision" | "mission" | "roadmap" | "builder"
  | "funding_readiness" | "mortgage_readiness" | "business_credit";

export type EdgeType =
  | "belongs_to" | "created" | "generated" | "recommended" | "verified_by"
  | "completed" | "improved" | "blocked" | "depends_on" | "triggered"
  | "resolved" | "strengthened" | "unlocked" | "closed" | "superseded";

export interface GraphNode {
  id: string;            // canonical, prefixed (tl:/cmp:/ltr:/…) — references a real record
  type: NodeType;
  label: string;
  href: string;
  at: string | null;     // ISO timestamp of the underlying record, when known
}

export interface GraphEdge {
  from: string;          // node id
  to: string;            // node id
  type: EdgeType;
  reason: string;        // plain-English, cites the relationship (never invented)
}

export interface FinancialGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// One traceable chain for the "My Financial Journey" view — an ordered walk from a
// recommendation through to its verified outcome, every step a real node.
export interface JourneyChain {
  key: string;
  title: string;
  steps: { node: GraphNode; edge: EdgeType | null }[];  // edge = how this step connects to the previous
}

export interface KnowledgeReason { text: string; evidence: string }

export interface FinancialKnowledge {
  graph: FinancialGraph;
  chains: JourneyChain[];
  reasons: KnowledgeReason[];   // Kai's connected reasoning, cited
  counts: { nodes: number; edges: number };
}
