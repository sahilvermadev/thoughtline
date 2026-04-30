import { createPublicClient, getAddress, http, type Address } from "viem";
import {
  preparePayForUsageTransaction,
  THOUGHTLINE_AGENT_ABI,
  type UsagePaymentTransaction,
} from "./thoughtline";
import type { MintedAgentRecord } from "../gallery/public-agents";

const DEFAULT_GALILEO_RPC_URL = "https://evmrpc-testnet.0g.ai";
const DEFAULT_GALILEO_CHAIN_ID = 16602;

export interface ThoughtLineChainReader {
  listMintedAgents(): Promise<MintedAgentRecord[]>;
  ownerOf(tokenId: bigint | number | string): Promise<`0x${string}`>;
  tokenURI(tokenId: bigint | number | string): Promise<string>;
  publicProfileURI(tokenId: bigint | number | string): Promise<string>;
  privateWorldviewURI(tokenId: bigint | number | string): Promise<string>;
  dataHash(tokenId: bigint | number | string): Promise<`0x${string}`>;
  authorizedUsersOf(
    tokenId: bigint | number | string
  ): Promise<`0x${string}`[]>;
  isAuthorizedUser(
    tokenId: bigint | number | string,
    user: string
  ): Promise<boolean>;
  usageFee(tokenId: bigint | number | string): Promise<bigint>;
  preparePayForUsage(
    tokenId: bigint | number | string
  ): Promise<UsagePaymentTransaction>;
}

export interface ThoughtLineChainReaderEnv
  extends Record<string, string | undefined> {
  NEXT_PUBLIC_CONTRACT_ADDRESS?: string;
  GALILEO_RPC_URL?: string;
  NEXT_PUBLIC_CHAIN_ID?: string;
}

export function createThoughtLineChainReader(
  env: ThoughtLineChainReaderEnv = process.env,
  clientOverride?: ThoughtLinePublicClient
): ThoughtLineChainReader {
  const contractAddress = env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const address = parseContractAddress(contractAddress);
  const publicClient =
    clientOverride ??
    (address
      ? createPublicClient({
          transport: http(env.GALILEO_RPC_URL ?? DEFAULT_GALILEO_RPC_URL),
        }) as ThoughtLinePublicClient
      : null);

  function requireAvailable(): {
    address: Address;
    publicClient: ThoughtLinePublicClient;
  } {
    if (!address || !publicClient) {
      throw new Error("ThoughtLine contract address is not configured");
    }
    return { address, publicClient };
  }

  async function readContract(functionName: string, args: unknown[]) {
    const available = requireAvailable();
    return available.publicClient.readContract({
      address: available.address,
      abi: THOUGHTLINE_AGENT_ABI,
      functionName,
      args,
    });
  }

  return {
    async listMintedAgents() {
      if (!address || !publicClient) return [];
      try {
        const events = await publicClient.getContractEvents({
          address,
          abi: THOUGHTLINE_AGENT_ABI,
          eventName: "AgentMinted",
          fromBlock: 0n,
        });

        return events.map((event) => {
          const args = event.args;
          if (!args) throw new Error("AgentMinted event is missing arguments");

          return {
            tokenId: BigInt(args.tokenId as bigint | number | string),
            owner: args.owner as `0x${string}`,
            publicUri: args.publicProfileURI as string,
            privateUri: args.privateWorldviewURI as string,
            dataHash: args.dataHash as `0x${string}`,
            hasParents: Boolean(args.hasParents),
            parentA: BigInt(args.parentA as bigint | number | string),
            parentB: BigInt(args.parentB as bigint | number | string),
          } satisfies MintedAgentRecord;
        });
      } catch {
        return [];
      }
    },

    async ownerOf(tokenId) {
      return getAddress(
        (await readContract("ownerOf", [BigInt(tokenId)])) as string
      ) as `0x${string}`;
    },

    async tokenURI(tokenId) {
      return (await readContract("tokenURI", [BigInt(tokenId)])) as string;
    },

    async publicProfileURI(tokenId) {
      return this.tokenURI(tokenId);
    },

    async privateWorldviewURI(tokenId) {
      return (await readContract("privateWorldviewURI", [
        BigInt(tokenId),
      ])) as string;
    },

    async dataHash(tokenId) {
      return (await readContract("dataHash", [BigInt(tokenId)])) as `0x${string}`;
    },

    async authorizedUsersOf(tokenId) {
      return ((await readContract("authorizedUsersOf", [
        BigInt(tokenId),
      ])) as string[]).map((user) => getAddress(user) as `0x${string}`);
    },

    async isAuthorizedUser(tokenId, user) {
      return (await readContract("isAuthorizedUser", [
        BigInt(tokenId),
        getAddress(user),
      ])) as boolean;
    },

    async usageFee(tokenId) {
      return (await readContract("usageFee", [BigInt(tokenId)])) as bigint;
    },

    async preparePayForUsage(tokenId) {
      const available = requireAvailable();
      return preparePayForUsageTransaction({
        contractAddress: available.address,
        tokenId,
        usageFee: await this.usageFee(tokenId),
        chainId: Number(env.NEXT_PUBLIC_CHAIN_ID ?? DEFAULT_GALILEO_CHAIN_ID),
      });
    },
  };
}

export interface ThoughtLinePublicClient {
  getContractEvents(input: {
    address: Address;
    abi: typeof THOUGHTLINE_AGENT_ABI;
    eventName: "AgentMinted";
    fromBlock: bigint;
  }): Promise<Array<{ args?: Record<string, unknown> }>>;
  readContract(input: {
    address: Address;
    abi: typeof THOUGHTLINE_AGENT_ABI;
    functionName: string;
    args: unknown[];
  }): Promise<unknown>;
}

function parseContractAddress(value: string | undefined): Address | null {
  if (!value) return null;
  try {
    return getAddress(value) as Address;
  } catch {
    return null;
  }
}
