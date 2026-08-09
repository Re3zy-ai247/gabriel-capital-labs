import type { Bureau } from "@prisma/client";
import { buildParserV2ShadowAccount } from "./parserV2";
import {
  type CreditTruthSection,
  type CreditTruthShadowAccount,
  type ParserObservationInput,
  type ParserV2AccountInput,
  type ParserV2BureauInput,
  type ParserV2InputError,
  type PaymentHistoryEntry,
  type CollectionFact,
  type RelevantDateValue,
  type SectionCompletenessState,
  type SourceLocator,
  type SourceProductType,
} from "./types";

export interface RegexParserV2SectionInput {
  text: string;
  completeness: SectionCompletenessState;
  locator: SourceLocator;
  confidence?: number;
  errors?: ParserV2InputError[];
}

export interface RegexParserV2BureauInput {
  accountPresence: ParserObservationInput<true>;
  sections?: Partial<Record<CreditTruthSection, RegexParserV2SectionInput>>;
  errors?: ParserV2InputError[];
}

export interface RegexParserV2AccountInput {
  sourceAccountKey: string;
  creditorName: ParserObservationInput<string>;
  bureaus?: Partial<Record<Bureau, RegexParserV2BureauInput>>;
  errors?: ParserV2InputError[];
}

export interface RegexParserV2ShadowOutput {
  parserVersion: string;
  accounts: RegexParserV2AccountInput[];
}

interface SectionLine {
  text: string;
  locator: SourceLocator;
  confidence: number;
}

function linesFor(section: RegexParserV2SectionInput | undefined): SectionLine[] {
  if (!section) return [];
  const baseLine = section.locator.lineStart ?? 1;
  return section.text.split(/\r?\n/).map((text, index) => ({
    text: text.trim(),
    locator: {
      ...section.locator,
      lineStart: baseLine + index,
      lineEnd: baseLine + index,
    },
    confidence: section.confidence ?? 1,
  }));
}

function present<T>(
  value: T,
  line: SectionLine,
  normalizationRule: string,
  errors?: ParserV2InputError[]
): ParserObservationInput<T> {
  return {
    presence: "PRESENT",
    value,
    locator: line.locator,
    confidence: line.confidence,
    normalizationRule,
    errors,
  };
}

function firstLabeledValue(
  lines: SectionLine[],
  labels: RegExp[]
): { value: string; line: SectionLine } | undefined {
  for (const line of lines) {
    for (const label of labels) {
      const match = line.text.match(label);
      if (match?.[1]?.trim()) return { value: match[1].trim(), line };
    }
  }
  return undefined;
}

function parseCents(value: string): number | undefined {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function normalizeProductType(value: string): { value: SourceProductType; recognized: boolean } {
  const normalized = value.toLowerCase();
  if (/revolv|credit card|charge account|line of credit/.test(normalized)) return { value: "REVOLVING", recognized: true };
  if (/student/.test(normalized)) return { value: "STUDENT_LOAN", recognized: true };
  if (/mortgage|real estate|home loan/.test(normalized)) return { value: "MORTGAGE", recognized: true };
  if (/install|personal loan|auto|vehicle/.test(normalized)) return { value: "INSTALLMENT", recognized: true };
  if (/collection/.test(normalized)) return { value: "COLLECTION", recognized: true };
  if (/charge[- ]?off/.test(normalized)) return { value: "CHARGE_OFF", recognized: true };
  if (/public record|bankruptcy|judgment/.test(normalized)) return { value: "PUBLIC_RECORD", recognized: true };
  if (/inquiry/.test(normalized)) return { value: "INQUIRY", recognized: true };
  if (/government|child support|tax/.test(normalized)) return { value: "GOVERNMENT", recognized: true };
  if (/other/.test(normalized)) return { value: "OTHER", recognized: true };
  return { value: "OTHER", recognized: false };
}

function parsePaymentHistory(lines: SectionLine[]): ParserObservationInput<PaymentHistoryEntry[]> | undefined {
  const entries: PaymentHistoryEntry[] = [];
  let firstLine: SectionLine | undefined;
  let lastLine: SectionLine | undefined;

  for (const line of lines) {
    const match = line.text.match(
      /^((?:19|20)\d{2}[-/]\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2})\s*(?::|[-–])\s*(.+)$/i
    );
    if (!match) continue;
    const rating = match[2].trim();
    const days = rating.match(/\b(30|60|90|120|150|180)\b/);
    entries.push({
      period: match[1],
      rating,
      daysLate: days ? Number(days[1]) : undefined,
    });
    firstLine ??= line;
    lastLine = line;
  }

  if (!entries.length || !firstLine || !lastLine) return undefined;
  return {
    presence: "PRESENT",
    value: entries,
    locator: {
      ...firstLine.locator,
      lineEnd: lastLine.locator.lineEnd,
    },
    confidence: Math.min(...lines.map((line) => line.confidence)),
    normalizationRule: "regex-v2/payment-history-v1",
  };
}

