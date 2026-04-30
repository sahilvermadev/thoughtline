import type { PublicProfile } from "@thoughtline/shared";
import { encodeMintGenesisCalldata, normalizeBytes32 } from "../chain/thoughtline";

export interface StoredAgentArtifactInput {
  publicProfile: PublicProfile;
  publicUri: string;
  publicHash: string;
  privateUri: string;
  dataHash: string;
}

export interface StoredAgentPointers {
  publicUri: string;
  privateUri: string;
  dataHash: `0x${string}`;
}

export interface MintTransactionPrep {
  to: `0x${string}` | null;
  data: `0x${string}`;
  chainId: number;
}

export interface GenesisMintArtifact {
  publicProfile: PublicProfile;
  publicUri: string;
  publicHash: string;
  privateUri: string;
  dataHash: `0x${string}`;
  mintCalldata: `0x${string}`;
  mintTransaction: MintTransactionPrep;
}

export function createGenesisMintArtifact(
  input: StoredAgentArtifactInput,
  env: Record<string, string | undefined> = process.env
): GenesisMintArtifact {
  const dataHash = normalizeStoredAgentDataHash(input.dataHash);
  const mintCalldata = encodeMintGenesisCalldata({
    publicUri: input.publicUri,
    privateUri: input.privateUri,
    dataHash,
  });

  return {
    publicProfile: input.publicProfile,
    publicUri: input.publicUri,
    publicHash: input.publicHash,
    privateUri: input.privateUri,
    dataHash,
    mintCalldata,
    mintTransaction: {
      to: parseContractAddress(env.NEXT_PUBLIC_CONTRACT_ADDRESS),
      data: mintCalldata,
      chainId: Number(env.NEXT_PUBLIC_CHAIN_ID ?? 16602),
    },
  };
}

export function createStoredAgentPointers(input: {
  publicUri: string;
  privateUri: string;
  dataHash: string;
}): StoredAgentPointers {
  return {
    publicUri: input.publicUri,
    privateUri: input.privateUri,
    dataHash: normalizeStoredAgentDataHash(input.dataHash),
  };
}

export function normalizeStoredAgentDataHash(value: string): `0x${string}` {
  return normalizeBytes32(value);
}

function parseContractAddress(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid contract address: ${value}`);
  }
  return value as `0x${string}`;
}
