// Arena internal-cohort gate. Enabling the flag does NOT grant every user access —
// access requires BOTH the flag ON and the account being in the internal cohort.
// Fail-closed: flag off, or account outside the cohort, or account missing => no
// access. Rollback is flag-only (no data repair).
//
// Cohort = platform admins, plus any ids/emails listed in ARENA_COHORT (comma-
// separated). The demo account is included by email so internal testing works.
import { arenaEnabled } from "./flags";

const DEMO_EMAIL = "demo@gabrielcapitallabs.com";

function cohortAllowlist(): Set<string> {
  const raw = process.env.ARENA_COHORT ?? "";
  const set = new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  set.add(DEMO_EMAIL);
  return set;
}

export interface CohortAccount {
  id: string;
  email?: string | null;
  role?: string | null;
  disabled?: boolean | null;
}

// Server-authoritative: does this account have Arena access right now?
export function arenaAccessible(account: CohortAccount | null): boolean {
  if (!arenaEnabled()) return false;            // flag OFF blocks everyone
  if (!account || account.disabled === true) return false; // fail-closed
  if (account.role === "ADMIN") return true;     // owner/admins are always in-cohort
  const list = cohortAllowlist();
  if (account.email && list.has(account.email.trim().toLowerCase())) return true;
  if (list.has(account.id)) return true;
  return false;                                  // flag ON but outside the cohort => blocked
}
