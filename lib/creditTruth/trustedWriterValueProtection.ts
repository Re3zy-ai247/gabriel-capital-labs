import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const P0_TRUSTED_WRITER_VALUE_PROTECTION_VERSION =
  "p0-trusted-writer-value-protection-v1" as const;

export type P0TrustedWriterValueProtectionClass =
  | "SERVER_ENVIRONMENT"
  | "DETERMINISTIC_DISPOSABLE";

export type P0TrustedWriterEnvelopeVersion =
  | "p0-prisma-source-bytes-v1"
  | "p0-prisma-source-locator-v1"
  | "p0-production-shadow-value-v1";

export interface P0TrustedWriterProtectedValue {
  readonly contractVersion: typeof P0_TRUSTED_WRITER_VALUE_PROTECTION_VERSION;
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly algorithm: "AES_256_GCM";
  readonly keyVersion: string;
  readonly envelopeVersion: P0TrustedWriterEnvelopeVersion;
  readonly aadVersion: string;
  readonly aadSha256: string;
}

export interface P0TrustedWriterValueProtectionAdapter {
  readonly adapterClass: "AUTHENTICATED_PRODUCTION";
  readonly providerClass: P0TrustedWriterValueProtectionClass;
  readonly adapterId: string;
  readonly keyVersion: string;
  protect(input: {
    readonly plaintext: Uint8Array;
    readonly aad: Uint8Array;
    readonly envelopeVersion: P0TrustedWriterEnvelopeVersion;
    readonly aadVersion: string;
  }): Promise<P0TrustedWriterProtectedValue | null>;
  unprotect(input: {
    readonly protectedValue: P0TrustedWriterProtectedValue;
    readonly aad: Uint8Array;
    readonly expectedEnvelopeVersion: P0TrustedWriterEnvelopeVersion;
    readonly expectedAadVersion: string;
  }): Promise<Uint8Array | null>;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_PROTECTED_VALUE_BYTES = 15 * 1024 * 1024;
const MAX_AAD_BYTES = 4096;

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function validBytes(
  value: unknown,
  minimum: number,
  maximum: number,
): value is Uint8Array {
  return (
    value instanceof Uint8Array &&
    value.byteLength >= minimum &&
    value.byteLength <= maximum
  );
}

function validEnvelope(
  value: P0TrustedWriterProtectedValue | null | undefined,
): value is P0TrustedWriterProtectedValue {
  return Boolean(
    value &&
      exactKeys(value, [
        "contractVersion",
        "ciphertext",
        "iv",
        "authTag",
        "algorithm",
        "keyVersion",
        "envelopeVersion",
        "aadVersion",
        "aadSha256",
      ]) &&
      value.contractVersion === P0_TRUSTED_WRITER_VALUE_PROTECTION_VERSION &&
      validBytes(value.ciphertext, 1, MAX_PROTECTED_VALUE_BYTES) &&
      validBytes(value.iv, 12, 12) &&
      validBytes(value.authTag, 16, 16) &&
      value.algorithm === "AES_256_GCM" &&
      STABLE.test(value.keyVersion) &&
      [
        "p0-prisma-source-bytes-v1",
        "p0-prisma-source-locator-v1",
        "p0-production-shadow-value-v1",
      ].includes(value.envelopeVersion) &&
      STABLE.test(value.aadVersion) &&
      SHA256.test(value.aadSha256),
  );
}

function immutableEnvelope(input: {
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly keyVersion: string;
  readonly envelopeVersion: P0TrustedWriterEnvelopeVersion;
  readonly aadVersion: string;
  readonly aadSha256: string;
}): P0TrustedWriterProtectedValue {
  return Object.freeze({
    contractVersion: P0_TRUSTED_WRITER_VALUE_PROTECTION_VERSION,
    ciphertext: new Uint8Array(input.ciphertext),
    iv: new Uint8Array(input.iv),
    authTag: new Uint8Array(input.authTag),
    algorithm: "AES_256_GCM" as const,
    keyVersion: input.keyVersion,
    envelopeVersion: input.envelopeVersion,
    aadVersion: input.aadVersion,
    aadSha256: input.aadSha256,
  });
}

function createAdapter(input: {
  readonly providerClass: P0TrustedWriterValueProtectionClass;
  readonly adapterId: string;
  readonly keyVersion: string;
  readonly key: Uint8Array;
}): P0TrustedWriterValueProtectionAdapter {
  if (
    !STABLE.test(input.adapterId) ||
    !STABLE.test(input.keyVersion) ||
    !validBytes(input.key, 32, 32)
  ) {
    throw new Error("invalid trusted-writer value-protection configuration");
  }
  const key = Buffer.from(input.key);
  return Object.freeze({
    adapterClass: "AUTHENTICATED_PRODUCTION" as const,
    providerClass: input.providerClass,
    adapterId: input.adapterId,
    keyVersion: input.keyVersion,
    async protect(request: {
      readonly plaintext: Uint8Array;
      readonly aad: Uint8Array;
      readonly envelopeVersion: P0TrustedWriterEnvelopeVersion;
      readonly aadVersion: string;
    }): Promise<P0TrustedWriterProtectedValue | null> {
      if (
        !validBytes(request?.plaintext, 1, MAX_PROTECTED_VALUE_BYTES) ||
        !validBytes(request?.aad, 1, MAX_AAD_BYTES) ||
        !STABLE.test(request.aadVersion) ||
        ![
          "p0-prisma-source-bytes-v1",
          "p0-prisma-source-locator-v1",
          "p0-production-shadow-value-v1",
        ].includes(request.envelopeVersion)
      ) {
        return null;
      }
      try {
        const iv = randomBytes(12);
        const aad = Buffer.from(request.aad);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([
          cipher.update(Buffer.from(request.plaintext)),
          cipher.final(),
        ]);
        return immutableEnvelope({
          ciphertext,
          iv,
          authTag: cipher.getAuthTag(),
          keyVersion: input.keyVersion,
          envelopeVersion: request.envelopeVersion,
          aadVersion: request.aadVersion,
          aadSha256: sha256(aad),
        });
      } catch {
        return null;
      }
    },
    async unprotect(request: {
      readonly protectedValue: P0TrustedWriterProtectedValue;
      readonly aad: Uint8Array;
      readonly expectedEnvelopeVersion: P0TrustedWriterEnvelopeVersion;
      readonly expectedAadVersion: string;
    }): Promise<Uint8Array | null> {
      const envelope = request?.protectedValue;
      if (
        !validEnvelope(envelope) ||
        !validBytes(request.aad, 1, MAX_AAD_BYTES) ||
        !STABLE.test(request.expectedAadVersion) ||
        envelope.keyVersion !== input.keyVersion ||
        envelope.envelopeVersion !== request.expectedEnvelopeVersion ||
        envelope.aadVersion !== request.expectedAadVersion ||
        envelope.aadSha256 !== sha256(request.aad)
      ) {
        return null;
      }
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          key,
          Buffer.from(envelope.iv),
        );
        decipher.setAAD(Buffer.from(request.aad));
        decipher.setAuthTag(Buffer.from(envelope.authTag));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(envelope.ciphertext)),
          decipher.final(),
        ]);
        return new Uint8Array(plaintext);
      } catch {
        return null;
      }
    },
  });
}

