import type { StorageProvider } from "@thoughtline/shared";
import { sha256Hex } from "../crypto";
import { normalizeStoredAgentDataHash } from "../agent-artifact";

export interface VerifyPrivateDataHashInput {
  storage: StorageProvider;
  privateUri: string;
  dataHash: string;
}

export interface PrivateDataHashProof {
  privateUri: string;
  expectedDataHash: `0x${string}`;
  actualDataHash: `0x${string}`;
  matches: boolean;
  byteLength: number;
}

export async function verifyPrivateDataHash(
  input: VerifyPrivateDataHashInput
): Promise<PrivateDataHashProof> {
  const expectedDataHash = normalizeStoredAgentDataHash(input.dataHash);
  const bytes = await input.storage.fetch(input.privateUri);
  const actualDataHash = normalizeStoredAgentDataHash(await sha256Hex(bytes));

  return {
    privateUri: input.privateUri,
    expectedDataHash,
    actualDataHash,
    matches: expectedDataHash.toLowerCase() === actualDataHash.toLowerCase(),
    byteLength: bytes.length,
  };
}
