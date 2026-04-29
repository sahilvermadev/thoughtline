import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";
import type { EncryptionKey } from "../crypto/index.js";
import type { AgentArchive } from "../agent-archive/index.js";
import { createAgentFromBreeding } from "../breeding/create-from-breeding.js";

export interface BreedingAccessRecord {
  ownerAddress: string;
  authorizedBreeders: string[];
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
}

export interface BreedingAccessReader {
  getBreedingAccess(tokenId: string): Promise<BreedingAccessRecord>;
}

export interface AuthorizedBreedingRuntimeInput {
  parentTokenIdA: string;
  parentTokenIdB: string;
  callerAddress: string;
  childName: string;
  encryptionKey: EncryptionKey;
}

export interface AuthorizedBreedingRuntimeDeps {
  accessReader: BreedingAccessReader;
  llm: LLMProvider;
  archive: AgentArchive;
}

export function createAuthorizedBreedingRuntime(
  deps: AuthorizedBreedingRuntimeDeps
) {
  return {
    async breed(input: AuthorizedBreedingRuntimeInput) {
      const [parentA, parentB] = await Promise.all([
        deps.accessReader.getBreedingAccess(input.parentTokenIdA),
        deps.accessReader.getBreedingAccess(input.parentTokenIdB),
      ]);

      assertCanBreed(input.callerAddress, parentA, input.parentTokenIdA);
      assertCanBreed(input.callerAddress, parentB, input.parentTokenIdB);

      return createAgentFromBreeding(
        {
          name: input.childName,
          parentA: {
            id: input.parentTokenIdA,
            publicProfile: parentA.publicProfile,
            privateWorldview: parentA.privateWorldview,
          },
          parentB: {
            id: input.parentTokenIdB,
            publicProfile: parentB.publicProfile,
            privateWorldview: parentB.privateWorldview,
          },
          encryptionKey: input.encryptionKey,
        },
        {
          llm: deps.llm,
          archive: deps.archive,
        }
      );
    },
  };
}

export function canBreedWith(
  callerAddress: string,
  access: Pick<BreedingAccessRecord, "ownerAddress" | "authorizedBreeders">
): boolean {
  const caller = normalizeAddress(callerAddress);
  return (
    caller === normalizeAddress(access.ownerAddress) ||
    access.authorizedBreeders.some((user) => normalizeAddress(user) === caller)
  );
}

function assertCanBreed(
  callerAddress: string,
  access: BreedingAccessRecord,
  tokenId: string
): void {
  if (!canBreedWith(callerAddress, access)) {
    throw new Error(`Caller is not authorized to breed with agent ${tokenId}`);
  }
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}
