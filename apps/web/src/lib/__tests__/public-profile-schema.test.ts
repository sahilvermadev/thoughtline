import { describe, expect, it } from "vitest";
import { publicProfileSchema } from "@thoughtline/shared";

const skill = {
  id: "decision-review",
  name: "Decision Review",
  description: "Reviews tradeoffs.",
  skillMarkdown: "---\nname: Decision Review\n---\n## Procedure\nCompare options.",
  source: "genesis" as const,
  parentSkillIds: [],
};

describe("public profile schema", () => {
  it("accepts expertise metadata while keeping old profiles valid", () => {
    const baseProfile = {
      name: "Clarity",
      description: "Reviews hard decisions.",
      skills: [skill],
      parentIds: null,
      generation: 0,
      createdAt: "2026-04-29T00:00:00.000Z",
    };

    expect(publicProfileSchema.parse(baseProfile)).toMatchObject(baseProfile);
    expect(
      publicProfileSchema.parse({
        ...baseProfile,
        expertiseType: "Decision review specialist",
        sourceLabels: ["founder notes"],
        sourceCount: 1,
        positioning: "Helps founders review launch decisions.",
      })
    ).toMatchObject({
      expertiseType: "Decision review specialist",
      sourceLabels: ["founder notes"],
      sourceCount: 1,
      positioning: "Helps founders review launch decisions.",
    });
  });
});
