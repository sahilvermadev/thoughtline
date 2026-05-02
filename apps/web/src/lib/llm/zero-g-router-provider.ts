import type { LLMMessage, LLMProvider, LLMResponse } from "@thoughtline/shared";
import type { ProviderConfig } from "./types";
import {
  readAssistantContent,
  readSSEContentStream,
  readUsage,
  requireConfig,
} from "./response-utils";

export function createZeroGRouterProvider(config: ProviderConfig): LLMProvider {
  const apiKey = requireConfig("apiKey", config.apiKey, "0g-router");
  const model = requireConfig("model", config.model, "0g-router");
  const baseUrl = config.baseUrl ?? "https://router-api.0g.ai/v1";

  async function request(body: Record<string, unknown>): Promise<Response> {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, ...body }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`0G Router API error ${res.status}: ${text}`);
    }

    return res;
  }

  return {
    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
      const res = await request({ messages });
      const data = await res.json();
      const content = readAssistantContent(data);
      if (content === undefined) {
        throw new Error("0G Router response did not include assistant content");
      }

      return {
        content,
        usage: readUsage(data),
      };
    },

    async *chatStream(
      messages: LLMMessage[]
    ): AsyncIterable<{ content: string; done: boolean }> {
      const res = await request({ messages, stream: true });
      yield* readSSEContentStream(res, "0G Router");
    },
  };
}
