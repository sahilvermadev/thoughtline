import type { LLMProvider, PrivateWorldview, PublicProfile } from "@thoughtline/shared";
import { privateWorldviewSchema } from "@thoughtline/shared";
import { extractStructured } from "../llm/extract-structured";
import type { AgentArchive } from "../agent-archive/index";
import { forgeAgent, type ForgedAgent } from "../forge/forge-agent";
import type { EncryptionKey } from "../crypto/index";
import { synthesizeChildSkills } from "../skills/synthesis";
import { emitProgress, type ProgressEmitter } from "../progress";

export interface ParentAgent {
  id: string;
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
}

export interface BreedingInput {
  name: string;
  childBrief?: string;
  parentA: ParentAgent;
  parentB: ParentAgent;
  encryptionKey: EncryptionKey;
}

export interface BreedingDeps {
  llm: LLMProvider;
  archive: AgentArchive;
  emit?: ProgressEmitter;
}

export async function createAgentFromBreeding(
  input: BreedingInput,
  deps: BreedingDeps
): Promise<ForgedAgent> {
  const { name, childBrief, parentA, parentB, encryptionKey } = input;
  const { llm, archive } = deps;

  return forgeAgent(
    {
      name,
      parents: [
        {
          id: parentA.id,
          name: parentA.publicProfile.name,
          generation: parentA.publicProfile.generation,
        },
        {
          id: parentB.id,
          name: parentB.publicProfile.name,
          generation: parentB.publicProfile.generation,
        },
      ],
      encryptionKey,
      publicMetadata: {
        ...(childBrief?.trim() ? { positioning: childBrief.trim() } : {}),
      },
      emit: deps.emit,
      synthesizeGenome: async () => {
        await emitProgress(deps.emit, "synthesizing-worldview");
        const privateWorldview = await extractStructured(
          llm,
          [
            {
              role: "user",
              content: `You are a worldview synthesizer. Given two parent expertise agents, create a child agent for a specific marketable purpose while inheriting and resolving conflicts between their worldviews.

Child name: ${name}
Child brief / intended marketable purpose: ${childBrief?.trim() || "Not specified"}

Parent A "${parentA.publicProfile.name}":
${JSON.stringify(parentA.privateWorldview, null, 2)}

Parent B "${parentB.publicProfile.name}":
${JSON.stringify(parentB.privateWorldview, null, 2)}

Create a child worldview that:
1. Serves the child brief as a concrete expertise product
2. Inherits complementary values from both parents
3. Resolves conflicting heuristics into coherent principles
4. Identifies new blindspots that emerge from the synthesis
5. Develops a decision style that balances both parents
6. Writes a freeform private operating model that integrates both perspectives

Respond with a JSON object matching this schema:
- values: string[] (1-10 items)
- heuristics: string[] (1-10 items)
- blindspots: string[] (0-10 items)
- decisionStyle: "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian"
- freeform: string (max 5000 chars)

Respond ONLY with valid JSON, no other text.`,
            },
          ],
          privateWorldviewSchema
        );

        await emitProgress(deps.emit, "synthesizing-skills");
        const skills = await synthesizeChildSkills(llm, {
          childName: name,
          childBrief,
          childWorldview: privateWorldview,
          parentA,
          parentB,
        });

        return { privateWorldview, skills };
      },
    },
    { llm, archive }
  );
}
