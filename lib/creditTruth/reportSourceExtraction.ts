import { computeP0SourceArtifactSha256 } from "./sourceArtifact";
import {
  P0_DEFAULT_REPORT_RESOURCE_LIMITS,
  inspectP0ReportSource,
  validateP0ReportResourceLimits,
  validateP0ExtractionResourceUsage,
  LocalP0ResourceAdmissionController,
  type P0ExtractionResourceUsage,
  type P0ReportResourceLimits,
  type P0ResourceLease,
} from "./reportSourceSafety";

export const P0_REPORT_SOURCE_EXTRACTION_VERSION =
  "p0-report-source-extraction-v1" as const;
export const P0_NORMALIZED_TEXT_VERSION = "newline-preserving-v1" as const;
/** Cooperative AbortSignal is local contract proof only; production PDF hard
 * termination/process isolation remains a mandatory pre-activation adapter dependency. */
export const P0_PDF_PROCESS_ISOLATION_DEPENDENCY = "BOUNDED_PRE_ACTIVATION" as const;

export interface P0BoundedPdfExtractionRequest {
  readonly content: Uint8Array;
  readonly limits: P0ReportResourceLimits;
  readonly signal: AbortSignal;
}

export interface P0BoundedPdfExtractionResult {
  readonly status: "COMPLETE" | "PARTIAL" | "FAILED";
  readonly text: string;
  readonly pageCount: number;
  readonly decompressedBytes: number;
  readonly processingMs: number;
  readonly peakMemoryBytes: number;
  readonly safeErrorCodes: readonly string[];
}

export interface P0BoundedPdfExtractor {
  readonly adapterKey: string;
  readonly adapterVersion: string;
  extract(request: P0BoundedPdfExtractionRequest): Promise<P0BoundedPdfExtractionResult>;
}

export interface P0ExtractedReportSource {
  readonly contractVersion: typeof P0_REPORT_SOURCE_EXTRACTION_VERSION;
  readonly status: "COMPLETE" | "PARTIAL";
  readonly sourceMimeType: "application/pdf" | "text/plain";
  readonly originalSha256: string;
  readonly originalByteLength: number;
  readonly normalizedText: Uint8Array;
  readonly normalizedTextSha256: string;
  readonly normalizedTextByteLength: number;
  readonly normalizationVersion: typeof P0_NORMALIZED_TEXT_VERSION;
  readonly extractorKey: string;
  readonly extractorVersion: string;
  readonly usage: P0ExtractionResourceUsage;
  readonly safeErrorCodes: readonly string[];
}

export type P0ReportSourceExtractionResult =
  | { readonly ok: true; readonly kind: "EXTRACTED"; readonly value: P0ExtractedReportSource }
  | {
      readonly ok: false;
      readonly kind: "REJECTED" | "FAILED" | "TIMEOUT";
      readonly code: string;
    };

function safeCodes(codes: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(codes)]
      .filter((code) => /^[A-Z][A-Z0-9_]{0,63}$/.test(code))
      .slice(0, 32),
  );
}

