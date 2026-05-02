import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { LLMProvider, LLMMessage } from "@thoughtline/shared";
import { extractStructured } from "../extract-structured";

function fakeLLM(responses: string[]): LLMProvider {
  let i = 0;
  return {
    async chat() {
      return { content: responses[i++] ?? "" };
    },
    async *chatStream() {
      throw new Error("Not used");
    },
  };
}

const testSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
});

describe("extractStructured", () => {
  it("calls LLM, parses JSON, and validates against the schema", async () => {
    const llm = fakeLLM([JSON.stringify({ name: "Alice", score: 85 })]);

    const result = await extractStructured(
      llm,
      [{ role: "user", content: "Rate Alice" }],
      testSchema
    );

    expect(result).toEqual({ name: "Alice", score: 85 });
  });

  it("accepts JSON wrapped in a markdown code fence", async () => {
    const llm = fakeLLM([
      '```json\n{"name":"Alice","score":85}\n```',
    ]);

    const result = await extractStructured(
      llm,
      [{ role: "user", content: "Rate Alice" }],
      testSchema
    );

    expect(result).toEqual({ name: "Alice", score: 85 });
  });

  it("retries once when LLM returns invalid JSON, sending the error back", async () => {
    const calls: LLMMessage[][] = [];
    const llm: LLMProvider = {
      async chat(messages) {
        calls.push(messages);
        if (calls.length === 1) return { content: "not json at all" };
        return { content: JSON.stringify({ name: "Bob", score: 50 }) };
      },
      async *chatStream() {
        throw new Error("Not used");
      },
    };

    const result = await extractStructured(
      llm,
      [{ role: "user", content: "Rate Bob" }],
      testSchema
    );

    expect(result).toEqual({ name: "Bob", score: 50 });
    expect(calls.length).toBe(2);
    // Second call should include the error message
    const retryMessages = calls[1];
    const lastMsg = retryMessages[retryMessages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toMatch(/invalid|error|json/i);
  });

  it("retries on Zod validation failure", async () => {
    const llm: LLMProvider = {
      async chat(messages) {
        // First call: valid JSON but fails schema (score > 100)
        if (messages.length <= 2) {
          return { content: JSON.stringify({ name: "Eve", score: 200 }) };
        }
        // Retry: valid
        return { content: JSON.stringify({ name: "Eve", score: 95 }) };
      },
      async *chatStream() {
        throw new Error("Not used");
      },
    };

    const result = await extractStructured(
      llm,
      [{ role: "user", content: "Rate Eve" }],
      testSchema
    );

    expect(result).toEqual({ name: "Eve", score: 95 });
  });

  it("throws after max retries are exhausted", async () => {
    const llm = fakeLLM(["bad", "still bad", "nope"]);

    await expect(
      extractStructured(
        llm,
        [{ role: "user", content: "Rate someone" }],
        testSchema,
        { maxRetries: 2 }
      )
    ).rejects.toThrow();
  });
});
