import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";
import type { EncryptionKey } from "../crypto/index";
import type { ProgressEmitter } from "../progress";
import type { AgentArchive } from "../agent-archive/index";
import {
  assertCanUseCapability,
  canUseCapability,
} from "../authorization/access";
import { createAgentFromBreeding } from "../breeding/create-from-breeding";

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
  childBrief?: string;
  encryptionKey: EncryptionKey;
  emit?: ProgressEmitter;
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
          childBrief: input.childBrief,
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
          emit: input.emit,
        }
      );
    },
  };
}

export function canBreedWith(
  callerAddress: string,
  access: Pick<BreedingAccessRecord, "ownerAddress" | "authorizedBreeders">
): boolean {
  return canUseCapability({
    capability: "breeding",
    callerAddress,
    tokenId: "unknown",
    access: {
      ownerAddress: access.ownerAddress,
      authorizedAddresses: access.authorizedBreeders,
    },
  });
}

function assertCanBreed(
  callerAddress: string,
  access: BreedingAccessRecord,
  tokenId: string
): void {
  assertCanUseCapability({
    capability: "breeding",
    callerAddress,
    tokenId,
    access: {
      ownerAddress: access.ownerAddress,
      authorizedAddresses: access.authorizedBreeders,
    },
  });
}
