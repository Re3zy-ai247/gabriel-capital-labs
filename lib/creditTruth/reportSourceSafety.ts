import { randomUUID } from "node:crypto";

export const P0_REPORT_SOURCE_SAFETY_VERSION = "p0-report-source-safety-v1" as const;

export interface P0ReportResourceLimits {
  readonly maxBytes: number;
  readonly maxPages: number;
  readonly maxDecompressedBytes: number;
  readonly maxProcessingMs: number;
  readonly maxPeakMemoryBytes: number;
  readonly maxGlobalConcurrency: number;
  readonly maxTenantConcurrency: number;
  readonly maxGlobalBacklog: number;
  readonly maxTenantBacklog: number;
}

export const P0_DEFAULT_REPORT_RESOURCE_LIMITS: P0ReportResourceLimits =
  Object.freeze({
    maxBytes: 15 * 1024 * 1024,
    maxPages: 250,
    maxDecompressedBytes: 64 * 1024 * 1024,
    maxProcessingMs: 45_000,
    maxPeakMemoryBytes: 128 * 1024 * 1024,
    maxGlobalConcurrency: 4,
    maxTenantConcurrency: 1,
    maxGlobalBacklog: 64,
    maxTenantBacklog: 8,
  });

export type P0ReportSourceSafetyCode =
  | "EMPTY_SOURCE"
  | "BYTE_LIMIT_EXCEEDED"
  | "UNSUPPORTED_MIME"
  | "MIME_MAGIC_MISMATCH"
  | "FILE_EXTENSION_MISMATCH"
  | "ENCRYPTED_PDF_REJECTED"
  | "POLYGLOT_REJECTED"
  | "MALFORMED_TEXT"
  | "PAGE_LIMIT_EXCEEDED"
  | "DECOMPRESSION_LIMIT_EXCEEDED"
  | "PROCESSING_TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "MISSING_RESOURCE_MEASUREMENT"
  | "INVALID_RESOURCE_LIMITS";

export type P0ReportSourcePreflightResult =
  | {
      readonly ok: true;
      readonly kind: "ACCEPTED";
      readonly detectedMimeType: "application/pdf" | "text/plain";
      readonly byteLength: number;
    }
  | {
      readonly ok: false;
      readonly kind: "REJECTED";
      readonly code: P0ReportSourceSafetyCode;
    };

export function validateP0ReportResourceLimits(limits: P0ReportResourceLimits): boolean {
  if (!limits || typeof limits !== "object") return false;
  const values = Object.values(limits);
  if (!values.every((value) => Number.isSafeInteger(value) && value > 0)) return false;
  return (
    limits.maxBytes <= 100 * 1024 * 1024 &&
    limits.maxPages <= 2_000 &&
    limits.maxDecompressedBytes <= 512 * 1024 * 1024 &&
    limits.maxDecompressedBytes >= limits.maxBytes &&
    limits.maxProcessingMs <= 5 * 60_000 &&
    limits.maxPeakMemoryBytes <= 1024 * 1024 * 1024 &&
    limits.maxGlobalConcurrency <= 64 &&
    limits.maxTenantConcurrency <= limits.maxGlobalConcurrency &&
    limits.maxGlobalBacklog <= 10_000 &&
    limits.maxTenantBacklog <= limits.maxGlobalBacklog
  );
}

function indexOfBytes(bytes: Uint8Array, needle: readonly number[]): number {
  outer: for (let i = 0; i <= bytes.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function pdfLooksEncrypted(bytes: Uint8Array): boolean {
  const ascii = Buffer.from(bytes).toString("latin1");
  return /\/Encrypt\b/.test(ascii) || /\/Filter\s*\/Standard\b/.test(ascii);
}

function pdfLooksPolyglot(bytes: Uint8Array): boolean {
  if (indexOfBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) >= 0) return true;
  if (indexOfBytes(bytes, [0x4d, 0x5a]) >= 0) return true;
  const lower = Buffer.from(bytes).toString("latin1").toLowerCase();
  if (lower.includes("<html") || lower.includes("<script")) return true;
  const eof = lower.lastIndexOf("%%eof");
  if (eof < 0) return true;
  return lower.slice(eof + 5).trim().length > 0;
}

function validUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.some((value) => value === 0)) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim()) return false;
    const control = [...text].filter((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && ![9, 10, 13].includes(code);
    }).length;
    return control / Math.max(1, text.length) < 0.01;
  } catch {
    return false;
  }
}

function textContainsEmbeddedActiveOrContainerSignature(bytes: Uint8Array): boolean {
  if (indexOfBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) >= 0) return true;
  if (indexOfBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) >= 0) return true;
  if (indexOfBytes(bytes, [0x4d, 0x5a]) >= 0) return true;
  const lower = Buffer.from(bytes).toString("latin1").toLowerCase();
  return lower.includes("<html") || lower.includes("<script");
}

