// Operator Identity — the authentication boundary (Sprint 9).
//
// Identity NEVER authenticates. It consumes a principal the caller has already resolved
// from currentAccount() (lib/session.ts) — the real signed-in payer, re-checked for
// `disabled` on every call. This mirrors the network authz boundary (NetworkAccount):
// the module takes a resolved, server-side principal and never trusts client input.
//
// Principal = currentAccount().id (the account), per OPERATOR-IDENTITY.md §2.1 —
// actions/authorship use the account, never currentUser() (the effective data subject).
// Fail-closed: a null or disabled account resolves to NO principal.

export interface IdentityPrincipal {
  id: string; // currentAccount().id
  role: string; // "USER" | "ADMIN"
  isAgency: boolean;
  disabled: boolean;
}

// The minimal account shape (a subset of the User row from currentAccount()).
export interface AccountLike {
  id: string;
  role?: string | null;
  isAgency?: boolean | null;
  disabled?: boolean | null;
}

export function resolvePrincipal(account: AccountLike | null): IdentityPrincipal | null {
  if (!account) return null;
  if (account.disabled === true) return null; // fail-closed: a disabled account is no principal
  if (!account.id) return null;
  return { id: account.id, role: account.role ?? "USER", isAgency: account.isAgency === true, disabled: false };
}

export function isAdmin(p: IdentityPrincipal | null): boolean {
  return !!p && p.disabled !== true && p.role === "ADMIN";
}
