import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { THOUGHTLINE_AGENT_ABI } from "@/lib/chain/thoughtline";
import {
  createGenesisMintArtifact,
  createStoredAgentPointers,
  normalizeStoredAgentDataHash,
} from "../index";

const publicProfile = {
  name: "Clarity",
  description: "A careful advisor.",
  skills: [
    {
      id: "decision-review",
      name: "Decision Review",
      description: "Reviews tradeoffs.",
      skillMarkdown: "## Procedure\nReview tradeoffs.",
      source: "genesis" as const,
      parentSkillIds: [],
    },
  ],
  parentIds: null,
  generation: 0,
  createdAt: "2026-04-29T00:00:00.000Z",
};

describe("agent artifact module", () => {
  it("creates a coherent genesis mint artifact from stored public/private data", () => {
    const artifact = createGenesisMintArtifact(
      {
        publicProfile,
        publicUri: "0g://public",
        publicHash: "public-hash",
        privateUri: "0g://private",
        dataHash: "a".repeat(64),
      },
      {
        NEXT_PUBLIC_CONTRACT_ADDRESS:
          "0x1111111111111111111111111111111111111111",
        NEXT_PUBLIC_CHAIN_ID: "16602",
      }
    );

    expect(artifact.dataHash).toBe(`0x${"a".repeat(64)}`);
    expect(artifact.mintTransaction.to).toBe(
      "0x1111111111111111111111111111111111111111"
    );

    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data: artifact.mintCalldata,
    });
    expect(decoded.args).toEqual([
      "0g://public",
      "0g://private",
      artifact.dataHash,
    ]);
  });

  it("normalizes stored agent pointers for proof and gallery callers", () => {
    const pointers = createStoredAgentPointers({
      publicUri: "0g://public",
      privateUri: "0g://private",
      dataHash: "b".repeat(64),
    });

    expect(pointers.dataHash).toBe(`0x${"b".repeat(64)}`);
    expect(normalizeStoredAgentDataHash(`0x${"c".repeat(64)}`)).toBe(
      `0x${"c".repeat(64)}`
    );
  });

  it("summarizes style and contradictions while returning full private fields for creator review", () => {
    const artifact = createGenesisMintArtifact(
      {
        publicProfile,
        privateWorldview: {
          values: ["clarity"],
          heuristics: ["Prefer reversible tests"],
          blindspots: [],
          decisionStyle: "analytical",
          freeform: "Private details should not be returned.",
          operatingModel: {
            identity: {
              role: "Launch reviewer",
              background: "Built from launch notes.",
              expertiseBoundary: "Early launch decisions.",
            },
            worldview: {
              coreBeliefs: ["Evidence beats polish."],
              defaultAssumptions: [],
              tensions: [
                {
                  tension: "Speed matters, but evidence sets the ceiling.",
                  poles: ["speed", "evidence"],
                  howToResolve: "Use reversible tests before heavy polish.",
                },
              ],
            },
            decisionMaking: {
              tradeoffRules: [],
              rubrics: [],
              confidenceModel: {
                highConfidenceWhen: ["examples are concrete"],
                lowConfidenceWhen: [],
                askClarifyingQuestionsWhen: [],
              },
            },
            persona: {
              tone: "direct",
              temperament: "careful",
              communicationStyle: "plainspoken",
            },
            boundaries: {
              refuses: [],
              escalates: [],
              asksClarifyingQuestionsWhen: [],
            },
            examples: {
              decisionExamples: [],
              phrasingExamples: [],
            },
          },
          styleModel: {
            voicePrinciples: ["Use compact, concrete phrasing."],
            vocabulary: { uses: ["bottleneck"], avoids: ["synergy"] },
            rhetoricalMoves: ["Names the constraint first"],
            toneShifts: [],
            antiPatterns: [],
            examples: { good: [], bad: [] },
          },
        },
        publicUri: "0g://public",
        publicHash: "public-hash",
        privateUri: "0g://private",
        dataHash: "d".repeat(64),
      },
      {}
    );

    expect(artifact.privateWorldviewSummary).toMatchObject({
      identity: "Launch reviewer",
      style:
        "Use compact, concrete phrasing.; often uses names the constraint first.",
      contradictions:
        "Speed matters, but evidence sets the ceiling. Resolved by use reversible tests before heavy polish.",
    });
    expect(artifact.privateWorldview?.freeform).toBe(
      "Private details should not be returned."
    );
  });
});
