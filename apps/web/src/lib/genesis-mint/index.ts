import type { LLMProvider } from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive";
import { createGenesisMintArtifact, type GenesisMintArtifact } from "../agent-artifact";
import { createAgentFromText, type TextSource } from "../agents/create-from-text";
import { emitProgress, runProgressStep } from "../progress";
import { deriveUnlockKey } from "../unlock";

export interface GenesisMintInput {
  name: string;
  sources: TextSource[];
  ownerAddress: string;
  unlockSignature: string;
}

export interface GenesisMintDeps {
  llm: LLMProvider;
  archive: AgentArchive;
  emit?: (event: string, data?: unknown) => Promise<void> | void;
  env?: Record<string, string | undefined>;
}

export async function createGenesisMint(
  input: GenesisMintInput,
  deps: GenesisMintDeps
): Promise<GenesisMintArtifact> {
  const encryptionKey = await runProgressStep(
    deps.emit,
    "preparing",
    () => deriveUnlockKey(input.unlockSignature),
    { ownerAddress: input.ownerAddress }
  );

  const agent = await createAgentFromText(
    {
      name: input.name,
      sources: input.sources,
      encryptionKey,
    },
    {
      llm: deps.llm,
      archive: deps.archive,
      emit: deps.emit,
    }
  );

  const artifact = createGenesisMintArtifact(
    {
      publicProfile: agent.publicProfile,
      publicUri: agent.publicUri,
      publicHash: agent.publicHash,
      privateUri: agent.privateUri,
      dataHash: agent.dataHash,
    },
    deps.env
  );

  await emitProgress(deps.emit, "ready", artifact);
  return artifact;
}
