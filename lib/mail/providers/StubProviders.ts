// Interface-conformant placeholders for the future providers. Each implements
// the FULL MailProvider contract so the registry, MailService, and every caller
// treat them identically to LetterStream — only the implementation is pending.
// Every method throws MailProviderError("not_implemented") so nothing silently
// no-ops. To add a provider for real: replace its class body, keeping the id.
import {
  MailProviderError,
  type MailProvider, type MailProviderId, type MailAddress, type AddressValidationResult,
  type MailPieceSpec, type CostEstimate, type CreateJobInput, type CreateJobResult,
  type ProviderStatus, type TrackingInfo, type ProofArtifact, type HealthStatus,
} from "../MailProvider";

abstract class StubProvider implements MailProvider {
  abstract readonly id: MailProviderId;
  abstract readonly name: string;
  private ni(method: string): never {
    throw new MailProviderError("not_implemented", this.id, `${this.name}.${method} is not implemented yet.`);
  }
  async validateAddress(_address: MailAddress): Promise<AddressValidationResult> { return this.ni("validateAddress"); }
  async estimateCost(_spec: MailPieceSpec): Promise<CostEstimate> { return this.ni("estimateCost"); }
  async createMailJob(_input: CreateJobInput): Promise<CreateJobResult> { return this.ni("createMailJob"); }
  async cancelMailJob(_providerJobId: string): Promise<{ canceled: boolean }> { return this.ni("cancelMailJob"); }
  async retrieveStatus(_providerJobId: string): Promise<ProviderStatus> { return this.ni("retrieveStatus"); }
  async retrieveTracking(_providerJobId: string): Promise<TrackingInfo> { return this.ni("retrieveTracking"); }
  async retrieveProof(_providerJobId: string): Promise<ProofArtifact[]> { return this.ni("retrieveProof"); }
  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, detail: `${this.name} not implemented`, checkedAt: "" };
  }
}

export class LobProvider extends StubProvider {
  readonly id = "lob" as const;
  readonly name = "Lob";
}
export class PostGridProvider extends StubProvider {
  readonly id = "postgrid" as const;
  readonly name = "PostGrid";
}
export class Click2MailProvider extends StubProvider {
  readonly id = "click2mail" as const;
  readonly name = "Click2Mail";
}
export class PostalMethodsProvider extends StubProvider {
  readonly id = "postalmethods" as const;
  readonly name = "PostalMethods";
}
