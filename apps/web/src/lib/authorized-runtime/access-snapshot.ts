import type {
  PrivateWorldview,
  PublicProfile,
  StorageProvider,
} from "@thoughtline/shared";
import {
  AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR,
  createAgentArchive,
  type AgentArchive,
} from "../agent-archive/index";
import type { ThoughtLineChainReader } from "../chain/reader";

export interface AgentAccessSnapshot {
  ownerAddress: string;
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
  authorizedUsers: string[];
  authorizedBreeders: string[];
}

export interface AgentAccessSnapshotReaderDeps {
  chain: ThoughtLineChainReader;
  storage: StorageProvider;
  archive?: AgentArchive;
  privateWorldviews?: Record<string, PrivateWorldview>;
}

export interface AgentAccessSnapshotReader {
  load(tokenId: string): Promise<AgentAccessSnapshot>;
}

export function createAgentAccessSnapshotReader(
  deps: AgentAccessSnapshotReaderDeps
): AgentAccessSnapshotReader {
  const archive = deps.archive ?? createAgentArchive(deps.storage);

  return {
    async load(tokenId): Promise<AgentAccessSnapshot> {
      const [
        ownerAddress,
        publicUri,
        privateUri,
        authorizedUsers,
        authorizedBreeders,
      ] = await Promise.all([
        deps.chain.ownerOf(tokenId),
        deps.chain.publicProfileURI(tokenId),
        deps.chain.privateWorldviewURI(tokenId),
        deps.chain.authorizedUsersOf(tokenId),
        deps.chain.authorizedBreedersOf(tokenId),
      ]);

      const [publicProfile, privateWorldview] = await Promise.all([
        archive.loadPublic(publicUri),
        loadPrivateWorldview(
          archive,
          tokenId,
          privateUri,
          deps.privateWorldviews?.[tokenId]
        ),
      ]);

      return {
        ownerAddress,
        publicProfile,
        privateWorldview,
        authorizedUsers,
        authorizedBreeders,
      };
    },
  };
}

async function loadPrivateWorldview(
  archive: AgentArchive,
  tokenId: string,
  privateUri: string,
  privateWorldview?: PrivateWorldview
): Promise<PrivateWorldview> {
  if (privateWorldview) return privateWorldview;
  try {
    return await archive.loadPrivateForRuntime(privateUri);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR
    ) {
      throw new Error(
        `Parent #${tokenId} was stored before runtime breeding access was enabled. Unlock that parent in this browser before breeding, or recreate it with the current create flow.`
      );
    }
    throw error;
  }
}
