import type {
  PrivateWorldview,
  PublicProfile,
  StorageProvider,
} from "@thoughtline/shared";
import {
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
        archive.loadPrivateForRuntime(privateUri),
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
