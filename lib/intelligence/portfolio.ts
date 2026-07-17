// Kai Agency Intelligence (Phase C, Sprint 8) — CVI module.
// ─────────────────────────────────────────────────────────────────────────────
// Portfolio-level reasoning for agency owners: PURE over the roster rows the
// agency surface already loads (no new queries, no client PII beyond what the
// page renders today). Every row cites the client it came from; rankings are
// deterministic with documented tiebreakers. Kai as the agency strategist —
// workload/priority intelligence, never outcome promises.
export interface RosterClientRow {
  id: string;
  name: string;
  disputableItems: number;
  openLetters: number;
  overdueWindows: number; // §611 windows past due for follow-up
  daysToNextDeadline: number | null; // null = no open window
  respondedAwaitingAnalysis: number;
}

export interface PortfolioClientRead {
  clientId: string;
  name: string;
  riskScore: number; // deterministic 0-100 (documented formula), NOT a credit score
  reasons: readonly string[];
}

export interface PortfolioIntelligence {
  clients: number;
  activeDisputes: number;
  overdueFollowups: number;
  deadlinesNext7Days: number;
  awaitingAnalysis: number;
  highestRisk: readonly PortfolioClientRead[]; // top 5, deterministic order
  pipelineNote: string;
}

/** Documented formula: overdue windows dominate, then imminent deadlines, then
 *  unanalyzed responses, then unworked volume. Pure integers — replay-safe. */
export function clientRiskScore(c: RosterClientRow): number {
  const overdue = Math.min(4, c.overdueWindows) * 15; // ≤60
  const imminent = c.daysToNextDeadline !== null && c.daysToNextDeadline <= 7 ? 20 : 0;
  const unanalyzed = Math.min(2, c.respondedAwaitingAnalysis) * 5; // ≤10
  const unworked = c.disputableItems > 0 && c.openLetters === 0 ? 10 : 0;
  return Math.min(100, overdue + imminent + unanalyzed + unworked);
}

export function assessPortfolio(roster: readonly RosterClientRow[]): PortfolioIntelligence {
  const reads: PortfolioClientRead[] = roster.map((c) => {
    const reasons: string[] = [];
    if (c.overdueWindows > 0) reasons.push(`${c.overdueWindows} follow-up window${c.overdueWindows === 1 ? "" : "s"} overdue`);
    if (c.daysToNextDeadline !== null && c.daysToNextDeadline <= 7) reasons.push(`deadline in ${c.daysToNextDeadline} day${c.daysToNextDeadline === 1 ? "" : "s"}`);
    if (c.respondedAwaitingAnalysis > 0) reasons.push(`${c.respondedAwaitingAnalysis} response${c.respondedAwaitingAnalysis === 1 ? "" : "s"} awaiting analysis`);
    if (c.disputableItems > 0 && c.openLetters === 0) reasons.push("scored items with no dispute started");
    return { clientId: c.id, name: c.name, riskScore: clientRiskScore(c), reasons };
  });
  const highestRisk = [...reads]
    .filter((r) => r.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore || (a.clientId < b.clientId ? -1 : 1))
    .slice(0, 5);
  const overdueFollowups = roster.reduce((n, c) => n + c.overdueWindows, 0);
  const deadlinesNext7Days = roster.filter((c) => c.daysToNextDeadline !== null && c.daysToNextDeadline <= 7).length;
  const awaitingAnalysis = roster.reduce((n, c) => n + c.respondedAwaitingAnalysis, 0);
  const activeDisputes = roster.reduce((n, c) => n + c.openLetters, 0);
  return {
    clients: roster.length,
    activeDisputes,
    overdueFollowups,
    deadlinesNext7Days,
    awaitingAnalysis,
    highestRisk,
    pipelineNote:
      overdueFollowups > 0
        ? `Work the ${overdueFollowups} overdue follow-up${overdueFollowups === 1 ? "" : "s"} first — closed windows are the pipeline's bottleneck.`
        : deadlinesNext7Days > 0
        ? `${deadlinesNext7Days} client deadline${deadlinesNext7Days === 1 ? "" : "s"} land this week — schedule follow-up capacity now.`
        : "No overdue follow-ups — capacity is free for unworked items.",
  };
}
