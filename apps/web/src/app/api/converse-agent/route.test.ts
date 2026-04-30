import { describe, expect, it } from "vitest";
import type { LLMMessage, LLMProvider } from "@thoughtline/shared";
import { createConverseAgentResponse } from "@/lib/agent-conversation/route";

const privateWorldview = {
  values: ["clarity"],
  heuristics: ["Prefer reversible decisions"],
  blindspots: ["May over-index on written plans"],
  decisionStyle: "analytical" as const,
  freeform: "Private reasoning fingerprint.",
};

const publicProfile = {
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
      source: "genesis" as const,
      parentSkillIds: [],
    },
  ],
};

describe("POST /api/converse-agent", () => {
  it("returns an assistant message and usedSkillId for a valid request", async () => {
    const response = await createConverseAgentResponse(request({}), {
      llm: fakeLlm(async (messages) => {
        expect(messages.at(-1)).toEqual({
          role: "user",
          content: "Which option should I choose?",
        });
        return "Use option A.";
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      message: {
        role: "assistant",
        content: "Use option A.",
        usedSkillId: "decision-review",
      },
      usedSkillId: "decision-review",
    });
  });

  it("returns a validation error for an invalid body", async () => {
    const response = await createConverseAgentResponse(
      new Request("http://localhost/api/converse-agent", {
        method: "POST",
        body: JSON.stringify({ messages: [] }),
      }),
      { llm: fakeLlm() }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("does not include private worldview fields in the response body", async () => {
    const response = await createConverseAgentResponse(request({}), {
      llm: fakeLlm(async () => "Public answer only."),
    });
    const text = await response.text();

    expect(text).not.toContain("Private reasoning fingerprint.");
    expect(text).not.toContain("heuristics");
    expect(text).toContain("Public answer only.");
  });
});

function request(overrides: Record<string, unknown>): Request {
  return new Request("http://localhost/api/converse-agent", {
    method: "POST",
    body: JSON.stringify({
      privateWorldview,
      publicProfile,
      messages: [{ role: "user", content: "Which option should I choose?" }],
      skillId: "decision-review",
      ...overrides,
    }),
  });
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