function normalizeWithoutTruncation(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

async function extractPdfWithDeadline(
  extractor: P0BoundedPdfExtractor,
  content: Uint8Array,
  limits: P0ReportResourceLimits,
  trackUnderlyingSettlement?: (settled: Promise<void>) => void,
): Promise<P0BoundedPdfExtractionResult | "TIMEOUT" | "FAILED"> {
  if (
    !extractor ||
    typeof extractor.extract !== "function" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/.test(extractor.adapterKey) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/.test(extractor.adapterVersion)
  ) {
    return "FAILED";
  }
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const extraction = Promise.resolve()
    .then(() => extractor.extract({ content: new Uint8Array(content), limits, signal: abort.signal }))
    .catch(() => "FAILED" as const);
  trackUnderlyingSettlement?.(extraction.then(() => undefined));
  try {
    return await Promise.race([
      extraction,
      new Promise<"TIMEOUT">((resolve) => {
        timer = setTimeout(() => {
          abort.abort();
          resolve("TIMEOUT");
        }, limits.maxProcessingMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extractP0ReportSourceInternal(input: {
  readonly content: Uint8Array;
  readonly declaredMimeType: string;
  readonly fileName?: string;
  readonly limits?: P0ReportResourceLimits;
  readonly pdfExtractor?: P0BoundedPdfExtractor;
}, trackUnderlyingSettlement?: (settled: Promise<void>) => void): Promise<P0ReportSourceExtractionResult> {
  const limits = input.limits ?? P0_DEFAULT_REPORT_RESOURCE_LIMITS;
  if (!validateP0ReportResourceLimits(limits)) {
    return { ok: false, kind: "REJECTED", code: "INVALID_RESOURCE_LIMITS" };
  }
  const preflight = inspectP0ReportSource({
    content: input.content,
    declaredMimeType: input.declaredMimeType,
    fileName: input.fileName,
    limits,
  });
  if (!preflight.ok) return { ok: false, kind: "REJECTED", code: preflight.code };

  const started = Date.now();
  let text: string;
  let status: "COMPLETE" | "PARTIAL" = "COMPLETE";
  let usage: P0ExtractionResourceUsage;
  let extractorKey: string;
  let extractorVersion: string;
  let errorCodes: readonly string[] = [];

  if (preflight.detectedMimeType === "text/plain") {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input.content);
    } catch {
      return { ok: false, kind: "FAILED", code: "TEXT_DECODING_FAILED" };
    }
    const processingMs = Math.max(0, Date.now() - started);
    usage = Object.freeze({
      pageCount: null,
      decompressedBytes: input.content.byteLength,
      processingMs,
      // Exact accounted buffers: original bytes plus decoded UTF-16 code units.
      peakMemoryBytes: input.content.byteLength + text.length * 2,
    });
    extractorKey = "LOCAL_UTF8_TEXT";
    extractorVersion = "1";
  } else {
    if (!input.pdfExtractor) {
      return { ok: false, kind: "FAILED", code: "PDF_EXTRACTOR_UNAVAILABLE" };
    }
    const extracted = await extractPdfWithDeadline(input.pdfExtractor, input.content, limits, trackUnderlyingSettlement);
    if (extracted === "TIMEOUT") {
      return { ok: false, kind: "TIMEOUT", code: "PDF_EXTRACTION_TIMEOUT" };
    }
    if (
      extracted === "FAILED" ||
      !extracted ||
      typeof extracted !== "object" ||
      !["COMPLETE", "PARTIAL", "FAILED"].includes(extracted.status) ||
      !Array.isArray(extracted.safeErrorCodes) ||
      !extracted.safeErrorCodes.every((code) => typeof code === "string")
    ) {
      return { ok: false, kind: "FAILED", code: "MALFORMED_PDF_EXTRACTOR_RESULT" };
    }
    if (extracted.status === "FAILED") {
      return { ok: false, kind: "FAILED", code: "PDF_EXTRACTION_FAILED" };
    }
    if (
      typeof extracted.text !== "string" ||
      extracted.text.includes("\u0000") ||
      (extracted.status === "COMPLETE" && extracted.text.trim().length === 0)
    ) {
      return { ok: false, kind: "FAILED", code: "MALFORMED_EXTRACTED_TEXT" };
    }
    text = extracted.text;
    status = extracted.status;
    usage = Object.freeze({
      pageCount: extracted.pageCount,
      decompressedBytes: extracted.decompressedBytes,
      processingMs: extracted.processingMs,
      peakMemoryBytes: extracted.peakMemoryBytes,
    });
    extractorKey = input.pdfExtractor.adapterKey;
    extractorVersion = input.pdfExtractor.adapterVersion;
    errorCodes = safeCodes(extracted.safeErrorCodes);
  }

  const normalizedText = new TextEncoder().encode(normalizeWithoutTruncation(text));
  if (normalizedText.byteLength > limits.maxDecompressedBytes) {
    return { ok: false, kind: "REJECTED", code: "DECOMPRESSION_LIMIT_EXCEEDED" };
  }
  // Account for the additional normalized buffer before declaring the job safe.
  usage = Object.freeze({
    ...usage,
    peakMemoryBytes: usage.peakMemoryBytes + normalizedText.byteLength,
  });
  const usageResult = validateP0ExtractionResourceUsage(
    usage,
    preflight.detectedMimeType,
    limits,
  );
  if (!usageResult.ok) {
    return { ok: false, kind: "REJECTED", code: usageResult.code };
  }

  return {
    ok: true,
    kind: "EXTRACTED",
    value: Object.freeze({
      contractVersion: P0_REPORT_SOURCE_EXTRACTION_VERSION,
      status,
      sourceMimeType: preflight.detectedMimeType,
      originalSha256: computeP0SourceArtifactSha256(input.content),
      originalByteLength: input.content.byteLength,
      normalizedText: new Uint8Array(normalizedText),
      normalizedTextSha256: computeP0SourceArtifactSha256(normalizedText),
      normalizedTextByteLength: normalizedText.byteLength,
      normalizationVersion: P0_NORMALIZED_TEXT_VERSION,
      extractorKey,
      extractorVersion,
      usage,
      safeErrorCodes: errorCodes,
    }),
  };
}

export async function extractP0ReportSource(
  input: Parameters<typeof extractP0ReportSourceInternal>[0],
): Promise<P0ReportSourceExtractionResult> {
  return extractP0ReportSourceInternal(input);
}

/**
 * Authorized worker orchestration path. The lower-level extractor above is a
 * pure helper and is not itself proof of concurrency admission.
 */
export async function extractP0ReportSourceWithAdmission(input: {
  readonly tenantId: string;
  readonly controller: LocalP0ResourceAdmissionController;
  readonly lease: P0ResourceLease;
  readonly source: Parameters<typeof extractP0ReportSource>[0];
}): Promise<P0ReportSourceExtractionResult> {
  if (!input.controller?.authorizes(input.lease, input.tenantId)) {
    return { ok: false, kind: "REJECTED", code: "INVALID_RESOURCE_ADMISSION" };
  }
  let underlyingSettlement: Promise<void> | null = null;
  let releaseDeferred = false;
  try {
    const result = await extractP0ReportSourceInternal(input.source, (settled) => { underlyingSettlement = settled; });
    if (!result.ok && result.kind === "TIMEOUT" && underlyingSettlement) {
      releaseDeferred = true;
      void (underlyingSettlement as Promise<void>).then(() => { input.controller.releaseExact(input.lease); });
    }
    return result;
  } finally {
    if (!releaseDeferred) input.controller.releaseExact(input.lease);
  }
}
