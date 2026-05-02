import { describe, expect, it } from "vitest";
import {
  createPrivateDataProofRequest,
  filterPublicAgentFeed,
  getPublicAgentLineage,
  type PublicAgentProofState,
} from "../public-feed";
import type { PublicAgentView } from "../public-agents";

const agent: PublicAgentView = {
  tokenId: "7",
  owner: "0x7777777777777777777777777777777777777777",
  publicUri: "0g://public",
  privateUri: "0g://private",
  dataHash: `0x${"7".repeat(64)}`,
  hasParents: false,
  parentA: null,
  parentB: null,
  publicProfile: {
    name: "Clarity",
    description: "Reviews hard decisions.",
    expertiseType: "Decision review specialist",
    sourceLabels: ["founder notes", "customer calls"],
    sourceCount: 2,
    positioning: "Helps founders review launch decisions.",
    skills: [
      {
        id: "decision-review",
        name: "Decision Review",
        description: "Reviews tradeoffs.",
        skillMarkdown: "Find the hard tradeoff.",
        source: "genesis",
        parentSkillIds: [],
      },
    ],
    parentIds: null,
    generation: 0,
    createdAt: "2026-04-29T00:00:00.000Z",
  },
};

describe("public agent feed", () => {
  it("filters by public profile and proof fields", () => {
    expect(filterPublicAgentFeed([agent], "tradeoff")).toEqual([agent]);
    expect(filterPublicAgentFeed([agent], "0g://private")).toEqual([agent]);
    expect(filterPublicAgentFeed([agent], "customer calls")).toEqual([agent]);
    expect(filterPublicAgentFeed([agent], "launch decisions")).toEqual([agent]);
    expect(filterPublicAgentFeed([agent], "missing")).toEqual([]);
  });

  it("formats lineage and proof requests for callers", () => {
    expect(getPublicAgentLineage(agent)).toBe("Genesis");
    expect(createPrivateDataProofRequest(agent)).toEqual({
      privateUri: "0g://private",
      dataHash: `0x${"7".repeat(64)}`,
    });
  });

  it("keeps proof state explicit", () => {
    const state: PublicAgentProofState = { status: "idle" };
    expect(state.status).toBe("idle");
  });
});
