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
  const { name, parentA, parentB, encryptionKey } = input;
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
      emit: deps.emit,
      synthesizeGenome: async () => {
        await emitProgress(deps.emit, "synthesizing-worldview");
        const privateWorldview = await extractStructured(
          llm,
          [
            {
              role: "user",
              content: `You are a worldview synthesizer. Given two parent advisor agents, create a child agent that inherits and resolves conflicts between their worldviews.

Parent A "${parentA.publicProfile.name}":
${JSON.stringify(parentA.privateWorldview, null, 2)}

Parent B "${parentB.publicProfile.name}":
${JSON.stringify(parentB.privateWorldview, null, 2)}

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
          privateWorldviewSchema
        );

        await emitProgress(deps.emit, "synthesizing-skills");
        const skills = await synthesizeChildSkills(llm, {
          childName: name,
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
