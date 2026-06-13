import type { PrismaClient, Bureau } from "@prisma/client";
import bcrypt from "bcryptjs";
import { toBureauData, type ExtractedTradeline } from "./parse";
import { classifyCreditor } from "./classify";
import { scoreTradeline } from "./scoring";

export const DEMO_EMAIL = "demo@gabrielcapitallabs.com";
export const DEMO_PASSWORD = "demo1234";

const ALL: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];
const $ = (dollars: number) => Math.round(dollars * 100);

interface DemoBureauVals {
  balanceCents?: number;
  status?: string;
  dofd?: string;
}
interface DemoAccount {
  creditorName: string;
  originalCreditor?: string;
  accountNumberMask?: string;
  typeHint: string;
  dofd?: string;
  duplicateGroup?: string;
  // Which bureaus report this account, and with what values. Intentional
  // per-bureau differences create the cross-bureau discrepancies the app flags.
  bureaus: Partial<Record<Bureau, DemoBureauVals>>;
}

// A realistic TRI-MERGE demo (Equifax + Experian + TransUnion). Includes:
//  • accounts on all three bureaus, and accounts on only one or two
//  • cross-bureau discrepancies (balance / status / DOFD mismatches) → flagged
//  • a duplicate-reported debt, and excluded government debts
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    creditorName: "Discover Card",
    accountNumberMask: "XXXX1477",
    typeHint: "Revolving",
    dofd: "2024-02-01",
    bureaus: {
      // Balance differs across bureaus — a classic re-aging / inaccuracy angle.
      EQUIFAX: { balanceCents: $(1477), status: "Charge-off", dofd: "2024-02-01" },
      EXPERIAN: { balanceCents: $(1502), status: "Charge-off", dofd: "2024-02-01" },
      TRANSUNION: { balanceCents: $(1477), status: "Charge-off", dofd: "2024-05-01" },
    },
  },
  {
    creditorName: "Lvnv Funding Llc",
    originalCreditor: "Synchrony Bank / PayPal",
    typeHint: "Collection",
    dofd: "2024-04-01",
    duplicateGroup: "grp_lvnv",
    bureaus: {
      // DOFD differs across bureaus — possible illegal re-aging.
      EQUIFAX: { balanceCents: $(1013), status: "Open Collection", dofd: "2024-04-01" },
      EXPERIAN: { balanceCents: $(1013), status: "Open Collection", dofd: "2024-07-01" },
      TRANSUNION: { balanceCents: $(1013), status: "Open Collection", dofd: "2024-04-01" },
    },
  },
  {
    // The SAME underlying debt double-reported (duplicate group) — EQ only.
    creditorName: "Lvnv Funding Llc",
    originalCreditor: "Synchrony Bank / PayPal",
    typeHint: "Collection",
    duplicateGroup: "grp_lvnv",
    bureaus: {
      EQUIFAX: { balanceCents: $(1013), status: "Open Collection" },
    },
  },
  {
    creditorName: "Portfolio Recovery A",
    typeHint: "Collection",
    bureaus: {
      // Status differs (Open vs Paid) across bureaus.
      EQUIFAX: { balanceCents: $(469), status: "Open Collection" },
      EXPERIAN: { balanceCents: $(469), status: "Open Collection" },
      TRANSUNION: { balanceCents: $(469), status: "Paid Collection" },
    },
  },
  {
    creditorName: "Jefferson Capital Sy",
    typeHint: "Collection",
    bureaus: {
      TRANSUNION: { balanceCents: $(469), status: "Open Collection" },
    },
  },
  {
    creditorName: "1st Crd Srvc",
    typeHint: "Collection",
    bureaus: {
      EQUIFAX: { balanceCents: $(365), status: "Open Collection" },
      EXPERIAN: { balanceCents: $(365), status: "Open Collection" },
    },
  },
  {
    creditorName: "Discover Card",
    accountNumberMask: "XXXX8841",
    typeHint: "Revolving",
    bureaus: {
      EQUIFAX: { balanceCents: $(0), status: "Paid / Closed" },
      EXPERIAN: { balanceCents: $(0), status: "Paid / Closed" },
      TRANSUNION: { balanceCents: $(0), status: "Paid / Closed" },
    },
  },
  {
    creditorName: "Onemain",
    accountNumberMask: "XXXX5477",
    typeHint: "Installment",
    bureaus: {
      EQUIFAX: { balanceCents: $(5477), status: "Open" },
      EXPERIAN: { balanceCents: $(5477), status: "Open" },
      TRANSUNION: { balanceCents: $(5477), status: "Open" },
    },
  },
  {
    creditorName: "Upgrade Inc",
    typeHint: "Installment",
    bureaus: {
      // Reported on only two of three bureaus.
      EQUIFAX: { balanceCents: $(3500), status: "Closed" },
      EXPERIAN: { balanceCents: $(3500), status: "Closed" },
    },
  },
  {
    creditorName: "Navient Solutions",
    typeHint: "Student Loan",
    dofd: "2016-01-01",
    bureaus: {
      EQUIFAX: { balanceCents: $(0), status: "Closed" },
      EXPERIAN: { balanceCents: $(0), status: "Closed" },
      TRANSUNION: { balanceCents: $(0), status: "Closed" },
    },
  },
  {
    creditorName: "Child Support Enforc",
    typeHint: "Collection",
    bureaus: {
      EQUIFAX: { balanceCents: $(0), status: "Open" },
    },
  },
  {
    creditorName: "Nys Otda",
    typeHint: "Collection",
    bureaus: {
      EQUIFAX: { balanceCents: $(0), status: "Open" },
    },
  },
];

