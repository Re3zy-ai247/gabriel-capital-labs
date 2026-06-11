import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { extractRawTradelines, toBureauData } from "../lib/parse";
import { classifyCreditor } from "../lib/classify";
import { scoreTradeline } from "../lib/scoring";
import { computeDuplicateGroups } from "../lib/dedupe";

const prisma = new PrismaClient();

// A single-bureau (Equifax) demo report. The parser records EQUIFAX as PRESENT
// and the other two bureaus as UNKNOWN — so generated letters will NOT claim
// anything about Experian/TransUnion. Includes duplicates + government debts.
const RAW = `
Discover Card
Type: Revolving
Balance: $1,477
Status: Charge-off
Account#: XXXX1477
DOFD: 2024-02-01

Onemain
Type: Installment
Balance: $5,477
Status: Open
Account#: XXXX5477

Upgrade Inc
Type: Installment
Balance: $3,500
Status: Closed

Lvnv Funding Llc
Type: Collection
Balance: $1,013
Original Creditor: Synchrony Bank / PayPal
Status: Open Collection
DOFD: 2024-04-01

Lvnv Funding Llc
Type: Collection
Balance: $1,013
Original Creditor: Synchrony Bank / PayPal
Status: Open Collection

Portfolio Recovery A
Type: Collection
Balance: $469
Status: Open Collection

Portfolio Recov Asso
Type: Collection
Balance: $469
Status: Open Collection

Jefferson Capital Sy
Type: Collection
Balance: $469
Status: Open Collection

Navient Solutions
Type: Student Loan
Balance: $0
Status: Closed
DOFD: 2016-01-01

Navient Solutions
Type: Student Loan
Balance: $0
Status: Closed

Child Support Enforc
Type: Collection
Balance: $0
Status: Open

Nys Otda
Type: Collection
Balance: $0
Status: Open

1st Crd Srvc
Type: Collection
Balance: $365
Status: Open Collection
`;

async function main() {
  const email = "demo@gabrielcapitallabs.com";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo User",
      passwordHash: await bcrypt.hash("demo1234", 10),
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
      fileName: "equifax-report-demo.pdf",
      bureaus: ["EQUIFAX"],
      rawText: RAW.trim(),
      analyzedAt: new Date(),
    },
  });

  const extracted = extractRawTradelines(report.rawText!, report.bureaus);
  const records = extracted.map((ex) => {
    const cls = classifyCreditor(ex.creditorName, ex.typeHint);
    const bureauData = toBureauData(ex, report.bureaus);
    const score = scoreTradeline({
      accountType: cls.accountType,
      isDebtBuyer: cls.isDebtBuyer,
      balanceCents: ex.balanceCents,
      dateOfFirstDelinquency: ex.dofd ? new Date(ex.dofd) : null,
      bureauData,
      nonStrategic: cls.nonStrategic,
    });
    return { ex, cls, bureauData, score };
  });

  const groups = computeDuplicateGroups(
    records.map((r, i) => ({ id: String(i), creditorName: r.ex.creditorName, originalCreditor: r.ex.originalCreditor, balanceCents: r.ex.balanceCents }))
  );

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    await prisma.tradeline.create({
      data: {
        userId: user.id,
        reportId: report.id,
        creditorName: r.ex.creditorName,
        originalCreditor: r.ex.originalCreditor,
        accountNumberMask: r.ex.accountNumberMask,
        accountType: r.cls.accountType,
        isDebtBuyer: r.cls.isDebtBuyer,
        balance: r.ex.balanceCents,
        dateOfFirstDelinquency: r.ex.dofd ? new Date(r.ex.dofd) : null,
        bureauData: r.bureauData as object,
        score: r.score.score,
        probability: r.score.probability,
        reasons: r.score.reasons,
        disputeAngles: r.score.disputeAngles,
        duplicateGroup: groups[String(i)] ?? null,
      },
    });
  }

  console.log(`Seeded user ${email} (password: demo1234) with ${records.length} tradelines.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
