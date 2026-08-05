// Server-only review control for the Growth Experience Phase 1B annex.
// The parent Growth Center gate and production-hard-off review policy are also
// required by the route before any client stage import occurs.

export function growthCapabilityContractPreviewEnabled(): boolean {
  return process.env.GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED === "true";
}
