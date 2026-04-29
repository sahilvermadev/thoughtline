import type { LLMProvider, LLMMessage, LLMResponse } from "@thoughtline/shared";

export interface ProviderConfig {
  apiKey: string;
  model: string;
}

export type ProviderName = "openrouter" | "0g-compute";

export type LLMUseCase =
  | "genesis"
  | "breeding-worldview"
  | "breeding-skills"
  | "skill-invocation";

export interface ProviderRoutingConfig {
  defaultProvider: ProviderName;
  breedingProvider?: ProviderName;
  providers: {
    openrouter?: ProviderConfig;
    "0g-compute"?: ProviderConfig;
  };
}

export function createProvider(
  provider: ProviderName,
  config: ProviderConfig
): LLMProvider {
  switch (provider) {
    case "openrouter":
      return createOpenRouterProvider(config);
    case "0g-compute":
      return createZeroGComputeProvider();
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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function createOpenRouterProvider(config: ProviderConfig): LLMProvider {
  const { apiKey, model } = config;

  async function request(body: Record<string, unknown>): Promise<Response> {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, ...body }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${text}`);
    }

    return res;
  }

  return {
    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
      const res = await request({ messages });
      const data = await res.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        usage: data.usage
          ? {
              inputTokens: data.usage.prompt_tokens,
              outputTokens: data.usage.completion_tokens,
            }
          : undefined,
      };
    },

    async *chatStream(
      messages: LLMMessage[]
    ): AsyncIterable<{ content: string; done: boolean }> {
      const res = await request({ messages, stream: true });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            yield { content: "", done: true };
            return;
          }

          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content ?? "";
          if (content || parsed.choices[0]?.delta) {
            yield { content, done: false };
          }
        }
      }
    },
  };
}

function createZeroGComputeProvider(): LLMProvider {
  throw new Error(
    "0G Compute LLM provider is not implemented yet. Keep 0G SDK calls behind this adapter."
  );
}
