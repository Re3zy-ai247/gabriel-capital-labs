// Groups tradelines that represent the same underlying debt (same balance + a
// shared creditor/original-creditor token). Surfaces double-reporting as an angle.
export interface DedupeItem {
  id: string;
  creditorName: string;
  originalCreditor?: string | null;
  balanceCents: number;
}

function tokens(s?: string | null): string[] {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((t) => t.length > 2);
}

export function computeDuplicateGroups(items: DedupeItem[]): Record<string, string | null> {
  const groups: Record<string, string | null> = {};
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.balanceCents !== b.balanceCents || a.balanceCents === 0) continue;
      const at = new Set([...tokens(a.creditorName), ...tokens(a.originalCreditor)]);
      const bt = [...tokens(b.creditorName), ...tokens(b.originalCreditor)];
      if (bt.some((t) => at.has(t))) {
        const key = groups[a.id] || `grp_${a.id}`;
        groups[a.id] = key;
        groups[b.id] = key;
      }
    }
  }
  return groups;
}
