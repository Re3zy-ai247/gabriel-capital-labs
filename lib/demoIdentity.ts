export const DEMO_EMAIL = "demo@gabrielcapitallabs.com";

export function isDemoIdentityBlocked(
  nodeEnv: string | undefined,
  email: string | null | undefined,
): boolean {
  return nodeEnv !== "development" && email?.trim().toLowerCase() === DEMO_EMAIL;
}
