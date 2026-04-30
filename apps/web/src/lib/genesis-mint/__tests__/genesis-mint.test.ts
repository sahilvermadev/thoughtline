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
      "synthesizing-worldview",
      "synthesizing-skills",
      "encrypting",
      "uploading",
      "ready",
    ]);
    expect(JSON.stringify(artifact)).not.toContain("Private fingerprint");
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
