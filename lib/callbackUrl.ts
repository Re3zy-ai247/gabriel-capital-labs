// Where a signed-out visitor is sent back to after signing in (RC1 S2 — P0-5 /
// A1-01 / A1-15). Deliberately dependency-free: this module is imported by
// middleware.ts on the edge, by lib/requireSession.ts on the server, AND by
// app/login/page.tsx, which is a "use client" module. Anything it imported would
// be dragged into the client bundle behind it (CLAUDE.md gotcha 2), so it
// imports nothing.
//
// SECURITY — why this is a validator and not a formatter: `?callbackUrl=` is an
// attacker-supplied query parameter on a public page. Following it unvalidated is
// a textbook open redirect: the victim completes a real sign-in on the real
// domain and is then handed to a site the attacker chose, at the exact moment
// they have been primed to trust what they see. So only a SAME-ORIGIN RELATIVE
// path is ever honored, and a value that fails any check is DISCARDED for the
// default rather than repaired — a sanitized hostile value is still a
// destination someone else picked.
//
// Rejected on purpose:
//   "https://evil.com/x"  absolute URL, any scheme
//   "//evil.com"          protocol-relative — the browser reads it as a host
//   "/\\evil.com"         browsers normalize "\" to "/" inside a URL, so this
//                         becomes "//evil.com" after parsing
//   " //evil.com"         leading whitespace is stripped by some parsers
//   "/x\ny"               control characters (header/parse smuggling shapes)
//   "/login?…"            not hostile, but a sign-in loop
//   "/api/…"              a real endpoint, never a page a human should land on

export const DEFAULT_AFTER_LOGIN = "/dashboard";

// A callback that is itself an auth screen would bounce the user straight back
// out of the app they just got into.
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

// Longer than any real route in this app; a value past it is not a destination.
const MAX_LENGTH = 512;

/**
 * True only for a value safe to hand to router.push() / NextResponse.redirect()
 * as a same-origin destination.
 */
export function isSafeCallbackPath(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length === 0 || raw.length > MAX_LENGTH) return false;
  // Relative-and-rooted only. This one test rejects every absolute URL
  // ("https://…", "javascript:…", "mailto:…") and every bare-word path.
  if (!raw.startsWith("/")) return false;
  // Protocol-relative, directly or via the backslash spelling browsers fold
  // into it. The backslash test is deliberately whole-string, not prefix-only.
  if (raw.startsWith("//")) return false;
  if (raw.includes("\\")) return false;
  // Control characters, including \n, \r and \t.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(raw)) return false;
  const path = raw.split(/[?#]/)[0];
  if (AUTH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return false;
  if (path === "/api" || path.startsWith("/api/")) return false;
  return true;
}

/**
 * The destination to use after a successful sign-in: the requested path when it
 * passes every check above, otherwise the dashboard.
 */
export function safeCallbackUrl(raw: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  return isSafeCallbackPath(raw) ? raw : fallback;
}

/**
 * The login URL that will return the visitor to `pathAndQuery` once they are
 * back in. An unusable path yields a bare /login rather than a broken query.
 *
 * The value is percent-encoded so a path carrying its own `?a=1&b=2` survives
 * intact. app/scores/layout.tsx (slice S9, not owned here) writes the unencoded
 * spelling `/login?callbackUrl=/scores`; both read back identically through
 * useSearchParams().get(), which decodes.
 */
export function loginPathFor(pathAndQuery: string): string {
  if (!isSafeCallbackPath(pathAndQuery)) return "/login";
  return `/login?callbackUrl=${encodeURIComponent(pathAndQuery)}`;
}
