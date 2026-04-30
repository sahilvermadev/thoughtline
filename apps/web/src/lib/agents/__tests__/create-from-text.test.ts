import { describe, it, expect } from "vitest";
import type { LLMProvider, LLMMessage } from "@thoughtline/shared";
import { createAgentArchive } from "../../agent-archive/index";
import { createMemoryStorage } from "../../storage/memory";
import { createAgentFromText } from "../create-from-text";
import type { EncryptionKey } from "../../crypto/index";

function fakeLLM(
  responses: string[],
  onChat?: (messages: LLMMessage[]) => void
): LLMProvider {
  let callIndex = 0;
  return {
    async chat(messages: LLMMessage[]) {
      onChat?.(messages);
      const content = responses[callIndex++];
      if (!content) throw new Error("No more fake LLM responses");
      return { content };
    },
    async *chatStream() {
      throw new Error("Not used in these tests");
    },
  };
}

const validWorldview = {
  values: ["curiosity", "honesty"],
  heuristics: ["Seek first to understand"],
  blindspots: ["Overvalues novelty"],
  decisionStyle: "analytical" as const,
  freeform: "A thoughtful analyst who values truth.",
};

const validSkill = {
  id: "analyze-tradeoffs",
  name: "Analyze Tradeoffs",
  description: "Helps compare decisions through explicit tradeoffs.",
  skillMarkdown: `---
name: Analyze Tradeoffs
description: Helps compare decisions through explicit tradeoffs.
---

## When to Use

Use this for difficult choices.

## Inputs

- A decision prompt

## Procedure

1. Identify options.
2. Compare tradeoffs.

## Output

Return a recommendation.`,
  source: "genesis" as const,
  parentSkillIds: [],
};

const validExtraction = {
  privateWorldview: validWorldview,
};
const validSkillsExtraction = { skills: [validSkill] };

describe("createAgentFromText", () => {
  it("creates an agent from a single source with worldview and description", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM([
      // First call: extract worldview from sources
      JSON.stringify(validExtraction),
      // Second call: synthesize public skill packages
      JSON.stringify(validSkillsExtraction),
      // Third call: generate description
      "A curious and honest advisor who values truth above all.",
    ]);

    const agent = await createAgentFromText(
      {
        name: "The Analyst",
        sources: [{ text: "I believe in curiosity and honesty above all." }],
        encryptionKey: testKey(),
      },
      { llm, archive }
    );

    expect(agent.name).toBe("The Analyst");
    expect(agent.privateWorldview).toEqual(validWorldview);
    expect(agent.skills).toEqual([validSkill]);
    expect(agent.description).toBe(
      "A curious and honest advisor who values truth above all."
    );
    expect(agent.generation).toBe(0);
    expect(agent.parentIds).toBeNull();
    expect(agent.publicUri).toBeTruthy();
    expect(agent.privateUri).toBeTruthy();
    expect(agent.dataHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify it was actually stored
    const fetched = await archive.load(
      agent.publicUri,
      agent.privateUri,
      testKey()
    );
    expect(fetched.publicProfile.name).toBe("The Analyst");
    expect(fetched.privateWorldview).toEqual(validWorldview);
  });

  it("includes multiple labeled sources in the LLM prompt", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    let capturedPrompt = "";
    const llm = fakeLLM(
      [
        JSON.stringify(validExtraction),
        JSON.stringify(validSkillsExtraction),
        "A description.",
      ],
      (messages) => {
        // Capture the first call's user message (worldview extraction)
        if (!capturedPrompt) {
          const userMsg = messages.find((m) => m.role === "user");
          capturedPrompt = userMsg?.content ?? "";
        }
      }
    );

    await createAgentFromText(
      {
        name: "Test",
        sources: [
          { label: "blog post", text: "I value freedom." },
          { label: "book excerpt", text: "Discipline is the path." },
          { text: "Always question authority." },
        ],
        encryptionKey: testKey(),
      },
      { llm, archive }
    );

    expect(capturedPrompt).toContain("Source 1 (blog post)");
    expect(capturedPrompt).toContain("I value freedom.");
    expect(capturedPrompt).toContain("Source 2 (book excerpt)");
    expect(capturedPrompt).toContain("Discipline is the path.");
    expect(capturedPrompt).toContain("Source 3");
    expect(capturedPrompt).not.toContain("Source 3 ("); // no label for source 3
    expect(capturedPrompt).toContain("Always question authority.");
  });

  it("summarizes sources individually when total text exceeds threshold", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const chatCalls: LLMMessage[][] = [];

    // Large text: 3 sources each over 20k chars
    const largeText = "x".repeat(20_000);

    const llm: LLMProvider = {
      async chat(messages: LLMMessage[]) {
        chatCalls.push(messages);
        const callNum = chatCalls.length;

        // Calls 1-3: summarize each source
        if (callNum <= 3) return { content: `Summary of source ${callNum}.` };
        // Call 4: extract worldview from summaries
        if (callNum === 4) return { content: JSON.stringify(validExtraction) };
        // Call 5: synthesize skills
        if (callNum === 5) {
          return { content: JSON.stringify(validSkillsExtraction) };
        }
        // Call 6: generate description
        return { content: "A description." };
      },
      async *chatStream() {
        throw new Error("Not used");
      },
    };

    await createAgentFromText(
      {
        name: "Test",
        sources: [
          { label: "book 1", text: largeText },
          { label: "book 2", text: largeText },
          { label: "book 3", text: largeText },
        ],
        encryptionKey: testKey(),
      },
      { llm, archive }
    );

    // Should have 6 calls: 3 summarize + 1 worldview + 1 skills + 1 description
    expect(chatCalls.length).toBe(6);

    // The worldview extraction call (4th) should contain summaries, not raw text
    const worldviewCall = chatCalls[3];
    const userMsg = worldviewCall.find((m) => m.role === "user")!.content;
    expect(userMsg).toContain("Summary of source 1");
    expect(userMsg).toContain("Summary of source 2");
    expect(userMsg).toContain("Summary of source 3");
    expect(userMsg).not.toContain("x".repeat(100)); // raw text should NOT be in the prompt
  });

  it("rejects empty sources array", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM([]);

    await expect(
      createAgentFromText(
        { name: "Test", sources: [], encryptionKey: testKey() },
        { llm, archive }
      )
    ).rejects.toThrow(/at least one source/i);
  });

  it("rejects empty name", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM([
      JSON.stringify(validExtraction),
      JSON.stringify(validSkillsExtraction),
    ]);

    await expect(
      createAgentFromText(
        { name: "", sources: [{ text: "some text" }], encryptionKey: testKey() },
        { llm, archive }
      )
    ).rejects.toThrow(/name is required/i);
  });
});

function testKey(): EncryptionKey {
  return new Uint8Array(32).fill(2);
}
