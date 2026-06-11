import { AccountType } from "@prisma/client";

// Known third-party debt buyers / collection agencies (lowercased substrings).
const DEBT_BUYERS = [
  "lvnv", "portfolio recov", "midland", "jefferson capital", "cavalry", "resurgent",
  "encore", "1st crd", "first credit", "mdg us", "convergent", "enhanced recovery",
  "iq data", "national credit", "receivables", "collection",
];

// Original creditors that are frequently mis-tagged as collections.
const ORIGINAL_CREDITORS: { match: string[]; type: AccountType }[] = [
  { match: ["discover"], type: AccountType.REVOLVING },
  { match: ["capital one", "amex", "american express", "synchrony", "comenity", "fingerhut", "extra "], type: AccountType.REVOLVING },
  { match: ["onemain", "one main", "upgrade", "best egg", "lendingclub", "sofi", "marcus"], type: AccountType.INSTALLMENT },
  { match: ["navient", "nelnet", "great lakes", "mohela", "sallie mae"], type: AccountType.STUDENT_LOAN },
  { match: ["mortgage", "home loan", "wells fargo home", "rocket mortgage"], type: AccountType.MORTGAGE },
];

// Government / non-strategic debts that generally cannot be disputed off a report.
const GOVERNMENT = ["child support", "otda", "tax", "irs", "dept of ed default", "court", "dmv", "toll", "restitution"];

export interface ClassifyResult {
  accountType: AccountType;
  isDebtBuyer: boolean;
  nonStrategic: boolean; // true => should NOT be queued for dispute letters
}

export function classifyCreditor(nameRaw: string, hint?: string): ClassifyResult {
  const name = (nameRaw || "").toLowerCase();
  const h = (hint || "").toLowerCase();

  if (GOVERNMENT.some((g) => name.includes(g))) {
    return { accountType: AccountType.GOVERNMENT, isDebtBuyer: false, nonStrategic: true };
  }

  // Original creditor patterns take precedence over generic "collection" hints.
  for (const oc of ORIGINAL_CREDITORS) {
    if (oc.match.some((m) => name.includes(m))) {
      return { accountType: oc.type, isDebtBuyer: false, nonStrategic: false };
    }
  }

  const isDebtBuyer = DEBT_BUYERS.some((d) => name.includes(d));
  if (isDebtBuyer || h.includes("collection")) {
    return { accountType: AccountType.COLLECTION, isDebtBuyer, nonStrategic: false };
  }
  if (h.includes("charge")) return { accountType: AccountType.CHARGE_OFF, isDebtBuyer: false, nonStrategic: false };
  if (h.includes("inquiry")) return { accountType: AccountType.INQUIRY, isDebtBuyer: false, nonStrategic: false };

  return { accountType: AccountType.OTHER, isDebtBuyer: false, nonStrategic: false };
}
