import type { StorageProvider } from "@thoughtline/shared";
import {
  createAgentArchive,
  type AgentArchive,
} from "../agent-archive/index";
import type { ThoughtLineChainReader } from "../chain/reader";
import type { AgentAccessReader, AgentAccessRecord } from "./index";

export interface ChainAgentAccessReaderDeps {
  chain: ThoughtLineChainReader;
  storage: StorageProvider;
  archive?: AgentArchive;
}

export function createChainAgentAccessReader(
  deps: ChainAgentAccessReaderDeps
): AgentAccessReader {
  const archive = deps.archive ?? createAgentArchive(deps.storage);

  return {
    async getAgentAccess(tokenId): Promise<AgentAccessRecord> {
      const [ownerAddress, publicUri, privateUri, authorizedUsers] =
        await Promise.all([
          deps.chain.ownerOf(tokenId),
          deps.chain.publicProfileURI(tokenId),
          deps.chain.privateWorldviewURI(tokenId),
          deps.chain.authorizedUsersOf(tokenId),
        ]);

      const [publicProfile, privateWorldview] = await Promise.all([
        archive.loadPublic(publicUri),
        archive.loadPrivateForRuntime(privateUri),
      ]);

      return {
        ownerAddress,
        authorizedUsers,
        publicProfile,
        privateWorldview,
      };
    },
  };
}