export function inspectP0ReportSource(input: {
  readonly content: Uint8Array;
  readonly declaredMimeType: string;
  readonly fileName?: string;
  readonly limits?: P0ReportResourceLimits;
}): P0ReportSourcePreflightResult {
  const limits = input.limits ?? P0_DEFAULT_REPORT_RESOURCE_LIMITS;
  if (!validateP0ReportResourceLimits(limits)) {
    return { ok: false, kind: "REJECTED", code: "INVALID_RESOURCE_LIMITS" };
  }
  if (!(input.content instanceof Uint8Array) || input.content.byteLength === 0) {
    return { ok: false, kind: "REJECTED", code: "EMPTY_SOURCE" };
  }
  if (input.content.byteLength > limits.maxBytes) {
    return { ok: false, kind: "REJECTED", code: "BYTE_LIMIT_EXCEEDED" };
  }
  if (!["application/pdf", "text/plain"].includes(input.declaredMimeType)) {
    return { ok: false, kind: "REJECTED", code: "UNSUPPORTED_MIME" };
  }

  const pdfHeaderOffset = indexOfBytes(input.content.subarray(0, Math.min(input.content.byteLength, 1029)), [0x25, 0x50, 0x44, 0x46, 0x2d]);
  const detectedMimeType = pdfHeaderOffset >= 0 && pdfHeaderOffset <= 1024 ? "application/pdf" : "text/plain";
  if (detectedMimeType !== input.declaredMimeType) {
    return { ok: false, kind: "REJECTED", code: "MIME_MAGIC_MISMATCH" };
  }

  const lowerName = input.fileName?.trim().toLowerCase();
  if (
    lowerName &&
    ((detectedMimeType === "application/pdf" && !lowerName.endsWith(".pdf")) ||
      (detectedMimeType === "text/plain" &&
        !lowerName.endsWith(".txt") &&
        !lowerName.endsWith(".text")))
  ) {
    return { ok: false, kind: "REJECTED", code: "FILE_EXTENSION_MISMATCH" };
  }

  if (detectedMimeType === "application/pdf") {
    if (pdfLooksEncrypted(input.content)) {
      return { ok: false, kind: "REJECTED", code: "ENCRYPTED_PDF_REJECTED" };
    }
    if (pdfLooksPolyglot(input.content)) {
      return { ok: false, kind: "REJECTED", code: "POLYGLOT_REJECTED" };
    }
  } else {
    if (
      textContainsEmbeddedActiveOrContainerSignature(input.content) ||
      !validUtf8Text(input.content)
    ) {
      return { ok: false, kind: "REJECTED", code: "MALFORMED_TEXT" };
    }
  }

  return Object.freeze({
    ok: true,
    kind: "ACCEPTED" as const,
    detectedMimeType,
    byteLength: input.content.byteLength,
  });
}

export interface P0ExtractionResourceUsage {
  readonly pageCount: number | null;
  readonly decompressedBytes: number;
  readonly processingMs: number;
  readonly peakMemoryBytes: number;
}

export type P0ExtractionResourceUsageResult =
  | { readonly ok: true; readonly kind: "WITHIN_LIMITS" }
  | {
      readonly ok: false;
      readonly kind: "REJECTED";
      readonly code: P0ReportSourceSafetyCode;
    };

export function validateP0ExtractionResourceUsage(
  usage: P0ExtractionResourceUsage,
  mimeType: "application/pdf" | "text/plain",
  limits: P0ReportResourceLimits = P0_DEFAULT_REPORT_RESOURCE_LIMITS,
): P0ExtractionResourceUsageResult {
  if (!validateP0ReportResourceLimits(limits)) {
    return { ok: false, kind: "REJECTED", code: "INVALID_RESOURCE_LIMITS" };
  }
  if (
    !usage ||
    (mimeType === "application/pdf" &&
      (!Number.isSafeInteger(usage.pageCount) || (usage.pageCount ?? 0) < 1)) ||
    !Number.isSafeInteger(usage.decompressedBytes) ||
    usage.decompressedBytes < 0 ||
    !Number.isFinite(usage.processingMs) ||
    usage.processingMs < 0 ||
    !Number.isSafeInteger(usage.peakMemoryBytes) ||
    usage.peakMemoryBytes < 0
  ) {
    return { ok: false, kind: "REJECTED", code: "MISSING_RESOURCE_MEASUREMENT" };
  }
  if ((usage.pageCount ?? 0) > limits.maxPages) {
    return { ok: false, kind: "REJECTED", code: "PAGE_LIMIT_EXCEEDED" };
  }
  if (usage.decompressedBytes > limits.maxDecompressedBytes) {
    return { ok: false, kind: "REJECTED", code: "DECOMPRESSION_LIMIT_EXCEEDED" };
  }
  if (usage.processingMs > limits.maxProcessingMs) {
    return { ok: false, kind: "REJECTED", code: "PROCESSING_TIME_LIMIT_EXCEEDED" };
  }
  if (usage.peakMemoryBytes > limits.maxPeakMemoryBytes) {
    return { ok: false, kind: "REJECTED", code: "MEMORY_LIMIT_EXCEEDED" };
  }
  return { ok: true, kind: "WITHIN_LIMITS" };
}

