import type { PrivateWorldview, StorageProvider } from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index";
import type { ThoughtLineChainReader } from "../chain/reader";
import type { AgentAccessReader, AgentAccessRecord } from "./index";
import type { BreedingAccessReader, BreedingAccessRecord } from "./breeding";
import { createAgentAccessSnapshotReader } from "./access-snapshot";

export interface ChainAgentAccessReaderDeps {
  chain: ThoughtLineChainReader;
  storage: StorageProvider;
  archive?: AgentArchive;
  privateWorldviews?: Record<string, PrivateWorldview>;
}

export function createChainAgentAccessReader(
  deps: ChainAgentAccessReaderDeps
): AgentAccessReader {
  const snapshots = createAgentAccessSnapshotReader(deps);

  return {
    async getAgentAccess(tokenId): Promise<AgentAccessRecord> {
      const snapshot = await snapshots.load(tokenId);

      return {
        ownerAddress: snapshot.ownerAddress,
        authorizedUsers: snapshot.authorizedUsers,
        publicProfile: snapshot.publicProfile,
        privateWorldview: snapshot.privateWorldview,
      };
    },
  };
}

export function createChainBreedingAccessReader(
  deps: ChainAgentAccessReaderDeps
): BreedingAccessReader {
  const snapshots = createAgentAccessSnapshotReader(deps);

  return {
    async getBreedingAccess(tokenId): Promise<BreedingAccessRecord> {
      const snapshot = await snapshots.load(tokenId);

      return {
        ownerAddress: snapshot.ownerAddress,
        authorizedBreeders: snapshot.authorizedBreeders,
        publicProfile: snapshot.publicProfile,
        privateWorldview: snapshot.privateWorldview,
      };
    },
  };
}
