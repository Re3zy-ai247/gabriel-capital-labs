import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";
import { buildParserV2ShadowAccount } from "./parserV2";
import {
  isVerifiedP0ParserShadowEnvelope,
  type P0BureauReportEvidence,
  type P0ParserSourceBinding,
  type VerifiedP0ParserShadowEnvelope,
} from "./parserShadowEnvelope";
import {
  CREDIT_BUREAUS,
  PARSER_V2_ROLLOUT_MODE,
  type CreditTruthShadowAccount,
} from "./types";

export const P0_PARSER_SHADOW_ADAPTER_VERSION = "p0-parser-shadow-adapter-v2" as const;

export interface P0ParserShadowCoverageRecord {
  readonly bureau: Bureau;
  readonly status: "COVERED" | "OUTSIDE_COVERAGE";
}

export interface P0ParserShadowAccountRecord {
  readonly bureau: Bureau;
  readonly sourceAccountKey: string;
  readonly shadow: CreditTruthShadowAccount;
}

export interface P0AdaptedParserShadowEnvelope {
  readonly contractVersion: typeof P0_PARSER_SHADOW_ADAPTER_VERSION;
  readonly rolloutMode: typeof PARSER_V2_ROLLOUT_MODE;
  readonly legacyWriteAllowed: false;
  readonly parser: "AI_V2" | "REGEX_V2";
  readonly parserVersion: string;
  readonly source: P0ParserSourceBinding;
  readonly status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  readonly coverage: readonly P0ParserShadowCoverageRecord[];
  readonly accounts: readonly P0ParserShadowAccountRecord[];
  readonly bureauEvidence: readonly P0BureauReportEvidence[];
  readonly safeErrorCodes: readonly string[];
  readonly sourceSetSha256: string;
}

export type P0ParserShadowAdapterResult =
  | { readonly ok: true; readonly kind: "ADAPTED"; readonly value: P0AdaptedParserShadowEnvelope }
  | { readonly ok: false; readonly kind: "DENIED"; readonly code: string };

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested && typeof nested === "object" && !Object.isFrozen(nested)) deepFreeze(nested);
    }
  }
  return value;
}

/**
 * Adapts one exact bureau at a time. Even a tri-merge envelope is never passed
 * to parser-v2 as a shared flattened account input.
 */
export function adaptP0ParserShadowEnvelope(
  envelope: VerifiedP0ParserShadowEnvelope,
): P0ParserShadowAdapterResult {
  if (!isVerifiedP0ParserShadowEnvelope(envelope)) {
    return { ok: false, kind: "DENIED", code: "UNVERIFIED_PARSER_ENVELOPE" };
  }

  const coverage = CREDIT_BUREAUS.map((bureau) =>
    Object.freeze({
      bureau,
      status: envelope.coveredBureaus.includes(bureau)
        ? ("COVERED" as const)
        : ("OUTSIDE_COVERAGE" as const),
    }),
  );
  const accounts: P0ParserShadowAccountRecord[] = [];
  try {
    for (const unit of envelope.accounts) {
      const shadow = buildParserV2ShadowAccount(unit.account, {
        parser: envelope.parser,
        parserVersion: envelope.parserVersion,
        coveredBureaus: [unit.bureau],
      });
      if (
        shadow.legacyWriteAllowed !== false ||
        shadow.rolloutMode !== PARSER_V2_ROLLOUT_MODE ||
        shadow.coveredBureaus.length !== 1 ||
        shadow.coveredBureaus[0] !== unit.bureau ||
        !shadow.bureaus[unit.bureau].coveredBySource
      ) {
        return { ok: false, kind: "DENIED", code: "BUREAU_SCOPE_ATTESTATION_FAILED" };
      }
      for (const other of CREDIT_BUREAUS) {
        if (other !== unit.bureau && shadow.bureaus[other].coveredBySource) {
          return { ok: false, kind: "DENIED", code: "CROSS_BUREAU_FANOUT" };
        }
      }
      accounts.push(
        deepFreeze({
          bureau: unit.bureau,
          sourceAccountKey: unit.account.sourceAccountKey,
          shadow,
        }),
      );
    }
  } catch {
    return { ok: false, kind: "DENIED", code: "PARSER_ADAPTATION_FAILED" };
  }

  const sourceSetSha256 = digest({
    source: {
      ingestionId: envelope.source.ingestionId,
      artifactId: envelope.source.artifactId,
      artifactVersion: envelope.source.artifactVersion,
      sha256: envelope.source.sha256,
      normalizationVersion: envelope.source.normalizationVersion,
    },
    coverage: coverage.map((item) => [item.bureau, item.status]),
    accounts: accounts.map((item) => [item.bureau, item.sourceAccountKey]),
    reportDates: envelope.bureauEvidence.map((item) => [
      item.bureau,
      item.reportDate.presence,
      item.reportDate.precision,
      item.reportDate.presence === "PRESENT" ? item.reportDate.value : null,
      item.reportDate.presence === "UNKNOWN" ? null : item.reportDate.sourceLocator,
    ]),
    scores: envelope.bureauEvidence.flatMap((item) =>
      item.scores.map((score) => [
        item.bureau,
        score.occurrence,
        score.presence,
        score.model.presence,
        score.model.presence === "PRESENT" ? score.model.modelValue : null,
        score.model.presence !== "UNKNOWN" ? score.model.sourceLocator : null,
        score.presence !== "UNKNOWN" ? score.sourceLocator : null,
        score.presence === "PRESENT" ? score.scaleMin : null,
        score.presence === "PRESENT" ? score.scaleMax : null,
        score.presence === "PRESENT" ? score.confidence : null,
      ]),
    ),
    identity: envelope.bureauEvidence.flatMap((item) =>
      item.identity.map((fact) => [item.bureau, fact.factKey, fact.factType, fact.presence]),
    ),
    round0Completeness: envelope.bureauEvidence.flatMap((item) =>
      item.round0Completeness.map((evidence) => [
        item.bureau,
        evidence.category,
        evidence.status,
        evidence.sourceLocator ?? null,
        evidence.ruleKey,
        evidence.ruleVersion,
      ]),
    ),
  });

  const value = deepFreeze({
    contractVersion: P0_PARSER_SHADOW_ADAPTER_VERSION,
    rolloutMode: PARSER_V2_ROLLOUT_MODE,
    legacyWriteAllowed: false as const,
    parser: envelope.parser,
    parserVersion: envelope.parserVersion,
    source: structuredClone(envelope.source),
    status: envelope.status,
    coverage,
    accounts,
    bureauEvidence: structuredClone(envelope.bureauEvidence),
    safeErrorCodes: [...envelope.safeErrorCodes],
    sourceSetSha256,
  });
  return { ok: true, kind: "ADAPTED", value };
}
