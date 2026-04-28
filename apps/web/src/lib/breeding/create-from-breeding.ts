import type {
  LLMProvider,
  StorageProvider,
  AgentMetadata,
  Worldview,
} from "@thoughtline/shared";
import { worldviewSchema } from "@thoughtline/shared";
import { extractStructured } from "../llm/extract-structured.js";

export interface ParentAgent {
  id: string;
  name: string;
  worldview: Worldview;
  generation: number;
}

export interface BreedingInput {
  name: string;
  parentA: ParentAgent;
  parentB: ParentAgent;
}

export interface BreedingDeps {
  llm: LLMProvider;
  storage: StorageProvider;
}

export interface BredAgent {
  name: string;
  description: string;
  worldview: Worldview;
  generation: number;
  parentIds: [string, string];
  storageUri: string;
}

export async function createAgentFromBreeding(
  input: BreedingInput,
  deps: BreedingDeps
): Promise<BredAgent> {
  const { name, parentA, parentB } = input;
  const { llm, storage } = deps;

  const worldview = await extractStructured(
    llm,
    [
      {
        role: "user",
        content: `You are a worldview synthesizer. Given two parent advisor agents, create a child agent that inherits and resolves conflicts between their worldviews.

Parent A "${parentA.name}":
${JSON.stringify(parentA.worldview, null, 2)}

Parent B "${parentB.name}":
${JSON.stringify(parentB.worldview, null, 2)}

Create a child worldview that:
1. Inherits complementary values from both parents
2. Resolves conflicting heuristics into coherent principles
3. Identifies new blindspots that emerge from the synthesis
4. Develops a decision style that balances both parents
5. Writes a freeform persona that integrates both perspectives

Respond with a JSON object matching this schema:
- values: string[] (1-10 items)
- heuristics: string[] (1-10 items)
- blindspots: string[] (0-10 items)
- decisionStyle: "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian"
- freeform: string (max 5000 chars)

Respond ONLY with valid JSON, no other text.`,
      },
    ],
    worldviewSchema
  );

  const descriptionResponse = await llm.chat([
    {
      role: "system",
      content:
        "Write a concise description (1-2 sentences, max 500 chars) of this AI advisor agent based on their worldview and lineage. No JSON, just plain text.",
    },
    {
      role: "user",
      content: `Agent name: ${name}\nParents: "${parentA.name}" and "${parentB.name}"\n\nWorldview:\n${JSON.stringify(worldview, null, 2)}`,
    },
  ]);

  const description = descriptionResponse.content.trim();
  const generation = Math.max(parentA.generation, parentB.generation) + 1;
  const parentIds: [string, string] = [parentA.id, parentB.id];

  const metadata: AgentMetadata = {
    name,
    description,
    worldview,
    parentIds,
    generation,
    createdAt: new Date().toISOString(),
  };

  const storageUri = await storage.upload(metadata);

  return {
    name,
    description,
    worldview,
    generation,
    parentIds,
    storageUri,
  };
}
