import { describe, it, expect } from "vitest";
import type { LLMProvider, SkillPackage, Worldview } from "@thoughtline/shared";
import { createAgentArchive } from "../../agent-archive/index.js";
import { createMemoryStorage } from "../../storage/memory.js";
import { forgeAgent } from "../forge-agent.js";
import type { EncryptionKey } from "../../crypto/index.js";

function fakeLLM(responses: string[]): LLMProvider {
  let i = 0;
  return {
    async chat() {
      const content = responses[i++];
      if (!content) throw new Error("No more fake LLM responses");
      return { content };
    },
    async *chatStream() {
      throw new Error("Not used");
    },
  };
}

const stubWorldview: Worldview = {
  values: ["discipline"],
  heuristics: ["Focus on what you can control"],
  blindspots: ["Undervalues emotion"],
  decisionStyle: "analytical",
  freeform: "A stoic.",
};

const stubSkills: SkillPackage[] = [
  {
    id: "reason-from-principles",
    name: "Reason From Principles",
    description: "Breaks decisions into durable first principles.",
    skillMarkdown: `---
name: Reason From Principles
description: Breaks decisions into durable first principles.
---

## When to Use

Use this for strategic decisions.

## Inputs

- A decision prompt

## Procedure

1. Identify first principles.
2. Weigh tradeoffs.

## Output

Return a recommendation.`,
    source: "genesis",
    parentSkillIds: [],
  },
];

describe("forgeAgent", () => {
  it("forges a genesis agent (no parents) at generation 0", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM(["A disciplined advisor."]);

    const forged = await forgeAgent(
      {
        name: "The Stoic",
        parents: null,
        encryptionKey: testKey(),
        synthesizeGenome: async () => ({
          privateWorldview: stubWorldview,
          skills: stubSkills,
        }),
      },
      { llm, archive }
    );

    expect(forged.name).toBe("The Stoic");
    expect(forged.privateWorldview).toEqual(stubWorldview);
    expect(forged.skills).toEqual(stubSkills);
    expect(forged.description).toBe("A disciplined advisor.");
    expect(forged.generation).toBe(0);
    expect(forged.parentIds).toBeNull();
    expect(forged.publicUri).toBeTruthy();
    expect(forged.privateUri).toBeTruthy();
    expect(forged.dataHash).toMatch(/^[0-9a-f]{64}$/);

    const loaded = await archive.load(
      forged.publicUri,
      forged.privateUri,
      testKey()
    );
    expect(loaded.publicProfile.name).toBe("The Stoic");
  });

  it("forges a child agent at max(parent generations) + 1 with parent IDs", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM(["A balanced advisor."]);

    const forged = await forgeAgent(
      {
        name: "The Balanced",
        parents: [
          { id: "parent-a", name: "Bold", generation: 0 },
          { id: "parent-b", name: "Sage", generation: 2 },
        ],
        encryptionKey: testKey(),
        synthesizeGenome: async () => ({
          privateWorldview: stubWorldview,
          skills: stubSkills,
        }),
      },
      { llm, archive }
    );

    expect(forged.generation).toBe(3);
    expect(forged.parentIds).toEqual(["parent-a", "parent-b"]);
  });

  it("includes parent names in the description prompt context", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    let capturedUserMsg = "";
    const llm: LLMProvider = {
      async chat(messages) {
        capturedUserMsg = messages.find((m) => m.role === "user")!.content;
        return { content: "desc" };
      },
      async *chatStream() {
        throw new Error("Not used");
      },
    };

    await forgeAgent(
      {
        name: "Child",
        parents: [
          { id: "a", name: "Marcus", generation: 0 },
          { id: "b", name: "Annie", generation: 0 },
        ],
        encryptionKey: testKey(),
        synthesizeGenome: async () => ({
          privateWorldview: stubWorldview,
          skills: stubSkills,
        }),
      },
      { llm, archive }
    );

    expect(capturedUserMsg).toContain("Marcus");
    expect(capturedUserMsg).toContain("Annie");
  });

  it("rejects empty name", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM([]);

    await expect(
      forgeAgent(
        {
          name: "",
          parents: null,
          encryptionKey: testKey(),
          synthesizeGenome: async () => ({
            privateWorldview: stubWorldview,
            skills: stubSkills,
          }),
        },
        { llm, archive }
      )
    ).rejects.toThrow(/name is required/i);
  });
});

function testKey(): EncryptionKey {
  return new Uint8Array(32).fill(1);
}
