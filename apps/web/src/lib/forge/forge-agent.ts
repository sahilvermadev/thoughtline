import type {
  AgentMetadata,
  PrivateWorldview,
  PublicProfile,
  LLMProvider,
  SkillPackage,
} from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index.js";
import type { EncryptionKey } from "../crypto/index.js";

export interface ForgeParent {
  id: string;
  name: string;
  generation: number;
}

export interface ForgeInput {
  name: string;
  parents: [ForgeParent, ForgeParent] | null;
  encryptionKey: EncryptionKey;
  synthesizeGenome: () => Promise<{
    privateWorldview: PrivateWorldview;
    skills: SkillPackage[];
  }>;
}

export interface ForgeDeps {
  llm: LLMProvider;
  archive: AgentArchive;
}

export interface ForgedAgent {
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
  metadata: AgentMetadata;
  publicUri: string;
  publicHash: string;
  privateUri: string;
  dataHash: string;
  // Convenience mirrors for current callers/tests.
  name: string;
  description: string;
  skills: SkillPackage[];
  generation: number;
  parentIds: [string, string] | null;
}

export async function forgeAgent(
  input: ForgeInput,
  deps: ForgeDeps
): Promise<ForgedAgent> {
  const { name, parents, encryptionKey, synthesizeGenome } = input;
  const { llm, archive } = deps;

  if (!name.trim()) throw new Error("Name is required");

  const { privateWorldview, skills } = await synthesizeGenome();

  const lineageContext = parents
    ? `Parents: "${parents[0].name}" and "${parents[1].name}"\n\n`
    : "";

  const descriptionResponse = await llm.chat([
    {
      role: "system",
      content:
        "Write a concise description (1-2 sentences, max 500 chars) of this AI advisor agent based on their worldview and lineage. No JSON, just plain text.",
    },
    {
      role: "user",
      content: `Agent name: ${name}\n${lineageContext}Private worldview:\n${JSON.stringify(privateWorldview, null, 2)}\n\nPublic skills:\n${JSON.stringify(skills, null, 2)}`,
    },
  ]);

  const description = descriptionResponse.content.trim();
  const generation = parents
    ? Math.max(parents[0].generation, parents[1].generation) + 1
    : 0;
  const parentIds: [string, string] | null = parents
    ? [parents[0].id, parents[1].id]
    : null;

  const publicProfile: PublicProfile = {
    name,
    description,
    skills,
    parentIds,
    generation,
    createdAt: new Date().toISOString(),
  };

  const metadata: AgentMetadata = {
    publicProfile,
    privateWorldview,
  };

  const stored = await archive.store(metadata, encryptionKey);

  return {
    publicProfile,
    privateWorldview,
    metadata,
    publicUri: stored.publicUri,
    publicHash: stored.publicHash,
    privateUri: stored.privateUri,
    dataHash: stored.dataHash,
    name,
    description,
    skills,
    generation,
    parentIds,
  };
}
