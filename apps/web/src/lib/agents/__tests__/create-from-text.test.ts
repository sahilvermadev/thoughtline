import { describe, it, expect } from "vitest";
import type { LLMProvider, LLMMessage } from "@thoughtline/shared";
import { createAgentArchive } from "../../agent-archive/index";
import { createMemoryStorage } from "../../storage/memory";
import { createAgentFromText, splitTextIntoChunks } from "../create-from-text";
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
  operatingModel: {
    identity: {
      role: "Research decision analyst",
      background: "Synthesized from research memos.",
      expertiseBoundary: "Research decisions and tradeoff reviews.",
      influences: ["research memos"],
    },
    worldview: {
      coreBeliefs: ["Truth beats convenience."],
      defaultAssumptions: ["Evidence quality determines confidence."],
      tensions: [
        {
          tension: "Speed matters, but unsupported claims should slow decisions.",
          poles: ["speed", "evidence"],
          howToResolve: "Move quickly only when evidence quality is visible.",
          evidenceLabels: ["memo"],
        },
      ],
    },
    decisionMaking: {
      tradeoffRules: [
        {
          when: "Evidence conflicts with preference",
          prefer: "the better-supported claim",
          over: "the more convenient answer",
          rationale: "The sources reward honesty over speed.",
          evidenceLabels: ["memo"],
        },
      ],
      rubrics: [
        {
          domain: "Research review",
          criteria: ["evidence quality"],
          redFlags: ["unsupported claim"],
          greenFlags: ["clear source trail"],
          evidenceLabels: ["case study"],
        },
      ],
      confidenceModel: {
        highConfidenceWhen: ["Multiple sources agree"],
        lowConfidenceWhen: ["The input lacks examples"],
        askClarifyingQuestionsWhen: ["The decision target is unclear"],
      },
    },
    persona: {
      tone: "direct",
      temperament: "careful",
      communicationStyle: "evidence-led",
    },
    boundaries: {
      refuses: ["Inventing evidence"],
      escalates: ["Regulated professional advice"],
      asksClarifyingQuestionsWhen: ["The request lacks a decision criterion"],
    },
    examples: {
      decisionExamples: [
        {
          situation: "A claim lacks supporting data",
          judgment: "Treat it as a hypothesis.",
          reasoning: "Unsupported claims should not drive decisions.",
          evidenceLabels: ["memo"],
        },
      ],
      phrasingExamples: ["The evidence is not strong enough yet."],
    },
  },
  styleModel: {
    voicePrinciples: ["Be direct and evidence-led."],
    vocabulary: {
      uses: ["evidence", "tradeoff"],
      avoids: ["guaranteed"],
    },
    rhetoricalMoves: ["Names the uncertainty before the recommendation"],
    toneShifts: [{ context: "thin evidence", tone: "more cautious" }],
    antiPatterns: ["Overconfident claims"],
    examples: {
      good: [
        {
          text: "The evidence is not strong enough yet.",
          why: "It calibrates confidence before advising.",
          evidenceLabels: ["memo"],
        },
      ],
      bad: [{ text: "This will definitely work.", why: "It overclaims." }],
    },
    platformNotes: ["Keep public skill wording concrete."],
  },
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
  creationBasis: "user-guided" as const,
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
        expertiseType: "Research decision analyst",
        sourceLabels: ["memo", "case study"],
        desiredCapabilities: ["Review pitch decks", "Critique onboarding flows"],
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
    expect(agent.publicProfile.expertiseType).toBe("Research decision analyst");
    expect(agent.publicProfile.positioning).toBe("Research decision analyst");
    expect(agent.publicProfile.sourceLabels).toEqual(["memo", "case study"]);
    expect(agent.publicProfile.sourceCount).toBe(1);
    expect(agent.publicProfile.desiredCapabilities).toEqual([
      "Review pitch decks",
      "Critique onboarding flows",
    ]);
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
    expect(fetched.publicProfile.sourceLabels).toEqual(["memo", "case study"]);
    expect(fetched.publicProfile.desiredCapabilities).toEqual([
      "Review pitch decks",
      "Critique onboarding flows",
    ]);
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
        expertiseType: "Enterprise risk reviewer",
        sourceLabels: ["blog", "book"],
        desiredCapabilities: ["Review risk memos"],
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
    expect(capturedPrompt).toContain(
      "Expertise type / positioning: Enterprise risk reviewer"
    );
    expect(capturedPrompt).toContain("Source labels: blog, book");
    expect(capturedPrompt).toContain("Desired capabilities: Review risk memos");
  });

  it("passes operating model context into skill synthesis", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const prompts: string[] = [];
    const llm = fakeLLM(
      [
        JSON.stringify(validExtraction),
        JSON.stringify(validSkillsExtraction),
        "A description.",
      ],
      (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
      }
    );

    await createAgentFromText(
      {
        name: "Test",
        sources: [{ label: "memo", text: "Evidence first." }],
        encryptionKey: testKey(),
      },
      { llm, archive }
    );

    const skillPrompt = prompts.find((prompt) =>
      prompt.includes("Create 3-5 public skill packages")
    );
    expect(skillPrompt).toContain("Operating model summary");
    expect(skillPrompt).toContain("Research decision analyst");
    expect(skillPrompt).toContain("Evidence conflicts with preference");
  });

  it("splits text into deterministic chunks", () => {
    expect(splitTextIntoChunks("aaaa\n\nbbbbbbbb\n\ncccc", 16)).toEqual([
      "aaaa\n\nbbbbbbbb",
      "cccc",
    ]);
  });

  it("extracts chunk evidence when total text exceeds threshold", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const chatCalls: LLMMessage[][] = [];
    const events: string[] = [];
    let activeChunkExtractions = 0;
    let maxActiveChunkExtractions = 0;

    const largeText = "x".repeat(30_000);

    const llm: LLMProvider = {
      async chat(messages: LLMMessage[]) {
        chatCalls.push(messages);
        const callNum = chatCalls.length;

        if (messages.at(-1)?.content.includes("Extract source-grounded evidence")) {
          activeChunkExtractions += 1;
          maxActiveChunkExtractions = Math.max(
            maxActiveChunkExtractions,
            activeChunkExtractions
          );
          await Promise.resolve();
          activeChunkExtractions -= 1;
          return {
            content: JSON.stringify({
              claims: [`Claim from chunk ${callNum}`],
              heuristics: [`Heuristic from chunk ${callNum}`],
              tradeoffs: [],
              vocabulary: { uses: ["evidence"], avoids: [] },
              examples: [],
              contradictions: [],
              influences: [],
              voice: ["direct"],
              evidenceLabels: [
                `chunk-${callNum} ${"with a very long label".repeat(8)}`,
              ],
            }),
          };
        }
        if (callNum === 7) return { content: JSON.stringify(validExtraction) };
        if (callNum === 8) {
          return { content: JSON.stringify(validSkillsExtraction) };
        }
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
      {
        llm,
        archive,
        emit: (event) => {
          events.push(event);
        },
      }
    );

    expect(chatCalls.length).toBe(9);
    expect(
      chatCalls.slice(0, 6).every((call) =>
        call.at(-1)?.content.includes("Extract source-grounded evidence")
      )
    ).toBe(true);
    expect(maxActiveChunkExtractions).toBe(1);

    const worldviewCall = chatCalls[6];
    const userMsg = worldviewCall.find((m) => m.role === "user")!.content;
    expect(userMsg).toContain("chunk 1 extract");
    expect(userMsg).toContain("Claim from chunk 1");
    expect(userMsg).toContain("Claim from chunk 6");
    expect(userMsg).not.toContain("x".repeat(100));
    expect(
      events.filter((event) => event === "extracting-source-chunk")
    ).toHaveLength(6);
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
