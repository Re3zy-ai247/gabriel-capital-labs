import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    (cents || 0) / 100
  );
}

export function formatDate(d?: Date | string | null): string {
  if (!d) return "—";
  let date: Date;
  if (typeof d === "string") {
    // A date-only string ("YYYY-MM-DD") parses as UTC midnight; rendered in a
    // behind-UTC local zone it slips to the previous calendar day. Pin it to UTC
    // midnight explicitly so the displayed day matches the stored day. (DOFD drives
    // the FCRA §605 seven-year clock — an off-by-one here is legally meaningful.)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.trim());
    date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(d);
  } else {
    date = d;
  }
  // Render in UTC so calendar dates (all stored as UTC midnight) never shift.
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function yearsSince(d?: Date | string | null): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}
