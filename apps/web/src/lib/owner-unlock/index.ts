import type { PrivateWorldview, StorageProvider } from "@thoughtline/shared";
import { createAgentArchive } from "@/lib/agent-archive";
import type { EthereumProvider } from "@/lib/browser-wallet";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { createBrowserReadableStorage } from "@/lib/storage/browser";
import { buildUnlockMessage, deriveUnlockKey, type UnlockScope } from "@/lib/unlock";

export interface UnlockAgentInput {
  agent: PublicAgentView;
  connectedAddress: string | null;
  ethereum: EthereumProvider;
  storage?: StorageProvider;
}

export async function unlockAgentWorldview(
  input: UnlockAgentInput
): Promise<PrivateWorldview> {
  assertConnectedOwner(input.connectedAddress, input.agent);

  const signature = (await input.ethereum.request({
    method: "personal_sign",
    params: [
      buildUnlockMessage({
        scope: creationUnlockScope(input.agent),
        ownerAddress: input.connectedAddress,
        agentName: input.agent.publicProfile.name,
      }),
      input.connectedAddress,
    ],
  })) as string;
  const key = await deriveUnlockKey(signature);
  const archive = createAgentArchive(input.storage ?? createBrowserReadableStorage());

  return archive.loadPrivate(input.agent.privateUri, key);
}

function creationUnlockScope(agent: PublicAgentView): UnlockScope {
  return agent.publicProfile.generation > 0 ||
    agent.publicProfile.parentIds !== null
    ? "breeding-child"
    : "genesis";
}

function assertConnectedOwner(
  connectedAddress: string | null,
  agent: Pick<PublicAgentView, "owner">
): asserts connectedAddress is string {
  if (!connectedAddress) {
    throw new Error("Connect the owner wallet before unlocking.");
  }

  if (connectedAddress.toLowerCase() !== agent.owner.toLowerCase()) {
    throw new Error("Only the token owner can unlock this private worldview.");
  }
}
