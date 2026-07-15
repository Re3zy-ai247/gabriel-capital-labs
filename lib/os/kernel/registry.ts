// Plugin Registry (Sprint 1). The ONLY door into the OS. Modules register a domain
// prefix + capabilities; policy decision-providers and event subscribers register here
// too. The kernel routes resolution/dispatch to the registered owner of a domain — and
// nothing else can be invoked. Compiled/static (per the red-team: no runtime mutation).
import { domainOf } from "./namespace";
import type { CapabilityKey, CapabilitySpec, KaiModule, PolicyDecisionProvider } from "./types";

export interface Subscription { pattern: string; handler: (typeMatched: string) => void }

export class Registry {
  private modules = new Map<string, KaiModule>();       // domain -> module
  private specs = new Map<string, CapabilitySpec>();    // capability key -> spec
  private pdps: PolicyDecisionProvider[] = [];
  private subs: { pattern: string; handler: Subscription["handler"] }[] = [];

  // Register a module by its domain. A domain may be owned by exactly one module
  // (fail-closed on collision — prevents namespace squatting / silent override).
  registerModule(m: KaiModule): void {
    if (this.modules.has(m.id)) throw new Error(`kernel: domain "${m.id}" already registered`);
    for (const spec of m.capabilities()) {
      const d = domainOf(spec.key);
      if (d !== m.id) throw new Error(`kernel: capability "${spec.key}" is not in module domain "${m.id}"`);
      if (this.specs.has(spec.key)) throw new Error(`kernel: capability "${spec.key}" already registered`);
      this.specs.set(spec.key, spec);
    }
    this.modules.set(m.id, m);
  }

  registerPolicy(pdp: PolicyDecisionProvider): void { this.pdps.push(pdp); }
  subscribe(pattern: string, handler: Subscription["handler"]): void { this.subs.push({ pattern, handler }); }

  moduleFor(key: CapabilityKey): KaiModule | null {
    const d = domainOf(key);
    return d ? this.modules.get(d) ?? null : null;
  }
  spec(key: CapabilityKey): CapabilitySpec | null { return this.specs.get(key) ?? null; }
  allSpecs(): CapabilitySpec[] { return [...this.specs.values()]; } // the Marketplace catalog
  policies(): readonly PolicyDecisionProvider[] { return this.pdps; }
  subscribers(): readonly { pattern: string; handler: Subscription["handler"] }[] { return this.subs; }
  isRegistered(key: CapabilityKey): boolean { return this.specs.has(key); }
}