function buildExtracted(a: DemoAccount): ExtractedTradeline {
  const perBureau: ExtractedTradeline["perBureau"] = {};
  let maxBalance = 0;
  for (const b of ALL) {
    const v = a.bureaus[b];
    if (!v) continue;
    perBureau[b] = { status: v.status, balanceCents: v.balanceCents ?? 0, dofd: v.dofd ?? a.dofd };
    maxBalance = Math.max(maxBalance, v.balanceCents ?? 0);
  }
  return {
    creditorName: a.creditorName,
    originalCreditor: a.originalCreditor,
    accountNumberMask: a.accountNumberMask,
    balanceCents: maxBalance,
    dofd: a.dofd,
    typeHint: a.typeHint,
    perBureau,
  };
}

// Idempotently (re)creates the demo user and a fully analyzed tri-merge report so
// the app is explorable end-to-end. Safe to run repeatedly.
export async function seedDemoUser(prisma: PrismaClient): Promise<number> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      fullName: "Demo User",
      addressLine1: "123 Main St",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
    },
  });

  await prisma.tradeline.deleteMany({ where: { userId: user.id } });
  await prisma.report.deleteMany({ where: { userId: user.id } });

  const report = await prisma.report.create({
    data: {
      userId: user.id,
      fileName: "tri-merge-report-demo.pdf",
      bureaus: ALL,
      rawText: "Tri-merge demo report (Equifax + Experian + TransUnion).",
      analyzedAt: new Date(),
    },
  });

  for (const a of DEMO_ACCOUNTS) {
    const ex = buildExtracted(a);
    const bureauData = toBureauData(ex, ALL);
    const cls = classifyCreditor(ex.creditorName, ex.typeHint);
    const score = scoreTradeline({
      accountType: cls.accountType,
      isDebtBuyer: cls.isDebtBuyer,
      balanceCents: ex.balanceCents,
      dateOfFirstDelinquency: ex.dofd ? new Date(ex.dofd) : null,
      bureauData,
      nonStrategic: cls.nonStrategic,
    });

    await prisma.tradeline.create({
      data: {
        userId: user.id,
        reportId: report.id,
        creditorName: ex.creditorName,
        originalCreditor: ex.originalCreditor,
        accountNumberMask: ex.accountNumberMask,
        accountType: cls.accountType,
        isDebtBuyer: cls.isDebtBuyer,
        balance: ex.balanceCents,
        dateOfFirstDelinquency: ex.dofd ? new Date(ex.dofd) : null,
        bureauData: bureauData as object,
        score: score.score,
        probability: score.probability,
        reasons: score.reasons,
        disputeAngles: score.disputeAngles,
        duplicateGroup: a.duplicateGroup ?? null,
      },
    });
  }

  return DEMO_ACCOUNTS.length;
}

// Idempotently creates (or promotes) an admin user with the given credentials.
export async function seedAdminUser(
  prisma: PrismaClient,
  email: string,
  password: string
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: "ADMIN", passwordHash },
    create: {
      email: email.toLowerCase(),
      name: "Administrator",
      role: "ADMIN",
      passwordHash,
    },
  });
}
