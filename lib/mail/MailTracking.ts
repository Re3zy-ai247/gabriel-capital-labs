// Tracking normalization. Providers return their own milestone streams already
// mapped into canonical ProviderStatus objects (the mapping lives INSIDE each
// provider). This module assembles those into a clean, de-duplicated, ordered
// timeline the UI can render without any provider knowledge.
import type { TrackingInfo, ProviderStatus } from "./MailProvider";
import { pipelineIndex, isTerminal, type MailStatus } from "./MailStatus";

export interface TrackingMilestone {
  status: MailStatus;
  label: string;
  at: string | null;
  raw?: string;
}

export interface NormalizedTracking {
  trackingNumber: string | null;
  carrier: string | null;
  currentStatus: MailStatus;
  milestones: TrackingMilestone[];
}

// Order milestones by pipeline position then time, drop duplicates of the same
// canonical status (keep the earliest timestamp), and pick the furthest-advanced
// status as current. Terminal statuses (RETURNED/FAILED) always win as current.
export function normalizeTracking(t: TrackingInfo): NormalizedTracking {
  const byStatus = new Map<MailStatus, TrackingMilestone>();
  for (const m of [...t.milestones, t.status]) {
    const existing = byStatus.get(m.status);
    if (!existing) {
      byStatus.set(m.status, { status: m.status, label: labelFor(m), at: m.at ?? null, raw: m.raw });
    } else if (m.at && (!existing.at || m.at < existing.at)) {
      existing.at = m.at; // keep earliest observation of that milestone
    }
  }

  const milestones = [...byStatus.values()].sort((a, b) => {
    const pa = pipelineIndex(a.status), pb = pipelineIndex(b.status);
    if (pa !== pb) return pa - pb;
    return (a.at ?? "").localeCompare(b.at ?? "");
  });

  const terminal = milestones.find((m) => isTerminal(m.status) && m.status !== "CLOSED");
  const furthest = milestones.reduce<MailStatus>(
    (acc, m) => (pipelineIndex(m.status) > pipelineIndex(acc) ? m.status : acc),
    t.status.status,
  );

  return {
    trackingNumber: t.trackingNumber ?? null,
    carrier: t.carrier ?? null,
    currentStatus: terminal ? terminal.status : furthest,
    milestones,
  };
}

function labelFor(m: ProviderStatus): string {
  return m.detail && m.detail.trim() ? m.detail : m.status;
}
