import type { Bureau } from "@prisma/client";
import type { BureauData, BureauFields } from "./bureauData";

// Pragmatic heuristic extractor. In production, replace `extractRawTradelines`
// with a real PDF/Metro-2/HTML parser (e.g. pdf-parse + a bureau-specific reader).
// The IMPORTANT contract: the parser must record per-bureau presence honestly —
// only mark a bureau PRESENT when its data was actually found.

export interface ExtractedTradeline {
  creditorName: string;
  originalCreditor?: string;
  accountNumberMask?: string;
  balanceCents: number;
  dofd?: string;
  dateReported?: string;
  typeHint?: string;
  // per-bureau raw values, only for bureaus actually present in this report
  perBureau: Partial<Record<Bureau, Omit<BureauFields, "presence">>>;
}

const MONEY = /\$?\s?([\d,]+)(?:\.\d{2})?/;

export function extractRawTradelines(rawText: string, coveredBureaus: Bureau[]): ExtractedTradeline[] {
  // Each tradeline block is separated by a blank line; first line is the creditor.
  const blocks = rawText.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: ExtractedTradeline[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const creditorName = lines[0]?.replace(/\s{2,}/g, " ").trim();
    if (!creditorName || creditorName.length < 2) continue;

    const balMatch = block.match(/balance[:\s]*\$?\s?([\d,]+)/i) || block.match(MONEY);
    const balanceCents = balMatch ? Math.round(parseFloat(balMatch[1].replace(/,/g, "")) * 100) : 0;
    const dofdMatch = block.match(/(?:dofd|first delinquency)[:\s]*([0-9/\-]+)/i);
    const ocMatch = block.match(/original creditor[:\s]*(.+)/i);
    const typeMatch = block.match(/type[:\s]*(.+)/i);
    const acctMatch = block.match(/account[#:\s]*([xX\d\-\*]{4,})/);

    // Build per-bureau values only for bureaus this report covered.
    const perBureau: ExtractedTradeline["perBureau"] = {};
    for (const b of coveredBureaus) {
      perBureau[b] = {
        status: (block.match(/status[:\s]*(.+)/i)?.[1] || "").trim() || undefined,
        balanceCents,
        dofd: dofdMatch?.[1],
      };
    }

    out.push({
      creditorName,
      originalCreditor: ocMatch?.[1]?.trim(),
      accountNumberMask: acctMatch?.[1],
      balanceCents,
      dofd: dofdMatch?.[1],
      typeHint: typeMatch?.[1]?.trim(),
      perBureau,
    });
  }
  return out;
}

// Convert extracted per-bureau values + the set of covered bureaus into the
// stored BureauData with honest presence flags.
export function toBureauData(
  ex: ExtractedTradeline,
  coveredBureaus: Bureau[],
  allBureaus: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"]
): BureauData {
  const data: BureauData = {};
  for (const b of allBureaus) {
    if (ex.perBureau[b]) {
      data[b] = { presence: "PRESENT", ...ex.perBureau[b] };
    } else if (coveredBureaus.includes(b)) {
      // report covered this bureau but the account wasn't listed
      data[b] = { presence: "ABSENT" };
    } else {
      // this bureau's report was never uploaded — we know nothing
      data[b] = { presence: "UNKNOWN" };
    }
  }
  return data;
}
