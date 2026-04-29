import { describe, expect, it } from "vitest";
import type { PrivateWorldview, PublicProfile } from "@thoughtline/shared";
import { buildSkillInvocationMessages } from "../invoke.js";

const privateWorldview: PrivateWorldview = {
  values: ["clarity"],
  heuristics: ["Start with the highest-risk assumption"],
  blindspots: [],
  decisionStyle: "analytical",
  freeform: "A precise technical reviewer.",
};

const publicProfile: PublicProfile = {
  name: "The Reviewer",
  description: "A technical review advisor.",
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  skills: [
    {
      id: "review-architecture",
      name: "Review Architecture",
      description: "Reviews architecture decisions.",
      skillMarkdown: `---
name: Review Architecture
description: Reviews architecture decisions.
---

## When to Use

Use this for design reviews.

## Inputs

- A design note

## Procedure

1. Identify risks.

## Output

Return findings.`,
      source: "genesis",
      parentSkillIds: [],
    },
  ],
};

describe("buildSkillInvocationMessages", () => {
  it("builds an invocation prompt from worldview, selected skill, and input", () => {
    const messages = buildSkillInvocationMessages({
      privateWorldview,
      publicProfile,
      skillId: "review-architecture",
      input: "Review this PRD.",
    });

    expect(messages[0].content).toContain("The Reviewer");
    expect(messages[0].content).toContain("highest-risk assumption");
    expect(messages[0].content).toContain("Review Architecture");
    expect(messages[1]).toEqual({ role: "user", content: "Review this PRD." });
  });

  it("rejects unknown skill ids", () => {
    expect(() =>
      buildSkillInvocationMessages({
        privateWorldview,
        publicProfile,
        skillId: "missing",
        input: "Review this PRD.",
      })
    ).toThrow(/skill not found/i);
  });
});
