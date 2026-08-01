// Run: node --import tsx scripts/growth-capability-preview-env-matrix.test.ts
//
// Adversarial server-identity matrix for Founder Preview gating. VERCEL_ENV is
// the only hosted-environment authority. Public presentation hints and the
// local capture override may never authorize hosted production or an unknown /
// malformed hosted identity.
import { reviewServerBuildAllowed } from "../lib/cxos/reviewMode";
import { growthCapabilityContractPreviewEnabled } from "../lib/growthNetwork/capabilityPreviewFlags";
import { growthCenterPreviewEnabled } from "../lib/growthNetwork/previewFlags";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${label}`);
  }
}

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL",
  "VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_CXOS_REVIEW",
  "GROWTH_CENTER_PREVIEW_ENABLED",
  "GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED",
] as const;
const mutableEnv = process.env as Record<string, string | undefined>;
const prior = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function setEnv(
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
): void {
  for (const key of ENV_KEYS) delete mutableEnv[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) mutableEnv[key] = value;
  }
}

const publicValues = [undefined, "production", "preview", "development", "invalid"] as const;
const overrideValues = [undefined, "1", "true", "TRUE", " 1"] as const;
const nodeValues = ["production", "development", "test"] as const;
const subordinateValues = [undefined, "true", "false", "TRUE", "1", " true"] as const;

function compositeRouteAllowed(): boolean {
  return reviewServerBuildAllowed()
    && growthCenterPreviewEnabled()
    && growthCapabilityContractPreviewEnabled();
}

try {
  // Canonical hosted production is hard-off under every public/manual/node
  // combination. Deliberately test with and without VERCEL=1: VERCEL_ENV alone
  // is sufficient to identify a hosted build.
  for (const vercelMarker of [undefined, "1"] as const) {
    for (const publicIdentity of publicValues) {
      for (const override of overrideValues) {
        for (const nodeEnv of nodeValues) {
          setEnv({
            NODE_ENV: nodeEnv,
            VERCEL: vercelMarker,
            VERCEL_ENV: "production",
            NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
            NEXT_PUBLIC_CXOS_REVIEW: override,
          });
          check(
            `hosted production denies marker=${String(vercelMarker)} public=${String(publicIdentity)} override=${String(override)} node=${nodeEnv}`,
            reviewServerBuildAllowed() === false,
          );
        }
      }
    }
  }

  // Any present but non-preview canonical identity is unknown/malformed and
  // therefore fails closed. Public "preview" and the manual override cannot
  // upgrade it.
  for (const hostedIdentity of ["", "development", "staging", "Preview", " preview", "preview "] as const) {
    for (const publicIdentity of publicValues) {
      for (const override of overrideValues) {
        setEnv({
          NODE_ENV: "production",
          VERCEL: "1",
          VERCEL_ENV: hostedIdentity,
          NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
          NEXT_PUBLIC_CXOS_REVIEW: override,
        });
        check(
          `malformed hosted identity denies canonical=${JSON.stringify(hostedIdentity)} public=${String(publicIdentity)} override=${String(override)}`,
          reviewServerBuildAllowed() === false,
        );
      }
    }
  }

  // A hosted build with a missing canonical identity is unknown and closed.
  for (const publicIdentity of publicValues) {
    for (const override of overrideValues) {
      for (const nodeEnv of nodeValues) {
        setEnv({
          NODE_ENV: nodeEnv,
          VERCEL: "1",
          NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
          NEXT_PUBLIC_CXOS_REVIEW: override,
        });
        check(
          `hosted missing identity denies public=${String(publicIdentity)} override=${String(override)} node=${nodeEnv}`,
          reviewServerBuildAllowed() === false,
        );
      }
    }
  }

  // A hosted Preview is valid only under Next's exact production runtime
  // identity. Missing or contradictory Node identity tightens the gate.
  for (const nodeEnv of [undefined, "development", "test", "Production"] as const) {
    setEnv({
      NODE_ENV: nodeEnv,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_VERCEL_ENV: "preview",
      NEXT_PUBLIC_CXOS_REVIEW: "1",
    });
    check(
      `hosted preview denies contradictory Node identity ${String(nodeEnv)}`,
      reviewServerBuildAllowed() === false,
    );
  }

  // Composite route authorization is denied for every subordinate flag pair,
  // public hint, and override when hosted identity is production, missing,
  // malformed, or otherwise contradictory. This proves the subordinate flags
  // can only narrow an already-authorized exact Preview.
  const closedHostedCases = [
    { marker: "1", identity: "production" },
    { marker: "1", identity: undefined },
    { marker: "1", identity: "" },
    { marker: "0", identity: "preview" },
  ] as const;
  for (const hostedCase of closedHostedCases) {
    for (const publicIdentity of publicValues) {
      for (const override of overrideValues) {
        for (const centerFlag of subordinateValues) {
          for (const contractFlag of subordinateValues) {
            setEnv({
              NODE_ENV: "production",
              VERCEL: hostedCase.marker,
              VERCEL_ENV: hostedCase.identity,
              NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
              NEXT_PUBLIC_CXOS_REVIEW: override,
              GROWTH_CENTER_PREVIEW_ENABLED: centerFlag,
              GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED: contractFlag,
            });
            check(
              `composite hosted denial marker=${JSON.stringify(hostedCase.marker)} canonical=${String(hostedCase.identity)} public=${String(publicIdentity)} override=${String(override)} center=${String(centerFlag)} contract=${String(contractFlag)}`,
              compositeRouteAllowed() === false,
            );
          }
        }
      }
    }
  }

  // Under the sole authorized hosted identity, both subordinate flags must be
  // the exact value "true". Malformed and missing subordinate values fail
  // closed; public contradictions still tighten the gate.
  for (const publicIdentity of publicValues) {
    for (const override of overrideValues) {
      for (const centerFlag of subordinateValues) {
        for (const contractFlag of subordinateValues) {
          setEnv({
            NODE_ENV: "production",
            VERCEL: "1",
            VERCEL_ENV: "preview",
            NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
            NEXT_PUBLIC_CXOS_REVIEW: override,
            GROWTH_CENTER_PREVIEW_ENABLED: centerFlag,
            GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED: contractFlag,
          });
          const expected =
            (publicIdentity === undefined || publicIdentity === "preview")
            && centerFlag === "true"
            && contractFlag === "true";
          check(
            `composite hosted preview public=${String(publicIdentity)} override=${String(override)} center=${String(centerFlag)} contract=${String(contractFlag)}`,
            compositeRouteAllowed() === expected,
          );
        }
      }
    }
  }

  // Any present Vercel marker other than the exact platform value "1" is
  // malformed hosted evidence. It stays closed even when the canonical or
  // public identity says preview and the local capture override is asserted.
  for (const malformedMarker of ["", "0", "true", "TRUE", " 1", "1 "] as const) {
    for (const hostedIdentity of [undefined, "preview", "production"] as const) {
      for (const override of overrideValues) {
        setEnv({
          NODE_ENV: "production",
          VERCEL: malformedMarker,
          VERCEL_ENV: hostedIdentity,
          NEXT_PUBLIC_VERCEL_ENV: "preview",
          NEXT_PUBLIC_CXOS_REVIEW: override,
        });
        check(
          `malformed Vercel marker denies marker=${JSON.stringify(malformedMarker)} canonical=${String(hostedIdentity)} override=${String(override)}`,
          reviewServerBuildAllowed() === false,
        );
      }
    }
  }

  // Preview is the sole hosted allow state. An absent or matching public hint
  // is acceptable; a contradictory/malformed public value closes the gate.
  for (const publicIdentity of publicValues) {
    for (const override of overrideValues) {
      setEnv({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
        NEXT_PUBLIC_CXOS_REVIEW: override,
      });
      const expected = publicIdentity === undefined || publicIdentity === "preview";
      check(
        `canonical preview handles public=${String(publicIdentity)} override=${String(override)}`,
        reviewServerBuildAllowed() === expected,
      );
    }
  }

  // A public hint can never manufacture a hosted identity.
  for (const publicIdentity of ["production", "preview", "development", "invalid"] as const) {
    for (const override of overrideValues) {
      setEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_VERCEL_ENV: publicIdentity,
        NEXT_PUBLIC_CXOS_REVIEW: override,
      });
      check(
        `public-only identity denies public=${publicIdentity} override=${String(override)}`,
        reviewServerBuildAllowed() === false,
      );
    }
  }

  // Local development and the exact local-production capture override remain
  // available only when every hosted/public identity signal is absent.
  setEnv({ NODE_ENV: "development" });
  check("identity-free local development is allowed", reviewServerBuildAllowed());

  for (const override of overrideValues) {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_CXOS_REVIEW: override });
    check(
      `local production requires exact capture override ${String(override)}`,
      reviewServerBuildAllowed() === (override === "1"),
    );
  }

  setEnv({ NODE_ENV: "test", NEXT_PUBLIC_CXOS_REVIEW: "1" });
  check("manual override cannot authorize an unknown non-production local identity", !reviewServerBuildAllowed());
} finally {
  for (const key of ENV_KEYS) {
    const value = prior[key];
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  }
}

console.log(
  `\ngrowth-capability-preview-env-matrix.test.ts: ${passed} passed, ${failed} failed`,
);
process.exit(failed ? 1 : 0);
