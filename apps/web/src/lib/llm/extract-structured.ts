import type { LLMProvider, LLMMessage } from "@thoughtline/shared";
import type { z } from "zod";

export interface ExtractOptions {
  maxRetries?: number;
}

export async function extractStructured<T>(
  llm: LLMProvider,
  messages: LLMMessage[],
  schema: z.ZodType<T>,
  options?: ExtractOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  let lastError: Error | null = null;
  let currentMessages = [...messages];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await llm.chat([
      { role: "system", content: "You output valid JSON only." },
      ...currentMessages,
    ]);

    try {
      const parsed = JSON.parse(extractJsonText(response.content));
      return schema.parse(parsed);
    } catch (e) {
      lastError = e as Error;

      // Build retry messages with the error
      currentMessages = [
        ...messages,
        { role: "assistant" as const, content: response.content },
        {
          role: "user" as const,
          content: `Your response was invalid JSON or failed validation. Error: ${lastError.message}\n\nPlease try again. Respond ONLY with valid JSON matching the requested schema.`,
        },
      ];
    }
  }

  throw new Error(
    `Failed to extract structured data after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}

function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}
