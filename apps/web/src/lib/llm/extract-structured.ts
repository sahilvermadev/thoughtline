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

      const repaired = await tryRepairStructuredOutput(
        llm,
        response.content,
        lastError,
        schema
      );
      if (repaired.ok) return repaired.value;

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

async function tryRepairStructuredOutput<T>(
  llm: LLMProvider,
  invalidContent: string,
  error: Error,
  schema: z.ZodType<T>
): Promise<{ ok: true; value: T } | { ok: false }> {
  const response = await llm.chat([
    {
      role: "system",
      content:
        "You repair malformed JSON. Return valid JSON only. Do not add markdown fences or explanations.",
    },
    {
      role: "user",
      content: `Repair this response into valid JSON that preserves the same data and matches the requested schema. Error: ${error.message}

Malformed response:
${invalidContent}`,
    },
  ]);

  try {
    const parsed = JSON.parse(extractJsonText(response.content));
    return { ok: true, value: schema.parse(parsed) };
  } catch {
    return { ok: false };
  }
}

function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced) return fenced[1].trim();

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1);
  }

  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) {
    return trimmed.slice(firstArray, lastArray + 1);
  }

  return trimmed;
}
