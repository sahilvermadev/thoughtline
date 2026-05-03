import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import type { LLMMessage, LLMProvider } from "@thoughtline/shared";
import { createAgentArchive } from "@/lib/agent-archive";
import { THOUGHTLINE_AGENT_ABI } from "@/lib/chain/thoughtline";
import { createMemoryStorage } from "@/lib/storage/memory";
import { createGenesisMint } from "../index";

describe("genesis mint module", () => {
  it("turns source text into stored split genome and mint artifacts", async () => {
    const events: string[] = [];
    const artifact = await createGenesisMint(
      {
        name: "Clarity",
        ownerAddress: "0x1111111111111111111111111111111111111111",
        unlockSignature: "0xsigned",
        sources: [{ text: "Prefer reversible decisions." }],
      },
      {
        llm: fakeGenesisLlm(),
        archive: createAgentArchive(createMemoryStorage()),
        emit: (event) => {
          events.push(event);
        },
        env: {
          NEXT_PUBLIC_CONTRACT_ADDRESS:
            "0x2222222222222222222222222222222222222222",
          NEXT_PUBLIC_CHAIN_ID: "16602",
        },
      }
    );

    expect(events).toEqual([
      "preparing",
      "preparing-sources",
      "synthesizing-worldview",
      "synthesizing-skills",
      "encrypting",
      "uploading",
      "ready",
    ]);
    expect(artifact.privateWorldview?.freeform).toBe("Private fingerprint");
    expect(artifact.privateWorldviewSummary).toEqual({
      identity: "Decision advisor grounded in reversible choices.",
      decisionMaking:
        "Prefers reversible decisions over premature commitment when uncertainty is high.",
      confidence:
        "High confidence with concrete examples; asks for clarification when stakes or reversibility are unclear.",
      boundaries: "Does not guarantee outcomes.",
    });
    expect(artifact.publicUri).toMatch(/^memory:\/\//);
    expect(artifact.privateUri).toMatch(/^memory:\/\//);

    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data: artifact.mintCalldata,
    });
    expect(decoded.args).toEqual([
      artifact.publicUri,
      artifact.privateUri,
      artifact.dataHash,
    ]);
  });
});

function fakeGenesisLlm(): LLMProvider {
  return {
    async chat(messages: LLMMessage[]) {
      const prompt = messages.at(-1)?.content ?? "";
      if (prompt.includes("Extract the private worldview")) {
        return {
          content: JSON.stringify({
            privateWorldview: {
              values: ["clarity"],
              heuristics: ["Prefer reversible decisions"],
              blindspots: [],
              decisionStyle: "analytical",
              freeform: "Private fingerprint",
              operatingModel: {
                identity: {
                  role: "Decision advisor grounded in reversible choices.",
                  background: "Extracted from decision notes.",
                  expertiseBoundary: "Product and founder decisions.",
                },
                worldview: {
                  coreBeliefs: ["Reversibility should shape urgency."],
                  defaultAssumptions: ["Uncertainty is normal."],
                },
                decisionMaking: {
                  tradeoffRules: [
                    {
                      when: "Uncertainty is high",
                      prefer: "reversible decisions",
                      over: "premature commitment",
                      rationale:
                        "The source emphasizes preserving optionality.",
                    },
                  ],
                  rubrics: [],
                  confidenceModel: {
                    highConfidenceWhen: ["Concrete examples are present"],
                    lowConfidenceWhen: ["Stakes are unclear"],
                    askClarifyingQuestionsWhen: [
                      "Reversibility is unclear",
                    ],
                  },
                },
                persona: {
                  tone: "direct",
                  temperament: "careful",
                  communicationStyle: "concise",
                },
                boundaries: {
                  refuses: ["Guaranteeing outcomes"],
                  escalates: [],
                  asksClarifyingQuestionsWhen: ["Stakes are unclear"],
                },
                examples: {
                  decisionExamples: [],
                  phrasingExamples: [],
                },
              },
            },
          }),
        };
      }

      if (prompt.includes("Create 3-5 public skill packages")) {
        return {
          content: JSON.stringify({
            skills: [
              {
                id: "decision-review",
                name: "Decision Review",
                description: "Reviews decisions.",
                skillMarkdown: "## Procedure\nReview the decision.",
                source: "genesis",
                parentSkillIds: [],
              },
            ],
          }),
        };
      }

      return { content: "A careful decision advisor." };
    },
    async *chatStream() {
      yield { content: "ok", done: true };
    },
  };
}