const VERIFIED_RESOURCE_LEASE = Symbol("verified-p0-resource-lease");
const verifiedResourceLeases = new WeakMap<object, string>();

export interface P0ResourceLease {
  readonly leaseId: string;
  readonly tenantId: string;
  readonly admittedAt: string;
  readonly [VERIFIED_RESOURCE_LEASE]: true;
}

export type P0ResourceAdmission =
  | { readonly kind: "ADMITTED"; readonly lease: P0ResourceLease }
  | { readonly kind: "QUEUED"; readonly queueToken: string }
  | { readonly kind: "REJECTED_BACKPRESSURE" };

interface QueuedAdmission {
  readonly queueToken: string;
  readonly tenantId: string;
  readonly enqueuedAt: string;
}

/**
 * Ephemeral execution admission only. ReportIngestion remains the sole durable
 * work queue. Round-robin tenant selection prevents one tenant monopolizing
 * released parser capacity.
 */
export class LocalP0ResourceAdmissionController {
  private readonly controllerId = randomUUID();
  private readonly active = new Map<string, P0ResourceLease>();
  private readonly queued: QueuedAdmission[] = [];
  private tenantCursor = 0;

  constructor(
    private readonly limits: P0ReportResourceLimits = P0_DEFAULT_REPORT_RESOURCE_LIMITS,
  ) {
    if (!validateP0ReportResourceLimits(limits)) {
      throw new Error("invalid P0 report resource limits");
    }
  }

  private activeFor(tenantId: string): number {
    return [...this.active.values()].filter((lease) => lease.tenantId === tenantId).length;
  }

  private queuedFor(tenantId: string): number {
    return this.queued.filter((item) => item.tenantId === tenantId).length;
  }

  private mintLease(tenantId: string): P0ResourceLease {
    const lease = {
      leaseId: randomUUID(),
      tenantId,
      admittedAt: new Date(Date.now()).toISOString(),
    } as P0ResourceLease;
    Object.defineProperty(lease, VERIFIED_RESOURCE_LEASE, {
      value: true, enumerable: false, configurable: false, writable: false,
    });
    Object.freeze(lease);
    verifiedResourceLeases.set(lease, `${this.controllerId}\u001f${lease.leaseId}\u001f${tenantId}`);
    return lease;
  }

  request(tenantId: string): P0ResourceAdmission {
    if (typeof tenantId !== "string" || tenantId.length < 1 || tenantId.length > 200) {
      return { kind: "REJECTED_BACKPRESSURE" };
    }
    if (
      this.active.size < this.limits.maxGlobalConcurrency &&
      this.activeFor(tenantId) < this.limits.maxTenantConcurrency
    ) {
      const lease = this.mintLease(tenantId);
      this.active.set(lease.leaseId, lease);
      return { kind: "ADMITTED", lease };
    }
    if (
      this.queued.length >= this.limits.maxGlobalBacklog ||
      this.queuedFor(tenantId) >= this.limits.maxTenantBacklog
    ) {
      return { kind: "REJECTED_BACKPRESSURE" };
    }
    const queueToken = randomUUID();
    this.queued.push(Object.freeze({ queueToken, tenantId, enqueuedAt: new Date(Date.now()).toISOString() }));
    return { kind: "QUEUED", queueToken };
  }

  authorizes(lease: P0ResourceLease, tenantId: string): boolean {
    return Boolean(
      lease &&
      lease[VERIFIED_RESOURCE_LEASE] === true &&
      verifiedResourceLeases.get(lease) === `${this.controllerId}\u001f${lease.leaseId}\u001f${tenantId}` &&
      lease.tenantId === tenantId &&
      this.active.get(lease.leaseId) === lease,
    );
  }

  releaseExact(lease: P0ResourceLease): boolean {
    if (!this.authorizes(lease, lease?.tenantId)) return false;
    const released = this.active.delete(lease.leaseId);
    if (released) verifiedResourceLeases.delete(lease);
    return released;
  }

  claimNext(): { readonly queueToken: string; readonly lease: P0ResourceLease } | null {
    if (this.active.size >= this.limits.maxGlobalConcurrency || this.queued.length === 0) {
      return null;
    }
    const tenants = [...new Set(this.queued.map((item) => item.tenantId))].sort();
    if (tenants.length === 0) return null;
    for (let offset = 0; offset < tenants.length; offset += 1) {
      const index = (this.tenantCursor + offset) % tenants.length;
      const tenantId = tenants[index]!;
      if (this.activeFor(tenantId) >= this.limits.maxTenantConcurrency) continue;
      const queueIndex = this.queued.findIndex((item) => item.tenantId === tenantId);
      if (queueIndex < 0) continue;
      const [queued] = this.queued.splice(queueIndex, 1);
      const lease = this.mintLease(tenantId);
      this.active.set(lease.leaseId, lease);
      this.tenantCursor = (index + 1) % tenants.length;
      return { queueToken: queued!.queueToken, lease };
    }
    return null;
  }
}
