import { describe, expect, it } from "vitest";
import type { LLMMessage, LLMProvider } from "@thoughtline/shared";
import { AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR } from "@/lib/agent-archive";
import type { AgentAccessReader } from "@/lib/authorized-runtime";
import { createAuthorizedAskResponse } from "../ask-route";

const ownerAddress = "0x1111111111111111111111111111111111111111";
const userAddress = "0x2222222222222222222222222222222222222222";
const unauthorizedAddress = "0x3333333333333333333333333333333333333333";

const privateWorldview = {
  values: ["clarity"],
  heuristics: ["Prefer reversible decisions"],
  blindspots: ["May over-index on written plans"],
  decisionStyle: "analytical" as const,
  freeform: "Private runtime-only worldview phrase.",
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
      skillMarkdown: "---\nname: Decision Review\n---\n## Procedure\nCompare options.",
      source: "genesis" as const,
      parentSkillIds: [],
    },
  ],
};

describe("POST /api/agents/:tokenId/ask", () => {
  it("allows the owner to ask the agent", async () => {
    const response = await createAuthorizedAskResponse(
      request({ callerAddress: ownerAddress }),
      "1",
      {
        accessReader: fakeAccessReader({ authorizedUsers: [] }),
        llm: fakeLlm(() => "Owner answer."),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: {
        role: "assistant",
        content: "Owner answer.",
        usedSkillId: "decision-review",
      },
      usedSkillId: "decision-review",
    });
  });

  it("allows an authorized non-owner to ask without returning private fields", async () => {
    const response = await createAuthorizedAskResponse(
      request({ callerAddress: userAddress }),
      "1",
      {
        accessReader: fakeAccessReader({ authorizedUsers: [userAddress] }),
        llm: fakeLlm(() => privateWorldview.freeform),
      }
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain(privateWorldview.freeform);
    expect(text).not.toContain("heuristics");
  });

  it("rejects unauthorized callers before invoking the LLM", async () => {
    let calls = 0;
    const response = await createAuthorizedAskResponse(
      request({ callerAddress: unauthorizedAddress }),
      "1",
      {
        accessReader: fakeAccessReader({ authorizedUsers: [userAddress] }),
        llm: fakeLlm(() => {
          calls += 1;
          return "should not run";
        }),
      }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/not authorized/i);
    expect(calls).toBe(0);
  });

  it("returns the V2 envelope requirement error from legacy private blobs", async () => {
    const response = await createAuthorizedAskResponse(request({}), "1", {
      accessReader: {
        async getAgentAccess() {
          throw new Error(AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR);
        },
      },
      llm: fakeLlm(() => "should not run"),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR);
  });

  it("returns a validation error for invalid request bodies", async () => {
    const response = await createAuthorizedAskResponse(
      new Request("http://localhost/api/agents/1/ask", {
        method: "POST",
        body: JSON.stringify({ callerAddress: "bad", messages: [] }),
      }),
      "1",
      {
        accessReader: fakeAccessReader({ authorizedUsers: [] }),
        llm: fakeLlm(),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toHaveProperty("error");
  });
});

function request(overrides: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents/1/ask", {
    method: "POST",
    body: JSON.stringify({
      callerAddress: userAddress,
      messages: [{ role: "user", content: "Which option should I choose?" }],
      skillId: "decision-review",
      ...overrides,
    }),
  });
}

function fakeAccessReader(input: {
  authorizedUsers: string[];
}): AgentAccessReader {
  return {
    async getAgentAccess() {
      return {
        ownerAddress,
        authorizedUsers: input.authorizedUsers,
        publicProfile,
        privateWorldview,
      };
    },
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