/**
 * Fixed server-environment adapter. Neither a request object nor an injected
 * environment can select the key. Missing/malformed configuration disables the
 * adapter instead of falling back to synthetic protection.
 */
export function createServerEnvironmentP0ValueProtectionAdapter(): P0TrustedWriterValueProtectionAdapter | null {
  const keyHex = process.env.P0_TRUSTED_WRITER_ENCRYPTION_KEY;
  const keyVersion = process.env.P0_TRUSTED_WRITER_KEY_VERSION;
  if (
    typeof keyHex !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(keyHex) ||
    typeof keyVersion !== "string" ||
    !STABLE.test(keyVersion)
  ) {
    return null;
  }
  return createAdapter({
    providerClass: "SERVER_ENVIRONMENT",
    adapterId: "p0-server-environment-aes256gcm-v1",
    keyVersion,
    key: Buffer.from(keyHex, "hex"),
  });
}

/** Same contract as production, but impossible to construct in production. */
export function createDeterministicDisposableP0ValueProtectionAdapter(input: {
  readonly seed: string;
  readonly keyVersion?: string;
}): P0TrustedWriterValueProtectionAdapter {
  if (
    process.env.NODE_ENV === "production" ||
    typeof input?.seed !== "string" ||
    input.seed.length < 16 ||
    input.seed.length > 512
  ) {
    throw new Error("disposable value protection is unavailable");
  }
  return createAdapter({
    providerClass: "DETERMINISTIC_DISPOSABLE",
    adapterId: "p0-deterministic-disposable-aes256gcm-v1",
    keyVersion: input.keyVersion ?? "disposable-v1",
    key: createHash("sha256")
      .update("p0-disposable-value-protection\u0000", "utf8")
      .update(input.seed, "utf8")
      .digest(),
  });
}

export function isP0TrustedWriterProtectedValue(
  value: P0TrustedWriterProtectedValue | null | undefined,
): value is P0TrustedWriterProtectedValue {
  return validEnvelope(value);
}
