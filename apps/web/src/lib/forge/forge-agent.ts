import type {
  AgentMetadata,
  PrivateWorldview,
  PublicProfile,
  LLMProvider,
  SkillPackage,
} from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index";
import type { EncryptionKey } from "../crypto/index";
import { emitProgress, type ProgressEmitter } from "../progress";

export interface ForgeParent {
  id: string;
  name: string;
  generation: number;
}

export interface ForgeInput {
  name: string;
  parents: [ForgeParent, ForgeParent] | null;
  encryptionKey: EncryptionKey;
  publicMetadata?: Pick<
    PublicProfile,
    "expertiseType" | "sourceLabels" | "sourceCount" | "positioning"
  >;
  emit?: ProgressEmitter;
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
  const { name, parents, encryptionKey, publicMetadata, synthesizeGenome } =
    input;
  const { llm, archive } = deps;

  if (!name.trim()) throw new Error("Name is required");

  const { privateWorldview, skills } = await synthesizeGenome();

  const lineageContext = parents
    ? `Parents: "${parents[0].name}" and "${parents[1].name}"\n\n`
    : "";

  const positioningContext = publicMetadata
    ? `Expertise positioning:\n${JSON.stringify(publicMetadata, null, 2)}\n\n`
    : "";

  const descriptionResponse = await llm.chat([
    {
      role: "system",
      content:
        "Write a concise buyer-facing description (1-2 sentences, max 500 chars) of this AI expertise agent based on their worldview, capabilities, and positioning. No JSON, just plain text.",
    },
    {
      role: "user",
      content: `Agent name: ${name}\n${lineageContext}${positioningContext}Private worldview:\n${JSON.stringify(privateWorldview, null, 2)}\n\nPublic skills:\n${JSON.stringify(skills, null, 2)}`,
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
    ...publicMetadata,
  };

  const metadata: AgentMetadata = {
    publicProfile,
    privateWorldview,
  };

  await emitProgress(input.emit, "encrypting");
  await emitProgress(input.emit, "uploading", { target: "both" });
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