function parseCollectionFacts(lines: SectionLine[]): ParserObservationInput<CollectionFact[]> | undefined {
  const facts: CollectionFact[] = [];
  let firstLine: SectionLine | undefined;
  let lastLine: SectionLine | undefined;

  for (const line of lines) {
    const lower = line.text.toLowerCase();
    let fact: CollectionFact | undefined;
    if (/\bcollection account\b/.test(lower)) fact = { kind: "COLLECTION_ACCOUNT" };
    else if (/\bplaced for collection\b/.test(lower)) fact = { kind: "PLACED_FOR_COLLECTION" };
    else {
      const balance = line.text.match(/^collection balance\s*:\s*(.+)$/i);
      const originalCreditor = line.text.match(/^original creditor\s*:\s*(.+)$/i);
      const status = line.text.match(/^collection status\s*:\s*(.+)$/i);
      if (balance) {
        const amountCents = parseCents(balance[1]);
        if (amountCents != null) fact = { kind: "COLLECTION_BALANCE", amountCents };
      } else if (originalCreditor?.[1]?.trim()) {
        fact = { kind: "ORIGINAL_CREDITOR_IDENTIFIED", detail: originalCreditor[1].trim() };
      } else if (status?.[1]?.trim()) {
        fact = { kind: "COLLECTION_STATUS", detail: status[1].trim() };
      }
    }

    if (!fact) continue;
    facts.push(fact);
    firstLine ??= line;
    lastLine = line;
  }

  if (!facts.length || !firstLine || !lastLine) return undefined;
  return {
    presence: "PRESENT",
    value: facts,
    locator: { ...firstLine.locator, lineEnd: lastLine.locator.lineEnd },
    confidence: Math.min(...lines.map((line) => line.confidence)),
    normalizationRule: "regex-v2/collection-facts-v1",
  };
}

function parseBooleanMarker(
  lines: SectionLine[],
  positive: RegExp,
  labeledNegative: RegExp,
  rule: string
): ParserObservationInput<boolean> | undefined {
  for (const line of lines) {
    if (labeledNegative.test(line.text)) return present(false, line, rule);
    if (positive.test(line.text)) return present(true, line, rule);
  }
  return undefined;
}

function parseMatchingLines(
  lines: SectionLine[],
  pattern: RegExp,
  rule: string
): ParserObservationInput<string[]> | undefined {
  const matches = lines.filter((line) => pattern.test(line.text));
  if (!matches.length) return undefined;
  return {
    presence: "PRESENT",
    value: matches.map((line) => line.text),
    locator: { ...matches[0].locator, lineEnd: matches[matches.length - 1].locator.lineEnd },
    confidence: Math.min(...matches.map((line) => line.confidence)),
    normalizationRule: rule,
  };
}

function parseRemarks(lines: SectionLine[]): ParserObservationInput<string[]> | undefined {
  const remarks: string[] = [];
  const matchedLines: SectionLine[] = [];
  for (const line of lines) {
    const match = line.text.match(/^remarks?\s*:\s*(.+)$/i);
    if (!match?.[1]?.trim()) continue;
    remarks.push(match[1].trim());
    matchedLines.push(line);
  }
  if (!remarks.length) return undefined;
  return {
    presence: "PRESENT",
    value: remarks,
    locator: { ...matchedLines[0].locator, lineEnd: matchedLines[matchedLines.length - 1].locator.lineEnd },
    confidence: Math.min(...matchedLines.map((line) => line.confidence)),
    normalizationRule: "regex-v2/remarks-v1",
  };
}

