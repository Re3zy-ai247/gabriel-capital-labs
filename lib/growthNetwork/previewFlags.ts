// Server-only-by-allowlist review control for the Growth Center Foundation Preview.
// This is independent from the dormant Growth Network master flag: a visual review
// can never represent program or economic activation.

export function growthCenterPreviewEnabled(): boolean {
  return process.env.GROWTH_CENTER_PREVIEW_ENABLED === "true";
}
