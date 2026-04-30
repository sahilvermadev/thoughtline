import { describe, expect, it } from "vitest";
import type { LLMProvider, PrivateWorldview, PublicProfile } from "@thoughtline/shared";
import { synthesizeChildSkills } from "../synthesis";

function fakeLLM(response: string): LLMProvider {
  return {
    async chat() {
      return { content: response };
    },
    async *chatStream() {
      throw new Error("Not used");
    },
  };
}

const worldview: PrivateWorldview = {
  values: ["clarity"],
  heuristics: ["Ask one sharp question"],
  blindspots: [],
  decisionStyle: "analytical",
  freeform: "A careful thinker.",
};

const parentProfile: PublicProfile = {
  name: "Parent",
  description: "Parent profile",
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  skills: [
    {
      id: "ask-sharp-questions",
      name: "Ask Sharp Questions",
      description: "Surfaces decision pressure.",
      skillMarkdown: "## Procedure\n\n1. Ask a sharp question.",
      source: "genesis",
      parentSkillIds: [],
    },
  ],
};

describe("synthesizeChildSkills", () => {
  it("returns validated child skills with provenance", async () => {
    const childSkill = {
      id: "review-risk",
      name: "Review Risk",
      description: "Reviews risk in a plan.",
      skillMarkdown: `---
name: Review Risk
description: Reviews risk in a plan.
---

## When to Use

Use this for plans.

## Inputs

- A plan

## Procedure

1. Find the riskiest assumption.

## Output

Return findings.`,
      source: "synthesized",
      parentSkillIds: ["ask-sharp-questions"],
    };

    const skills = await synthesizeChildSkills(
      fakeLLM(JSON.stringify({ skills: [childSkill] })),
      {
        childName: "Child",
        childWorldview: worldview,
        parentA: {
          id: "a",
          publicProfile: parentProfile,
          privateWorldview: worldview,
        },
        parentB: {
          id: "b",
          publicProfile: parentProfile,
          privateWorldview: worldview,
        },
      }
    );

    expect(skills).toEqual([childSkill]);
  });

  it("rejects public skill markdown that leaks private worldview text", async () => {
    const leakingWorldview: PrivateWorldview = {
      ...worldview,
      heuristics: ["This exact private heuristic should not be public"],
    };

    await expect(
      synthesizeChildSkills(
        fakeLLM(
          JSON.stringify({
            skills: [
              {
                id: "leaky-skill",
                name: "Leaky Skill",
                description: "Leaks private text.",
                skillMarkdown:
                  "This exact private heuristic should not be public",
                source: "synthesized",
                parentSkillIds: [],
              },
            ],
          })
        ),
        {
          childName: "Child",
          childWorldview: leakingWorldview,
          parentA: {
            id: "a",
            publicProfile: parentProfile,
            privateWorldview: leakingWorldview,
          },
          parentB: {
            id: "b",
            publicProfile: parentProfile,
            privateWorldview: worldview,
          },
        }
      )
    ).rejects.toThrow(/leaks private worldview/i);
  });
});
