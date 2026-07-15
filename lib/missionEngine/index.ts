// Financial Mission Engine — public surface (Sprint XVI, ADR-0016). Orchestration
// over CVI + Mission Control; no new intelligence. Every future module plugs in here.
export * from "./types";
export { assembleMissions } from "./engine";
export { financialMission } from "./api";
