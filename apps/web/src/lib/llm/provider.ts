import type { LLMProvider } from "@thoughtline/shared";
import { createOpenRouterProvider } from "./openrouter-provider";
import { createZeroGComputeProvider } from "./zero-g-compute-provider";
import { createZeroGRouterProvider } from "./zero-g-router-provider";
import type {
  LLMUseCase,
  ProviderConfig,
  ProviderName,
  ProviderRoutingConfig,
} from "./types";

export type {
  LLMUseCase,
  ProviderConfig,
  ProviderName,
  ProviderRoutingConfig,
} from "./types";

export function createProvider(
  provider: ProviderName,
  config: ProviderConfig
): LLMProvider {
  switch (provider) {
    case "openrouter":
      return createOpenRouterProvider(config);
    case "0g-compute":
      return createZeroGComputeProvider(config);
    case "0g-router":
      return createZeroGRouterProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

export function createProviderForUseCase(
  useCase: LLMUseCase,
  config: ProviderRoutingConfig
): LLMProvider {
  const provider =
    useCase === "breeding-worldview" || useCase === "breeding-skills"
      ? config.breedingProvider ?? config.defaultProvider
      : config.defaultProvider;
  const providerConfig = config.providers[provider];

  if (!providerConfig) {
    throw new Error(`Missing config for LLM provider: ${provider}`);
  }

  return createProvider(provider, providerConfig);
}

export function createProviderForUseCaseFromEnv(
  useCase: LLMUseCase,
  env: Record<string, string | undefined> = process.env
): LLMProvider {
  const defaultProvider = parseProviderName(env.LLM_PROVIDER ?? "openrouter");
  const breedingProvider = env.BREEDING_LLM_PROVIDER
    ? parseProviderName(env.BREEDING_LLM_PROVIDER)
    : undefined;
  const selectedProvider =
    useCase === "breeding-worldview" || useCase === "breeding-skills"
      ? breedingProvider ?? defaultProvider
      : defaultProvider;

  return createProviderForUseCase(useCase, {
    defaultProvider,
    breedingProvider,
    providers: {
      openrouter:
        selectedProvider === "openrouter"
          ? {
              apiKey: requireEnv("OPENROUTER_API_KEY", env),
              model: env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet",
            }
          : undefined,
      "0g-compute":
        selectedProvider === "0g-compute"
          ? {
              providerAddress: requireEnv("OG_COMPUTE_PROVIDER_ADDRESS", env),
              privateKey: requireAnyEnv(["OG_PRIVATE_KEY", "PRIVATE_KEY"], env),
              rpcUrl:
                env.OG_RPC_URL ??
                env.RPC_URL ??
                "https://evmrpc-testnet.0g.ai",
              model: env.OG_COMPUTE_MODEL ?? "",
            }
          : undefined,
      "0g-router":
        selectedProvider === "0g-router"
          ? {
              apiKey: requireEnv("OG_ROUTER_API_KEY", env),
              model: env.OG_ROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324",
              baseUrl: env.OG_ROUTER_BASE_URL ?? "https://router-api.0g.ai/v1",
            }
          : undefined,
    },
  });
}

function parseProviderName(value: string): ProviderName {
  if (value === "openrouter" || value === "0g-compute" || value === "0g-router") {
    return value;
  }
  throw new Error(`Unknown LLM provider: ${value}`);
}

function requireEnv(
  name: string,
  env: Record<string, string | undefined>
): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requireAnyEnv(
  names: string[],
  env: Record<string, string | undefined>
): string {
  for (const name of names) {
    const value = env[name];
    if (value) return value;
  }

  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}