function parseRelevantDates(lines: SectionLine[]): ParserObservationInput<RelevantDateValue[]> | undefined {
  const values: RelevantDateValue[] = [];
  const matchedLines: SectionLine[] = [];
  const labels: Array<{ pattern: RegExp; kind: RelevantDateValue["kind"] }> = [
    { pattern: /^date opened\s*:\s*(.+)$/i, kind: "OPENED" },
    { pattern: /^date closed\s*:\s*(.+)$/i, kind: "CLOSED" },
    { pattern: /^last payment(?: date)?\s*:\s*(.+)$/i, kind: "LAST_PAYMENT" },
    { pattern: /^last activity(?: date)?\s*:\s*(.+)$/i, kind: "LAST_ACTIVITY" },
    { pattern: /^charge[- ]?off date\s*:\s*(.+)$/i, kind: "CHARGE_OFF" },
    { pattern: /^collection(?: placed)? date\s*:\s*(.+)$/i, kind: "COLLECTION_PLACED" },
    { pattern: /^(?:transfer|sold) date\s*:\s*(.+)$/i, kind: "TRANSFERRED_OR_SOLD" },
  ];

  for (const line of lines) {
    for (const label of labels) {
      const match = line.text.match(label.pattern);
      if (!match?.[1]?.trim()) continue;
      values.push({ kind: label.kind, isoDate: match[1].trim(), sourceLabel: line.text.split(":", 1)[0] });
      matchedLines.push(line);
      break;
    }
  }

  if (!values.length) return undefined;
  return {
    presence: "PRESENT",
    value: values,
    locator: { ...matchedLines[0].locator, lineEnd: matchedLines[matchedLines.length - 1].locator.lineEnd },
    confidence: Math.min(...matchedLines.map((line) => line.confidence)),
    normalizationRule: "regex-v2/relevant-dates-v1",
  };
}

