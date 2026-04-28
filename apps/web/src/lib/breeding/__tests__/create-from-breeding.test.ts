import { describe, it, expect } from "vitest";
import type { LLMProvider, LLMMessage, Worldview } from "@thoughtline/shared";
import { createStorage } from "../../storage/index.js";
import { createAgentFromBreeding } from "../create-from-breeding.js";

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

describe("createAgentFromBreeding", () => {
  it("breeds two parents into a complete child agent", async () => {
    const storage = createStorage("memory");
    const llm = fakeLLM([
      // Call 1: synthesize child worldview (extractStructured adds system msg)
      JSON.stringify(childWorldview),
      // Call 2: generate description
      "A balanced advisor who combines courage with wisdom.",
    ]);

    const parentA = {
      id: "parent-a-id",
      name: "The Bold",
      worldview: parentWorldviewA,
      generation: 0,
    };
    const parentB = {
      id: "parent-b-id",
      name: "The Sage",
      worldview: parentWorldviewB,
      generation: 2,
    };

    const child = await createAgentFromBreeding(
      { name: "The Balanced", parentA, parentB },
      { llm, storage }
    );

    expect(child.name).toBe("The Balanced");
    expect(child.worldview).toEqual(childWorldview);
    expect(child.description).toBe(
      "A balanced advisor who combines courage with wisdom."
    );
    expect(child.generation).toBe(3); // max(0, 2) + 1
    expect(child.parentIds).toEqual(["parent-a-id", "parent-b-id"]);
    expect(child.storageUri).toBeTruthy();

    // Verify it was stored
    const fetched = await storage.fetch(child.storageUri);
    expect(fetched.name).toBe("The Balanced");
    expect(fetched.parentIds).toEqual(["parent-a-id", "parent-b-id"]);
    expect(fetched.generation).toBe(3);
  });
});
