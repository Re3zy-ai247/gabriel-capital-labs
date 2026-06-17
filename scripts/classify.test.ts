// Run: npx tsx scripts/classify.test.ts
// Guards creditor classification — especially that original creditors / financing
// companies (MDG) are never mislabeled as third-party debt buyers, since the
// dispute letter chosen depends on it.
import { classifyCreditor, type CreditorKind } from "../lib/classify";
import { AccountType } from "@prisma/client";

let pass = 0;
let fail = 0;

function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (ok) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}\n   got:  ${String(got)}\n   want: ${String(want)}`);
  }
}

type Case = {
  name: string;
  hint?: string;
  kind?: CreditorKind;
  wantType: AccountType;
  wantDebtBuyer: boolean;
  wantNonStrategic?: boolean;
};

const cases: Case[] = [
  // The bug: MDG is consumer financing (mdg.com), NOT a debt buyer.
  { name: "Mdg Us Inc", hint: "collection", wantType: AccountType.INSTALLMENT, wantDebtBuyer: false },
  { name: "MDG Financing", wantType: AccountType.INSTALLMENT, wantDebtBuyer: false },

  // Real debt buyers stay flagged.
  { name: "Lvnv Funding Llc", hint: "collection", wantType: AccountType.COLLECTION, wantDebtBuyer: true },
  { name: "Portfolio Recovery Associates", wantType: AccountType.COLLECTION, wantDebtBuyer: true },
  { name: "Jefferson Capital Systems", wantType: AccountType.COLLECTION, wantDebtBuyer: true },
  { name: "Midland Credit Management", wantType: AccountType.COLLECTION, wantDebtBuyer: true },

  // Original creditors classify by type, never debt buyer.
  { name: "Discover Card", hint: "revolving", wantType: AccountType.REVOLVING, wantDebtBuyer: false },
  { name: "Navient Solutions", hint: "student loan", wantType: AccountType.STUDENT_LOAN, wantDebtBuyer: false },
  { name: "Onemain", hint: "installment", wantType: AccountType.INSTALLMENT, wantDebtBuyer: false },

  // Government = non-strategic.
  { name: "Child Support Enforcement", wantType: AccountType.GOVERNMENT, wantDebtBuyer: false, wantNonStrategic: true },

  // AI 'kind' backstop for names not in any list.
  { name: "Acme Funding Group", kind: "debt_buyer", wantType: AccountType.COLLECTION, wantDebtBuyer: true },
  { name: "Hometown Furniture Finance", kind: "original_creditor", hint: "installment", wantType: AccountType.INSTALLMENT, wantDebtBuyer: false },
  // AI says original creditor but report heading said "collection" => not a collection.
  { name: "Regional Appliance Credit", kind: "original_creditor", hint: "collection", wantType: AccountType.OTHER, wantDebtBuyer: false },
  // AI says collection agency for an unknown collector.
  { name: "Bay Area Recovery Partners", kind: "collection_agency", wantType: AccountType.COLLECTION, wantDebtBuyer: false },
];

for (const c of cases) {
  const r = classifyCreditor(c.name, c.hint, c.kind);
  check(`${c.name} -> type`, r.accountType, c.wantType);
  check(`${c.name} -> isDebtBuyer`, r.isDebtBuyer, c.wantDebtBuyer);
  if (c.wantNonStrategic !== undefined) check(`${c.name} -> nonStrategic`, r.nonStrategic, c.wantNonStrategic);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
