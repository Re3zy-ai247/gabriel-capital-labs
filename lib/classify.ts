import { AccountType } from "@prisma/client";

// What KIND of entity a creditor is. The AI extractor judges this from real-world
// knowledge of the company (see lib/aiParse.ts); our curated lists below are
// high-confidence overrides for names we are certain about.
export type CreditorKind =
  | "original_creditor"
  | "debt_buyer"
  | "collection_agency"
  | "government"
  | "unknown";

// High-confidence third-party DEBT BUYERS — firms whose business is buying
// charged-off debt. Tagged isDebtBuyer=true. Do NOT add original creditors or
// financing companies here (e.g. MDG / MDG Financing is NOT a debt buyer).
const DEBT_BUYERS = [
  "lvnv", "resurgent", "portfolio recov", "midland", "mcm", "jefferson capital",
  "cavalry", "encore", "sherman", "unifund", "second round",
  "absolute resolutions", "pra group", "velocity invest",
];

// Third-party COLLECTION AGENCIES (collect debt they may not own) and names that
// literally read as a collector. Tagged COLLECTION but isDebtBuyer=false.
const COLLECTION_AGENCIES = [
  "convergent", "enhanced recovery", "iq data", "ic system", "transworld",
  "afni", "1st crd", "first credit", "receivables", "collection",
  "national credit", "credit management",
];

// Original creditors / lenders / consumer-financing companies frequently
// mis-tagged as collections. MDG (mdg.com — consumer financing) lives HERE, not
// in DEBT_BUYERS, so its accounts are never labeled a third-party collection.
const ORIGINAL_CREDITORS: { match: string[]; type: AccountType }[] = [
  { match: ["discover", "capital one", "amex", "american express", "synchrony", "comenity", "fingerhut", "extra ", "credit one", "merrick", "mission lane"], type: AccountType.REVOLVING },
  { match: ["onemain", "one main", "upgrade", "best egg", "lendingclub", "sofi", "marcus", "mdg", "fortiva", "genesis", "concora", "avant", "oportun"], type: AccountType.INSTALLMENT },
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

// The report's own explicit PRODUCT type — what kind of credit this is. This is
// a fact the source printed about the account, so it outranks our curated
// creditor-name heuristics (see classifyCreditor step 2).
function productTypeFromHint(h: string): AccountType | null {
  if (!h) return null;
  if (h.includes("mortgage") || h.includes("real estate")) return AccountType.MORTGAGE;
  if (h.includes("student")) return AccountType.STUDENT_LOAN;
  if (h.includes("auto") || h.includes("vehicle") || h.includes("install")) return AccountType.INSTALLMENT;
  if (h.includes("revolv") || h.includes("credit card") || h.includes("charge account") || h.includes("line of credit"))
    return AccountType.REVOLVING;
  return null;
}

// Map a free-text account-type hint to an AccountType. Used as a fallback and to
// type accounts the AI flags as original creditors. Note that COLLECTION and
// CHARGE_OFF are CONDITIONS, not product types — they only become the account
// type when the source offered no product type at all. The account's condition
// is carried separately by the condition model (lib/intelligence/snapshot.ts
// factualCondition), which reads the per-bureau status text, so a charged-off
// card stays typed REVOLVING and is still correctly treated as a negative.
function typeFromHint(h: string): AccountType | null {
  if (!h) return null;
  const product = productTypeFromHint(h);
  if (product) return product;
  if (h.includes("collection")) return AccountType.COLLECTION;
  if (h.includes("charge")) return AccountType.CHARGE_OFF;
  if (h.includes("inquiry")) return AccountType.INQUIRY;
  return null;
}

// Resolve a creditor's account type and whether it's a third-party debt buyer.
// Precedence: curated lists (we're sure) > the AI's real-world judgment (kind) >
// the raw type hint. `kind` comes from the AI extractor and lets us classify
// companies that aren't in our lists without hardcoding every name.
export function classifyCreditor(nameRaw: string, hint?: string, kind?: CreditorKind): ClassifyResult {
  const name = (nameRaw || "").toLowerCase();
  const h = (hint || "").toLowerCase();

  // 1. Government (by name or the AI's judgment) — non-strategic, don't dispute.
  if (kind === "government" || GOVERNMENT.some((g) => name.includes(g))) {
    return { accountType: AccountType.GOVERNMENT, isDebtBuyer: false, nonStrategic: true };
  }

  // 2. Curated original creditors win over a generic "collection" hint or an AI
  //    mislabel — these are financing/lender names we are sure about. What they
  //    settle is the ENTITY question (this is a lender, not a third-party debt
  //    buyer), which is what the curated list actually knows.
  //
  //    They do NOT settle the product type: if the report itself printed one
  //    ("Type: Revolving"), the report wins. A hardcoded name mapping used to
  //    override the source — MDG forced INSTALLMENT even on a row the report
  //    explicitly typed Revolving — which is a name heuristic beating the
  //    document it is supposed to be reading.
  //
  //    They also do not settle the account's CONDITION. A charged-off Capital
  //    One card is a REVOLVING account in derogatory condition, not a clean
  //    one; the condition comes from the report's status text via
  //    lib/intelligence/snapshot.ts factualCondition, never from this list.
  const explicitProduct = productTypeFromHint(h);
  for (const oc of ORIGINAL_CREDITORS) {
    if (oc.match.some((m) => name.includes(m))) {
      return { accountType: explicitProduct ?? oc.type, isDebtBuyer: false, nonStrategic: false };
    }
  }

  // 3. Curated high-confidence debt buyers, then collection agencies (by name).
  if (DEBT_BUYERS.some((d) => name.includes(d))) {
    return { accountType: AccountType.COLLECTION, isDebtBuyer: true, nonStrategic: false };
  }
  if (COLLECTION_AGENCIES.some((d) => name.includes(d))) {
    return { accountType: AccountType.COLLECTION, isDebtBuyer: false, nonStrategic: false };
  }

  // 4. Trust the AI's real-world knowledge of the entity when our lists don't hit.
  if (kind === "debt_buyer") return { accountType: AccountType.COLLECTION, isDebtBuyer: true, nonStrategic: false };
  if (kind === "collection_agency") return { accountType: AccountType.COLLECTION, isDebtBuyer: false, nonStrategic: false };
  if (kind === "original_creditor") {
    // An original creditor is never a third-party collection; ignore a stray
    // "collection" hint and type it from the remaining signal.
    const t = typeFromHint(h);
    return { accountType: t && t !== AccountType.COLLECTION ? t : AccountType.OTHER, isDebtBuyer: false, nonStrategic: false };
  }

  // 5. Fall back to the raw hint, then OTHER.
  const fromHint = typeFromHint(h);
  if (fromHint) return { accountType: fromHint, isDebtBuyer: false, nonStrategic: false };

  return { accountType: AccountType.OTHER, isDebtBuyer: false, nonStrategic: false };
}
