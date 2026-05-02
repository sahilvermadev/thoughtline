import type { LLMMessage, LLMProvider, LLMResponse } from "@thoughtline/shared";
import type { ProviderConfig } from "./types";
import { readSSEContentStream, requireConfig } from "./response-utils";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function createOpenRouterProvider(config: ProviderConfig): LLMProvider {
  const apiKey = requireConfig("apiKey", config.apiKey, "openrouter");
  const model = requireConfig("model", config.model, "openrouter");

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
      yield* readSSEContentStream(res, "OpenRouter");
    },
  };
}