function parseBureauInput(input: RegexParserV2BureauInput): ParserV2BureauInput {
  const summary = linesFor(input.sections?.ACCOUNT_SUMMARY);
  const detail = linesFor(input.sections?.ACCOUNT_DETAIL);
  const payment = linesFor(input.sections?.PAYMENT_HISTORY);
  const collections = linesFor(input.sections?.COLLECTIONS);
  const remarksSection = linesFor(input.sections?.REMARKS);
  const allDetail = [...detail, ...collections, ...remarksSection];
  const allLines = [...summary, ...allDetail, ...payment];

  const summaryStatus = firstLabeledValue(summary, [/^status\s*:\s*(.+)$/i, /^summary status\s*:\s*(.+)$/i]);
  const detailedStatus = firstLabeledValue(detail, [
    /^detailed status\s*:\s*(.+)$/i,
    /^account status\s*:\s*(.+)$/i,
    /^status\s*:\s*(.+)$/i,
  ]);
  const balance = firstLabeledValue([...summary, ...detail, ...collections], [/^balance\s*:\s*(.+)$/i]);
  const reportedDate = firstLabeledValue([...summary, ...detail], [
    /^reported date\s*:\s*(.+)$/i,
    /^date reported\s*:\s*(.+)$/i,
  ]);
  const dofd = firstLabeledValue(allDetail, [
    /^(?:date of first delinquency|first delinquency|dofd)\s*:\s*(.+)$/i,
  ]);
  const productType = firstLabeledValue([...summary, ...detail], [
    /^(?:product type|account type)\s*:\s*(.+)$/i,
  ]);
  const balanceCents = balance ? parseCents(balance.value) : undefined;
  const normalizedProductType = productType ? normalizeProductType(productType.value) : undefined;

  const sectionCompleteness: ParserV2BureauInput["sectionCompleteness"] = {};
  for (const [section, value] of Object.entries(input.sections ?? {}) as Array<
    [CreditTruthSection, RegexParserV2SectionInput]
  >) {
    sectionCompleteness[section] = {
      state: value.completeness,
      confidence: value.confidence,
      locator: value.locator,
      errors: value.errors,
    };
  }

  return {
    accountPresence: input.accountPresence,
    sectionCompleteness,
    fields: {
      summaryStatus: summaryStatus
        ? present(summaryStatus.value, summaryStatus.line, "regex-v2/summary-status-v1")
        : undefined,
      detailedStatus: detailedStatus
        ? present(detailedStatus.value, detailedStatus.line, "regex-v2/detailed-status-v1")
        : undefined,
      balanceCents:
        balance && balanceCents != null
          ? present(balanceCents, balance.line, "regex-v2/balance-cents-v1")
          : undefined,
      reportedDate: reportedDate
        ? present(reportedDate.value, reportedDate.line, "regex-v2/reported-date-v1")
        : undefined,
      dofd: dofd ? present(dofd.value, dofd.line, "regex-v2/dofd-v1") : undefined,
      relevantDates: parseRelevantDates(allDetail),
      paymentHistory: parsePaymentHistory(payment),
      collectionFacts: parseCollectionFacts(collections),
      chargeOffMarker: parseBooleanMarker(
        allLines,
        /\b(?:charge[- ]?off reported|charged off|charge[- ]?off status\s*:\s*(?:yes|reported))\b/i,
        /^charge[- ]?off(?: status)?\s*:\s*(?:no|none|not reported)$/i,
        "regex-v2/charge-off-marker-v1"
      ),
      lossReported: parseBooleanMarker(
        allLines,
        /\b(?:loss reported|profit and loss write[- ]?off|written off as a loss)\b/i,
        /^loss reported\s*:\s*(?:no|none|not reported)$/i,
        "regex-v2/loss-marker-v1"
      ),
      transferOrSale: parseBooleanMarker(
        allLines,
        /\b(?:transferred or sold|account sold|sold to|transferred to)\b/i,
        /^(?:transfer|sale)(?: reported)?\s*:\s*(?:no|none|not reported)$/i,
        "regex-v2/transfer-sale-marker-v1"
      ),
      consumerDisputeRemarks: parseMatchingLines(
        allLines,
        /\b(?:consumer disputes|disputed by consumer|account information disputed|dispute resolved)\b/i,
        "regex-v2/consumer-dispute-remarks-v1"
      ),
      productType:
        productType && normalizedProductType
          ? present(
              normalizedProductType.value,
              productType.line,
              normalizedProductType.recognized
                ? "regex-v2/product-type-v1"
                : "regex-v2/product-type-unrecognized-as-other-v1",
              normalizedProductType.recognized
                ? undefined
                : [
                    {
                      code: "UNRECOGNIZED_EXPLICIT_PRODUCT_TYPE",
                      message: "Explicit source product type was preserved as OTHER because its label was not recognized.",
                      severity: "WARNING",
                    },
                  ]
            )
          : undefined,
      remarks: parseRemarks(remarksSection),
    },
    errors: input.errors,
  };
}

/**
 * Regex v2 accepts already bureau-scoped source blocks. It never receives a
 * shared block that could be fanned out to multiple bureaus.
 */
export function extractRegexParserV2Shadow(
  output: RegexParserV2ShadowOutput,
  coveredBureaus: Bureau[]
): CreditTruthShadowAccount[] {
  return output.accounts.map((account) => {
    const normalized: ParserV2AccountInput = {
      sourceAccountKey: account.sourceAccountKey,
      creditorName: account.creditorName,
      errors: account.errors,
      bureaus: {},
    };

    for (const [bureau, bureauInput] of Object.entries(account.bureaus ?? {}) as Array<
      [Bureau, RegexParserV2BureauInput]
    >) {
      normalized.bureaus![bureau] = parseBureauInput(bureauInput);
    }

    return buildParserV2ShadowAccount(normalized, {
      parser: "REGEX_V2",
      parserVersion: output.parserVersion,
      coveredBureaus,
    });
  });
}
