import { describe, expect, it } from "vitest";
import { privateWorldviewSchema, publicProfileSchema } from "@thoughtline/shared";

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
        desiredCapabilities: ["Review pitch decks"],
        positioning: "Helps founders review launch decisions.",
        skills: [{ ...skill, creationBasis: "user-guided" }],
      })
    ).toMatchObject({
      expertiseType: "Decision review specialist",
      sourceLabels: ["founder notes"],
      sourceCount: 1,
      desiredCapabilities: ["Review pitch decks"],
      positioning: "Helps founders review launch decisions.",
      skills: [{ creationBasis: "user-guided" }],
    });
  });
});

describe("private worldview schema", () => {
  it("accepts optional operating model while keeping old worldviews valid", () => {
    const baseWorldview = {
      values: ["clarity"],
      heuristics: ["Prefer reversible decisions"],
      blindspots: [],
      decisionStyle: "analytical" as const,
      freeform: "A concise worldview capsule.",
    };

    expect(privateWorldviewSchema.parse(baseWorldview)).toMatchObject(
      baseWorldview
    );
    expect(
      privateWorldviewSchema.parse({
        ...baseWorldview,
        operatingModel: {
          identity: {
            role: "Founder decision reviewer",
            background: "Built from teardown notes and launch reviews.",
            expertiseBoundary: "Early-stage SaaS launch and onboarding calls.",
            influences: ["teardown notes"],
          },
          worldview: {
            coreBeliefs: ["Specific examples beat generic strategy."],
            defaultAssumptions: ["Distribution constraints usually dominate."],
            tensions: [
              {
                tension: "Move fast while respecting evidence limits.",
                poles: ["speed", "evidence"],
                howToResolve: "Prefer reversible tests when certainty is low.",
                evidenceLabels: ["launch memo"],
              },
            ],
          },
          decisionMaking: {
            tradeoffRules: [
              {
                when: "A team must choose between polish and speed",
                prefer: "shipping a measurable learning loop",
                over: "adding untested polish",
                rationale: "The source material rewards fast feedback.",
                evidenceLabels: ["launch memo"],
              },
            ],
            rubrics: [
              {
                domain: "Onboarding critique",
                criteria: ["activation clarity"],
                redFlags: ["unclear next step"],
                greenFlags: ["single obvious action"],
                evidenceLabels: ["teardown"],
              },
            ],
            confidenceModel: {
              highConfidenceWhen: ["source contains concrete examples"],
              lowConfidenceWhen: ["domain evidence is thin"],
              askClarifyingQuestionsWhen: ["success metric is missing"],
            },
          },
          persona: {
            tone: "direct",
            temperament: "pragmatic",
            communicationStyle: "specific and evidence-led",
          },
          boundaries: {
            refuses: ["Guaranteeing outcomes"],
            escalates: ["Legal or medical claims"],
            asksClarifyingQuestionsWhen: ["inputs lack a target user"],
          },
          examples: {
            decisionExamples: [
              {
                situation: "A vague onboarding page",
                judgment: "Cut copy until the next action is obvious.",
                reasoning: "The agent prioritizes activation clarity.",
                evidenceLabels: ["teardown"],
              },
            ],
            phrasingExamples: ["The bottleneck is not copy volume."],
          },
        },
        styleModel: {
          voicePrinciples: ["Use compact, concrete phrasing."],
          vocabulary: { uses: ["bottleneck"], avoids: ["synergy"] },
          rhetoricalMoves: ["Names the constraint first"],
          toneShifts: [{ context: "weak evidence", tone: "cautious" }],
          antiPatterns: ["Marketing fluff"],
          examples: {
            good: [
              {
                text: "The bottleneck is not copy volume.",
                why: "It isolates the constraint.",
                evidenceLabels: ["teardown"],
              },
            ],
            bad: [{ text: "This is a world-class flow.", why: "Too generic." }],
          },
          platformNotes: ["Short-form answers should stay sharp."],
        },
      })
    ).toMatchObject({
      operatingModel: {
        identity: {
          role: "Founder decision reviewer",
          influences: ["teardown notes"],
        },
        worldview: {
          tensions: [{ poles: ["speed", "evidence"] }],
        },
        decisionMaking: {
          tradeoffRules: [{ evidenceLabels: ["launch memo"] }],
        },
      },
      styleModel: {
        voicePrinciples: ["Use compact, concrete phrasing."],
        vocabulary: { uses: ["bottleneck"] },
      },
    });
  });

  it("truncates oversized style model arrays from LLM output", () => {
    const parsed = privateWorldviewSchema.parse({
      values: ["clarity"],
      heuristics: ["Prefer reversible decisions"],
      blindspots: [],
      decisionStyle: "analytical",
      freeform: "A concise worldview capsule.",
      styleModel: {
        voicePrinciples: Array.from(
          { length: 12 },
          (_, index) => `Voice principle ${index + 1}`
        ),
        vocabulary: {
          uses: Array.from({ length: 35 }, (_, index) => `use-${index + 1}`),
          avoids: Array.from(
            { length: 32 },
            (_, index) => `avoid-${index + 1}`
          ),
        },
        rhetoricalMoves: Array.from(
          { length: 14 },
          (_, index) => `Move ${index + 1}`
        ),
        toneShifts: Array.from({ length: 10 }, (_, index) => ({
          context: `Context ${index + 1}`,
          tone: "direct",
        })),
        antiPatterns: Array.from(
          { length: 14 },
          (_, index) => `Anti-pattern ${index + 1}`
        ),
        examples: {
          good: Array.from({ length: 10 }, (_, index) => ({
            text: `Good example ${index + 1}`,
            why: "It fits the source.",
          })),
          bad: Array.from({ length: 10 }, (_, index) => ({
            text: `Bad example ${index + 1}`,
            why: "It is too generic.",
          })),
        },
        platformNotes: Array.from(
          { length: 10 },
          (_, index) => `Platform note ${index + 1}`
        ),
      },
    });

    expect(parsed.styleModel?.voicePrinciples).toHaveLength(10);
    expect(parsed.styleModel?.vocabulary.uses).toHaveLength(30);
    expect(parsed.styleModel?.vocabulary.avoids).toHaveLength(30);
    expect(parsed.styleModel?.rhetoricalMoves).toHaveLength(12);
    expect(parsed.styleModel?.toneShifts).toHaveLength(8);
    expect(parsed.styleModel?.antiPatterns).toHaveLength(12);
    expect(parsed.styleModel?.examples.good).toHaveLength(8);
    expect(parsed.styleModel?.examples.bad).toHaveLength(8);
    expect(parsed.styleModel?.platformNotes).toHaveLength(8);
  });

  it("truncates oversized private worldview strings and nested evidence labels", () => {
    const long = "x".repeat(800);
    const parsed = privateWorldviewSchema.parse({
      values: Array.from({ length: 12 }, () => long),
      heuristics: Array.from({ length: 12 }, () => long),
      blindspots: Array.from({ length: 12 }, () => long),
      decisionStyle: "analytical",
      freeform: "x".repeat(6000),
      operatingModel: {
        identity: {
          role: long,
          background: long.repeat(2),
          expertiseBoundary: long.repeat(2),
        },
        worldview: {
          coreBeliefs: Array.from({ length: 12 }, () => long),
          defaultAssumptions: Array.from({ length: 12 }, () => long),
        },
        decisionMaking: {
          tradeoffRules: Array.from({ length: 10 }, () => ({
            when: long,
            prefer: long,
            over: long,
            rationale: long.repeat(2),
          })),
          rubrics: Array.from({ length: 8 }, () => ({
            domain: long,
            criteria: Array.from({ length: 12 }, () => long),
            redFlags: Array.from({ length: 12 }, () => long),
            greenFlags: Array.from({ length: 12 }, () => long),
            evidenceLabels: Array.from({ length: 12 }, () => long),
          })),
          confidenceModel: {
            highConfidenceWhen: Array.from({ length: 10 }, () => long),
            lowConfidenceWhen: Array.from({ length: 10 }, () => long),
            askClarifyingQuestionsWhen: Array.from(
              { length: 10 },
              () => long
            ),
          },
        },
        persona: {
          tone: long,
          temperament: long,
          communicationStyle: long,
        },
        boundaries: {
          refuses: Array.from({ length: 12 }, () => long),
          escalates: Array.from({ length: 12 }, () => long),
          asksClarifyingQuestionsWhen: Array.from({ length: 12 }, () => long),
        },
        examples: {
          decisionExamples: Array.from({ length: 8 }, () => ({
            situation: long,
            judgment: long,
            reasoning: long.repeat(2),
            evidenceLabels: Array.from({ length: 12 }, () => long),
          })),
          phrasingExamples: Array.from({ length: 10 }, () => long),
        },
      },
    });

    expect(parsed.values).toHaveLength(10);
    expect(parsed.values[0]).toHaveLength(400);
    expect(parsed.freeform).toHaveLength(5000);
    expect(
      parsed.operatingModel?.decisionMaking.rubrics[0].evidenceLabels
    ).toHaveLength(10);
    expect(
      parsed.operatingModel?.decisionMaking.rubrics[0].evidenceLabels?.[0]
    ).toHaveLength(100);
    expect(parsed.operatingModel?.decisionMaking.rubrics).toHaveLength(6);
    expect(
      parsed.operatingModel?.decisionMaking.rubrics[0].criteria
    ).toHaveLength(10);
  });
});
