import type { PublicProfile, StorageProvider } from "@thoughtline/shared";
import { createAgentArchive } from "../agent-archive";

export interface MintedAgentRecord {
  tokenId: bigint;
  owner: `0x${string}`;
  publicUri: string;
  privateUri: string;
  dataHash: `0x${string}`;
  hasParents: boolean;
  parentA: bigint;
  parentB: bigint;
}

export interface PublicGalleryAgent extends MintedAgentRecord {
  publicProfile: PublicProfile;
}

export interface PublicAgentHydrationFailure {
  tokenId: string;
  publicUri: string;
  error: string;
}

export interface PublicAgentsResult {
  agents: PublicGalleryAgent[];
  failures: PublicAgentHydrationFailure[];
}

export interface PublicAgentSource {
  listMintedAgents(): Promise<MintedAgentRecord[]>;
}

export interface LoadPublicAgentsDeps {
  storage: StorageProvider;
  source: PublicAgentSource;
}

export async function loadPublicAgents(
  deps: LoadPublicAgentsDeps
): Promise<PublicGalleryAgent[]> {
  return (await loadPublicAgentsResult(deps)).agents;
}

export async function loadPublicAgentsResult(
  deps: LoadPublicAgentsDeps
): Promise<PublicAgentsResult> {
  const archive = createAgentArchive(deps.storage);
  const mintedAgents = await deps.source.listMintedAgents();
  const loadedAgents = await Promise.allSettled(
    mintedAgents.map(async (agent) => ({
      ...agent,
      publicProfile: await archive.loadPublic(agent.publicUri),
    }))
  );

  const agents: PublicGalleryAgent[] = [];
  const failures: PublicAgentHydrationFailure[] = [];

  loadedAgents.forEach((result, index) => {
    if (result.status === "fulfilled") {
      agents.push(result.value);
      return;
    }

    const mintedAgent = mintedAgents[index];
    failures.push({
      tokenId: mintedAgent.tokenId.toString(),
      publicUri: mintedAgent.publicUri,
      error: formatError(result.reason),
    });
  });

  return {
    agents: agents.sort((left, right) =>
      left.tokenId === right.tokenId
        ? 0
        : left.tokenId > right.tokenId
          ? -1
          : 1
    ),
    failures,
  };
}

export interface PublicAgentView {
  tokenId: string;
  owner: `0x${string}`;
  publicUri: string;
  privateUri: string;
  dataHash: `0x${string}`;
  hasParents: boolean;
  parentA: string | null;
  parentB: string | null;
  publicProfile: PublicProfile;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function serializePublicAgents(
  agents: PublicGalleryAgent[]
): PublicAgentView[] {
  return agents.map((agent) => ({
    tokenId: agent.tokenId.toString(),
    owner: agent.owner,
    publicUri: agent.publicUri,
    privateUri: agent.privateUri,
    dataHash: agent.dataHash,
    hasParents: agent.hasParents,
    parentA: agent.hasParents ? agent.parentA.toString() : null,
    parentB: agent.hasParents ? agent.parentB.toString() : null,
    publicProfile: agent.publicProfile,
  }));
}
