import type { P0Scope } from "./principal";
import type {
  P0ProtectedShadowValue,
  P0ShadowValueProtector,
} from "./shadowExtractionService";
import type { P0TrustedWriterValueProtectionAdapter } from "./trustedWriterValueProtection";

export const P0_TRUSTED_SHADOW_VALUE_PROTECTOR_VERSION =
  "p0-trusted-shadow-value-protector-v1" as const;

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

function aad(input: { readonly scope: P0Scope; readonly rowId: string }): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify([
      "CreditVector/P0/shadow-value/v1",
      input.scope.tenantId,
      input.scope.consumerId,
      input.rowId,
    ]),
  );
}

/**
 * Production-capable bridge from the common KMS/value-protection contract to
 * the accepted shadow graph port. Values and keys never enter authority
 * digests or logs; only the authenticated envelope is persisted.
 */
export function createP0TrustedShadowValueProtector(
  adapter: P0TrustedWriterValueProtectionAdapter,
): P0ShadowValueProtector {
  if (adapter?.adapterClass !== "AUTHENTICATED_PRODUCTION") {
    throw new Error("authenticated value-protection adapter required");
  }
  return Object.freeze({
    adapterClass: "AUTHENTICATED_PRODUCTION_VALUE_PROTECTION" as const,
    async protect(input: {
      readonly scope: P0Scope;
      readonly rowId: string;
      readonly value: unknown;
    }): Promise<P0ProtectedShadowValue | null> {
      if (
        !input?.scope ||
        !STABLE.test(input.scope.tenantId) ||
        !STABLE.test(input.scope.consumerId) ||
        !STABLE.test(input.rowId)
      ) {
        return null;
      }
      let plaintext: Uint8Array;
      try {
        const encoded = JSON.stringify(input.value);
        if (encoded === undefined) return null;
        plaintext = new TextEncoder().encode(encoded);
      } catch {
        return null;
      }
      if (plaintext.byteLength < 1 || plaintext.byteLength > 1_048_576) return null;
      const protectedValue = await adapter.protect({
        plaintext,
        aad: aad(input),
        envelopeVersion: "p0-production-shadow-value-v1",
        aadVersion: "p0-shadow-row-aad-v1",
      });
      if (!protectedValue) return null;
      return Object.freeze({
        ciphertextBase64: Buffer.from(protectedValue.ciphertext).toString("base64"),
        ivBase64: Buffer.from(protectedValue.iv).toString("base64"),
        authTagBase64: Buffer.from(protectedValue.authTag).toString("base64"),
        algorithm: protectedValue.algorithm,
        keyVersion: protectedValue.keyVersion,
        envelopeVersion: "p0-production-shadow-value-v1" as const,
        aadVersion: "p0-shadow-row-aad-v1" as const,
      });
    },
  });
}
