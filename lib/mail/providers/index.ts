// The provider registry — the ONE place a provider is chosen. Switching the
// platform's mail provider is a single config value (MAIL_PROVIDER); no business
// logic, UI, or Kai code changes. Callers ask MailService, which asks here.
import type { MailProvider, MailProviderId } from "../MailProvider";
import { LetterStreamProvider } from "./LetterStreamProvider";
import { LobProvider, PostGridProvider, Click2MailProvider, PostalMethodsProvider } from "./StubProviders";

// Lazily constructed singletons so a stub provider is never instantiated with
// side effects until actually requested.
const FACTORIES: Record<MailProviderId, () => MailProvider> = {
  letterstream: () => new LetterStreamProvider(),
  lob: () => new LobProvider(),
  postgrid: () => new PostGridProvider(),
  click2mail: () => new Click2MailProvider(),
  postalmethods: () => new PostalMethodsProvider(),
};

const cache = new Map<MailProviderId, MailProvider>();

export const DEFAULT_PROVIDER: MailProviderId = "letterstream";

export function isProviderId(v: string): v is MailProviderId {
  return v in FACTORIES;
}

// Resolve the active provider. Explicit id wins; otherwise MAIL_PROVIDER env;
// otherwise the default. An unknown env value falls back to the default rather
// than crashing the platform.
export function getMailProvider(id?: MailProviderId): MailProvider {
  const envId = process.env.MAIL_PROVIDER;
  const chosen: MailProviderId = id
    ?? (envId && isProviderId(envId) ? envId : DEFAULT_PROVIDER);
  let p = cache.get(chosen);
  if (!p) { p = FACTORIES[chosen](); cache.set(chosen, p); }
  return p;
}

export function listProviderIds(): MailProviderId[] {
  return Object.keys(FACTORIES) as MailProviderId[];
}
