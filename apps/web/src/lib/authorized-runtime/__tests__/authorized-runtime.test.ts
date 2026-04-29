import { describe, expect, it } from "vitest";
import type {
  LLMMessage,
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";
import {
  canInvoke,
  createAuthorizedAgentRuntime,
  type AgentAccessReader,
} from "../index.js";

const privateWorldview: PrivateWorldview = {
  values: ["independence"],
  heuristics: ["Seek leverage before effort"],
  blindspots: ["May underweight institutions"],
  decisionStyle: "contrarian",
  freeform: "A private reasoning fingerprint that should never be returned.",
};

const publicProfile: PublicProfile = {
  name: "Naval-like Advisor",
  description: "A public profile for an advisor.",
  skills: [
    {
      id: "analyze-leverage",
      name: "Analyze Leverage",
      description: "Finds leverage in a decision.",
      skillMarkdown: `---
name: Analyze Leverage
description: Finds leverage in a decision.
---

## When to Use

Use this when deciding where to focus.

## Inputs

- A decision prompt

## Procedure

1. Identify high-leverage options.

## Output

Return a concise recommendation.`,
      source: "genesis",
      parentSkillIds: [],
    },
  ],
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("canInvoke", () => {
  it("allows owners and authorized users case-insensitively", () => {
    expect(
      canInvoke("0xABC", {
        ownerAddress: "0xabc",
        authorizedUsers: [],
      })
    ).toBe(true);
    expect(
      canInvoke("0xdef", {
        ownerAddress: "0xabc",
        authorizedUsers: ["0xDEF"],
      })
    ).toBe(true);
  });

  it("rejects callers that are neither owner nor authorized", () => {
    expect(
      canInvoke("0x999", {
        ownerAddress: "0xabc",
        authorizedUsers: ["0xdef"],
      })
    ).toBe(false);
  });
});

describe("AuthorizedAgentRuntime", () => {
  it("invokes an agent for an authorized user without returning private worldview", async () => {
    let capturedMessages: LLMMessage[] = [];
    const runtime = createAuthorizedAgentRuntime({
      accessReader: fakeAccessReader({
        ownerAddress: "0xowner",
        authorizedUsers: ["0xuser"],
      }),
      llm: fakeLLM((messages) => {
        capturedMessages = messages;
        return "Use asymmetric upside.";
      }),
    });

    const result = await runtime.invoke({
      tokenId: "12",
      callerAddress: "0xuser",
      skillId: "analyze-leverage",
      input: "Should I start a company?",
    });

    expect(result).toEqual({ response: "Use asymmetric upside." });
    expect(JSON.stringify(result)).not.toContain(privateWorldview.freeform);
    expect(capturedMessages[0].content).toContain(privateWorldview.freeform);
  });

  it("rejects unauthorized callers before LLM invocation", async () => {
    let llmCalled = false;
    const runtime = createAuthorizedAgentRuntime({
      accessReader: fakeAccessReader({
        ownerAddress: "0xowner",
        authorizedUsers: [],
      }),
      llm: fakeLLM(() => {
        llmCalled = true;
        return "nope";
      }),
    });

    await expect(
      runtime.invoke({
        tokenId: "12",
        callerAddress: "0xstranger",
        skillId: "analyze-leverage",
        input: "Should I start a company?",
      })
    ).rejects.toThrow(/not authorized/i);
    expect(llmCalled).toBe(false);
  });
});

function fakeAccessReader(access: {
  ownerAddress: string;
  authorizedUsers: string[];
}): AgentAccessReader {
  return {
    async getAgentAccess() {
      return {
        ownerAddress: access.ownerAddress,
        authorizedUsers: access.authorizedUsers,
        publicProfile,
        privateWorldview,
      };
    },
  };
}

function fakeLLM(onChat: (messages: LLMMessage[]) => string): LLMProvider {
  return {
    async chat(messages) {
      return { content: onChat(messages) };
    },
    async *chatStream() {
      throw new Error("Not used");
    },
  };
}
