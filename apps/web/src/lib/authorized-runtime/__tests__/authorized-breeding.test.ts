import { describe, expect, it } from "vitest";
import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
  SkillPackage,
} from "@thoughtline/shared";
import { createAgentArchive } from "../../agent-archive/index";
import { createMemoryStorage } from "../../storage/memory";
import {
  canBreedWith,
  createAuthorizedBreedingRuntime,
  type BreedingAccessReader,
} from "../breeding";

const skill: SkillPackage = {
  id: "reason-clearly",
  name: "Reason Clearly",
  description: "Reasons through a decision.",
  skillMarkdown: `---
name: Reason Clearly
description: Reasons through a decision.
---

## When to Use

Use this for decisions.

## Inputs

- A decision

## Procedure

1. Explain the tradeoff.

## Output

Return a recommendation.`,
  source: "genesis",
  parentSkillIds: [],
};

const worldviewA: PrivateWorldview = {
  values: ["freedom"],
  heuristics: ["Seek leverage before effort"],
  blindspots: [],
  decisionStyle: "contrarian",
  freeform: "Private parent A worldview.",
};

const worldviewB: PrivateWorldview = {
  values: ["discipline"],
  heuristics: ["Compound quietly"],
  blindspots: [],
  decisionStyle: "deliberative",
  freeform: "Private parent B worldview.",
};

const profileA: PublicProfile = {
  name: "Naval-like Advisor",
  description: "Public A",
  skills: [skill],
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const profileB: PublicProfile = {
  name: "Builder Advisor",
  description: "Public B",
  skills: [skill],
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("canBreedWith", () => {
  it("allows owners and authorized breeders", () => {
    expect(
      canBreedWith("0xUSER", {
        ownerAddress: "0xuser",
        authorizedBreeders: [],
      })
    ).toBe(true);
    expect(
      canBreedWith("0xuser", {
        ownerAddress: "0xowner",
        authorizedBreeders: ["0xUSER"],
      })
    ).toBe(true);
  });

  it("rejects callers without breeding authorization", () => {
    expect(
      canBreedWith("0xstranger", {
        ownerAddress: "0xowner",
        authorizedBreeders: ["0xuser"],
      })
    ).toBe(false);
  });
});

describe("AuthorizedBreedingRuntime", () => {
  it("breeds with a third-party parent when caller has breeding authorization", async () => {
    const runtime = createAuthorizedBreedingRuntime({
      accessReader: fakeBreedingAccessReader({
        "naval-token": {
          ownerAddress: "0xnaval",
          authorizedBreeders: ["0xuser"],
          publicProfile: profileA,
          privateWorldview: worldviewA,
        },
        "user-token": {
          ownerAddress: "0xuser",
          authorizedBreeders: [],
          publicProfile: profileB,
          privateWorldview: worldviewB,
        },
      }),
      llm: fakeBreedingLLM(),
      archive: createAgentArchive(createMemoryStorage()),
    });

    const child = await runtime.breed({
      parentTokenIdA: "naval-token",
      parentTokenIdB: "user-token",
      callerAddress: "0xuser",
      childName: "Leverage Builder",
      encryptionKey: new Uint8Array(32).fill(8),
    });

    expect(child.publicProfile.parentIds).toEqual([
      "naval-token",
      "user-token",
    ]);
    expect(child.privateWorldview.freeform).toBe("Private child worldview.");
    expect(JSON.stringify(child)).not.toContain(worldviewA.freeform);
    expect(JSON.stringify(child)).not.toContain(worldviewB.freeform);
  });

  it("rejects when caller lacks breeding authorization for either parent", async () => {
    const runtime = createAuthorizedBreedingRuntime({
      accessReader: fakeBreedingAccessReader({
        "naval-token": {
          ownerAddress: "0xnaval",
          authorizedBreeders: [],
          publicProfile: profileA,
          privateWorldview: worldviewA,
        },
        "user-token": {
          ownerAddress: "0xuser",
          authorizedBreeders: [],
          publicProfile: profileB,
          privateWorldview: worldviewB,
        },
      }),
      llm: fakeBreedingLLM(),
      archive: createAgentArchive(createMemoryStorage()),
    });

    await expect(
      runtime.breed({
        parentTokenIdA: "naval-token",
        parentTokenIdB: "user-token",
        callerAddress: "0xuser",
        childName: "Leverage Builder",
        encryptionKey: new Uint8Array(32).fill(8),
      })
    ).rejects.toThrow(/not authorized to breed/i);
  });
});

function fakeBreedingAccessReader(
  records: Record<string, Awaited<ReturnType<BreedingAccessReader["getBreedingAccess"]>>>
): BreedingAccessReader {
  return {
    async getBreedingAccess(tokenId) {
      const record = records[tokenId];
      if (!record) throw new Error(`Missing record: ${tokenId}`);
      return record;
    },
  };
}

function fakeBreedingLLM(): LLMProvider {
  let calls = 0;
  const childWorldview = {
    values: ["freedom", "discipline"],
    heuristics: ["Balance asymmetric upside with consistent execution"],
    blindspots: [],
    decisionStyle: "adaptive",
    freeform: "Private child worldview.",
  };
  const childSkill = {
    ...skill,
    id: "apply-leverage-consistently",
    name: "Apply Leverage Consistently",
    source: "synthesized",
    parentSkillIds: ["reason-clearly"],
  };

  return {
    async chat() {
      calls += 1;
      if (calls === 1) return { content: JSON.stringify(childWorldview) };
      if (calls === 2) return { content: JSON.stringify({ skills: [childSkill] }) };
      return { content: "Combines leverage with steady execution." };
    },
    async *chatStream() {
      throw new Error("Not used");
    },
  };
}
