// Operator Network internal-cohort gate — the FEATURE-reach axis, independent of
// the per-channel authz axis (lib/network/authz.ts). Enabling the flag does NOT
// grant every user access: reaching the network at all requires BOTH the flag ON
// and the account being in the internal cohort. Fail-closed: flag off, or account
// outside the cohort, or account missing => no access. Rollback is flag-only.
//
// This mirrors lib/arena/cohort.ts on purpose — same rollout discipline, same
// fail-closed shape — so the two gated surfaces can never drift apart on WHO is a
// tester. Per-channel visibility/posting is a SEPARATE decision made by
// canViewChannel/canPostChannel; an account must clear both axes.
//
// Cohort = platform admins, plus any ids/emails listed in OPERATOR_NETWORK_COHORT
// (comma-separated). The demo account is included by email so internal testing
// works without configuring the list.
import { operatorNetworkEnabled } from "./flags";

const DEMO_EMAIL = "demo@gabrielcapitallabs.com";

function cohortAllowlist(): Set<string> {
  const raw = process.env.OPERATOR_NETWORK_COHORT ?? "";
  const set = new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  set.add(DEMO_EMAIL);
  return set;
}

export interface NetworkCohortAccount {
  id: string;
  email?: string | null;
  role?: string | null;
  disabled?: boolean | null;
}

// Server-authoritative: may this account reach the Operator Network right now?
export function operatorNetworkAccessible(account: NetworkCohortAccount | null): boolean {
  if (!operatorNetworkEnabled()) return false;              // flag OFF blocks everyone
  if (!account || account.disabled === true) return false;   // fail-closed
  if (account.role === "ADMIN") return true;                 // owner/admins are always in-cohort
  const list = cohortAllowlist();
  if (account.email && list.has(account.email.trim().toLowerCase())) return true;
  if (list.has(account.id)) return true;
  return false;                                              // flag ON but outside the cohort => blocked
}
