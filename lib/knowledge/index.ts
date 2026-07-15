// CreditVector Knowledge Graph — public surface (Sprint XIX, ADR-0019). A
// deterministic relationship layer over existing records; no AI, no duplication.
export * from "./types";
export { buildGraph, neighbors, journeyChains, connectedReasons, assembleKnowledge, type GraphRows } from "./engine";
export { financialGraph } from "./loader";
