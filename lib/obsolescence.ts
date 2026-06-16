import { AccountType } from "@prisma/client";
import type { BureauData } from "./bureauData";

// FCRA §605 / 15 U.S.C. §1681c obsolescence windows.
// Most adverse items drop off 7 years after the date of first delinquency.
// Chapter 7 / Chapter 11 bankruptcies — and DISMISSED Chapter 13 cases — report
// for 10 years from the filing date (entry of the order for relief). A COMPLETED
// Chapter 13 follows the ordinary 7-year window.
export const DEFAULT_WINDOW_YEARS = 7;
export const BANKRUPTCY_WINDOW_YEARS = 10;

const BANKRUPTCY_RE =
  /\bbankruptc|\bchapter\s*(?:7|11|13|seven|eleven|thirteen)\b|\border(?:\s+for)?\s+relief\b|\bin\s+re\b/i;
const CH13_RE = /\bchapter\s*(?:13|thirteen)\b/i;
const DISMISSED_RE = /\bdismiss/i;

// Concatenate every status/remarks string we hold across bureaus, so bankruptcy
// detection can read the chapter even when it lives in a bureau's status text
// rather than the creditor name.
export function bureauTextBlob(data: BureauData | null | undefined): string {
  if (!data) return "";
  return (Object.values(data) as BureauData[keyof BureauData][])
    .filter(Boolean)
    .map((f) => `${f!.status ?? ""} ${f!.remarks ?? ""}`)
    .join(" ");
}

// The §605 reporting window in years for one tradeline. Only the public-record
// bankruptcy ENTRY itself gets the 10-year window — an ordinary account merely
// flagged "included in bankruptcy" still follows its own 7-year DOFD clock, so we
// gate on accountType === PUBLIC_RECORD before checking the chapter.
export function obsolescenceWindowYears(input: {
  accountType: AccountType;
  creditorName?: string | null;
  text?: string | null;
}): number {
  if (input.accountType !== AccountType.PUBLIC_RECORD) return DEFAULT_WINDOW_YEARS;

  const blob = `${input.creditorName ?? ""} ${input.text ?? ""}`;
  if (!BANKRUPTCY_RE.test(blob)) return DEFAULT_WINDOW_YEARS; // judgments / liens = 7

  // Completed Chapter 13 reverts to 7; a dismissed Ch.13 stays at 10. When the
  // chapter is unstated we keep the longer window — claiming obsolescence too
  // early would be inaccurate (and CROA-unsafe).
  if (CH13_RE.test(blob) && !DISMISSED_RE.test(blob)) return DEFAULT_WINDOW_YEARS;
  return BANKRUPTCY_WINDOW_YEARS;
}
