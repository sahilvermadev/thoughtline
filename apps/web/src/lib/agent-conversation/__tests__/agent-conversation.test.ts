import { describe, expect, it } from "vitest";
import type {
  LLMMessage,
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";
import {
  buildAgentConversationMessages,
  converseWithAgent,
  type AgentConversationMessage,
} from "@/lib/agent-conversation";

const privateWorldview: PrivateWorldview = {
  values: ["clarity"],
  heuristics: ["Prefer reversible decisions"],
  blindspots: ["May over-index on written plans"],
  decisionStyle: "analytical",
  freeform: "Private reasoning fingerprint.",
};

const publicProfile: PublicProfile = {
  name: "The Analyst",
  description: "Reviews decisions.",
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  skills: [
    {
      id: "decision-review",
      name: "Decision Review",
      description: "Reviews a decision for tradeoffs.",
      skillMarkdown:
        "---\nname: Decision Review\n---\n## Procedure\nCompare options.",
      source: "genesis",
      parentSkillIds: [],
    },
    {
      id: "risk-scan",
      name: "Risk Scan",
      description: "Finds likely operational risks.",
      skillMarkdown: "---\nname: Risk Scan\n---\n## Procedure\nList risks.",
      source: "genesis",
      parentSkillIds: [],
    },
  ],
};

describe("agent conversation", () => {
  it("uses an explicit slash skill and returns usedSkillId", async () => {
    const result = await converseWithAgent(
      input({ skillId: "decision-review" }),
      fakeLlm(async (messages) => {
        expect(messages[0].content).toContain("Decision Review");
        return "Use the reversible option.";
      })
    );

    expect(result).toEqual({
      message: {
        role: "assistant",
        content: "Use the reversible option.",
        usedSkillId: "decision-review",
      },
      usedSkillId: "decision-review",
    });
  });

  it("errors for an unknown explicit skillId", async () => {
    await expect(
      converseWithAgent(input({ skillId: "missing-skill" }), fakeLlm())
    ).rejects.toThrow("Skill not found: missing-skill");
  });

  it("auto-routes to a matching public skill when no skillId is provided", async () => {
    const result = await converseWithAgent(
      input({
        messages: [{ role: "user", content: "Can you scan the launch risks?" }],
      }),
      fakeLlm(async (messages) => {
        expect(messages[0].content).toContain("Risk Scan");
        return "The main risk is unclear ownership.";
      })
    );

    expect(result.usedSkillId).toBe("risk-scan");
  });

  it("answers directly with usedSkillId null when no skill matches", async () => {
    const result = await converseWithAgent(
      input({
        messages: [{ role: "user", content: "What should I write first?" }],
      }),
      fakeLlm(async (messages) => {
        expect(messages[0].content).toContain("Answer directly");
        return "Start with the decision context.";
      })
    );

    expect(result.usedSkillId).toBeNull();
  });

  it("includes the multi-turn transcript in the prompt", () => {
    const messages = buildAgentConversationMessages({
      ...input({
        messages: [
          { role: "user", content: "First question" },
          { role: "assistant", content: "First answer", usedSkillId: null },
          { role: "user", content: "Follow-up question" },
        ],
      }),
      usedSkill: null,
    });

    expect(messages.slice(1)).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Follow-up question" },
    ]);
  });

  it("uses the selected skill only for the current user turn", async () => {
    const transcript: AgentConversationMessage[] = [
      { role: "user", content: "Review this decision." },
      {
        role: "assistant",
        content: "The reversible option is better.",
        usedSkillId: "decision-review",
      },
      { role: "user", content: "Now answer without a tool." },
    ];

    const result = await converseWithAgent(
      input({ messages: transcript }),
      fakeLlm(async (messages) => {
        expect(messages[0].content).not.toContain(
          "For the latest user turn, apply this public slash skill package"
        );
        expect(messages[0].content).toContain("Answer directly");
        return "Direct answer.";
      })
    );

    expect(result.usedSkillId).toBeNull();
  });
});

function input(
  overrides: Partial<{
    messages: AgentConversationMessage[];
    skillId: string;
  }> = {}
) {
  return {
    privateWorldview,
    publicProfile,
    messages: [{ role: "user" as const, content: "Which option should I choose?" }],
    ...overrides,
  };
}

function fakeLlm(
  chat: (messages: LLMMessage[]) => Promise<string> | string = () => "ok"
): LLMProvider {
  return {
    async chat(messages) {
      return { content: await chat(messages) };
    },
    async *chatStream() {
      yield { content: "", done: true };
    },
  };
}
