// Shared password policy. Used by the change-password flow (and master-admin
// creation). Returns an error string, or null when the password is acceptable.
const COMMON = new Set(["password", "12345678", "qwerty", "letmein", "admin123", "ceogabriel1234"]);

export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/.test(pw)) return "Add at least one lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Add at least one uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Add at least one special character (e.g. ! @ # $).";
  if (COMMON.has(pw.toLowerCase())) return "That password is too easy to guess — choose something less common.";
  return null;
}
