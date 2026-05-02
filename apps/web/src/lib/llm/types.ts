export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  providerAddress?: string;
  privateKey?: string;
  rpcUrl?: string;
}

export type ProviderName = "openrouter" | "0g-compute" | "0g-router";

export type LLMUseCase =
  | "genesis"
  | "breeding-worldview"
  | "breeding-skills"
  | "conversation";

export interface ProviderRoutingConfig {
  defaultProvider: ProviderName;
  breedingProvider?: ProviderName;
  providers: {
    openrouter?: ProviderConfig;
    "0g-compute"?: ProviderConfig;
    "0g-router"?: ProviderConfig;
  };
}
