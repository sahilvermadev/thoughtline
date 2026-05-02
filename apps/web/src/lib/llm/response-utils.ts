import type { LLMResponse } from "@thoughtline/shared";
import type { ProviderName } from "./types";

export function requireConfig(
  name: string,
  value: string | undefined,
  provider: ProviderName
): string {
  if (!value) throw new Error(`Missing config for LLM provider ${provider}: ${name}`);
  return value;
}

export function readAssistantContent(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data.choices)) return undefined;
  const firstChoice = data.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return undefined;
  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content
    : undefined;
}

export function readDeltaContent(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data.choices)) return undefined;
  const firstChoice = data.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.delta)) return undefined;
  return typeof firstChoice.delta.content === "string"
    ? firstChoice.delta.content
    : "";
}

export function readUsage(data: unknown): LLMResponse["usage"] {
  if (!isRecord(data) || !isRecord(data.usage)) return undefined;
  const inputTokens = data.usage.prompt_tokens;
  const outputTokens = data.usage.completion_tokens;
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number") {
    return undefined;
  }

  return { inputTokens, outputTokens };
}

export async function* readSSEContentStream(
  res: Response,
  providerName: string
): AsyncIterable<{ content: string; done: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error(`${providerName} stream response had no body`);

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        yield { content: "", done: true };
        return;
      }

      const parsed = JSON.parse(data);
      const content = readDeltaContent(parsed);
      if (content !== undefined) {
        yield { content, done: false };
      }
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
