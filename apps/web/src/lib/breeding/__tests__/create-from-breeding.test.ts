import { describe, it, expect } from "vitest";
import type {
  LLMProvider,
  PublicProfile,
  SkillPackage,
  Worldview,
} from "@thoughtline/shared";
import { createAgentArchive } from "../../agent-archive/index";
import { createMemoryStorage } from "../../storage/memory";
import { createAgentFromBreeding } from "../create-from-breeding";
import type { EncryptionKey } from "../../crypto/index";

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

const parentWorldviewA: Worldview = {
  values: ["courage", "freedom"],
  heuristics: ["Act decisively"],
  blindspots: ["Impatient"],
  decisionStyle: "intuitive",
  freeform: "A bold leader.",
};

const parentWorldviewB: Worldview = {
  values: ["patience", "wisdom"],
  heuristics: ["Think before you act"],
  blindspots: ["Too cautious"],
  decisionStyle: "deliberative",
  freeform: "A careful thinker.",
};

const childWorldview: Worldview = {
  values: ["courage", "wisdom"],
  heuristics: ["Act decisively but think first"],
  blindspots: ["Overthinks under pressure"],
  decisionStyle: "adaptive",
  freeform: "Balances boldness with reflection.",
};

const parentSkillA: SkillPackage = {
  id: "act-under-uncertainty",
  name: "Act Under Uncertainty",
  description: "Makes bold calls when evidence is incomplete.",
  skillMarkdown: `---
name: Act Under Uncertainty
description: Makes bold calls when evidence is incomplete.
---

## When to Use

Use this for urgent decisions.

## Inputs

- A decision prompt

## Procedure

1. Identify what is known.
2. Choose the reversible action.

## Output

Return an action plan.`,
  source: "genesis",
  parentSkillIds: [],
};

const parentSkillB: SkillPackage = {
  id: "reflect-before-acting",
  name: "Reflect Before Acting",
  description: "Slows down decisions to surface second-order effects.",
  skillMarkdown: `---
name: Reflect Before Acting
description: Slows down decisions to surface second-order effects.
---

## When to Use

Use this for high-stakes choices.

## Inputs

- A decision prompt

## Procedure

1. Map consequences.
2. Identify hidden constraints.

## Output

Return a careful recommendation.`,
  source: "genesis",
  parentSkillIds: [],
};

const childSkill: SkillPackage = {
  id: "balance-action-and-reflection",
  name: "Balance Action and Reflection",
  description: "Combines fast action with deliberate checks.",
  skillMarkdown: `---
name: Balance Action and Reflection
description: Combines fast action with deliberate checks.
---

## When to Use

Use this for decisions that need both speed and care.

## Inputs

- A decision prompt

## Procedure

1. Identify the reversible next step.
2. Check second-order effects.

## Output

Return a balanced recommendation.`,
  source: "synthesized",
  parentSkillIds: ["act-under-uncertainty", "reflect-before-acting"],
};

describe("createAgentFromBreeding", () => {
  it("breeds two parents into a complete child agent", async () => {
    const archive = createAgentArchive(createMemoryStorage());
    const llm = fakeLLM([
      // Call 1: synthesize child worldview (extractStructured adds system msg)
      JSON.stringify(childWorldview),
      // Call 2: synthesize child skills
      JSON.stringify({ skills: [childSkill] }),
      // Call 3: generate description
      "A balanced advisor who combines courage with wisdom.",
    ]);

    const publicProfileA: PublicProfile = {
      name: "The Bold",
      description: "A bold advisor.",
      skills: [parentSkillA],
      generation: 0,
      parentIds: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const publicProfileB: PublicProfile = {
      name: "The Sage",
      description: "A careful advisor.",
      skills: [parentSkillB],
      generation: 2,
      parentIds: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    const parentA = {
      id: "parent-a-id",
      publicProfile: publicProfileA,
      privateWorldview: parentWorldviewA,
    };
    const parentB = {
      id: "parent-b-id",
      publicProfile: publicProfileB,
      privateWorldview: parentWorldviewB,
    };

    const child = await createAgentFromBreeding(
      { name: "The Balanced", parentA, parentB, encryptionKey: testKey() },
      { llm, archive }
    );

    expect(child.name).toBe("The Balanced");
    expect(child.privateWorldview).toEqual(childWorldview);
    expect(child.skills).toEqual([childSkill]);
    expect(child.description).toBe(
      "A balanced advisor who combines courage with wisdom."
    );
    expect(child.generation).toBe(3); // max(0, 2) + 1
    expect(child.parentIds).toEqual(["parent-a-id", "parent-b-id"]);
    expect(child.publicUri).toBeTruthy();
    expect(child.privateUri).toBeTruthy();
    expect(child.dataHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify it was stored
    const fetched = await archive.load(
      child.publicUri,
      child.privateUri,
      testKey()
    );
    expect(fetched.publicProfile.name).toBe("The Balanced");
    expect(fetched.publicProfile.parentIds).toEqual([
      "parent-a-id",
      "parent-b-id",
    ]);
    expect(fetched.publicProfile.generation).toBe(3);
  });
});

function testKey(): EncryptionKey {
  return new Uint8Array(32).fill(3);
}
