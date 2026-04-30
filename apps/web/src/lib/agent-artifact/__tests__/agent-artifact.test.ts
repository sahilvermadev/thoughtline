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
});
