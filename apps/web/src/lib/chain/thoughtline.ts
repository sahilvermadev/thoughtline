import { encodeFunctionData, type Hex } from "viem";

export const THOUGHTLINE_AGENT_ABI = [
  {
    type: "event",
    name: "AgentMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "publicProfileURI", type: "string", indexed: false },
      { name: "privateWorldviewURI", type: "string", indexed: false },
      { name: "dataHash", type: "bytes32", indexed: false },
      { name: "hasParents", type: "bool", indexed: false },
      { name: "parentA", type: "uint256", indexed: false },
      { name: "parentB", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "mintGenesis",
    stateMutability: "nonpayable",
    inputs: [
      { name: "publicProfileURI_", type: "string" },
      { name: "privateWorldviewURI_", type: "string" },
      { name: "dataHash_", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintChild",
    stateMutability: "nonpayable",
    inputs: [
      { name: "publicProfileURI_", type: "string" },
      { name: "privateWorldviewURI_", type: "string" },
      { name: "dataHash_", type: "bytes32" },
      { name: "parentA", type: "uint256" },
      { name: "parentB", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "privateWorldviewURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "dataHash",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "authorizedUsersOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "isAuthorizedUser",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "usageFee",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payForUsage",
    stateMutability: "payable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
] as const;

export interface MintGenesisCalldataInput {
  publicUri: string;
  privateUri: string;
  dataHash: string;
}

export function encodeMintGenesisCalldata(
  input: MintGenesisCalldataInput
): Hex {
  const dataHash = normalizeBytes32(input.dataHash);
  return encodeFunctionData({
    abi: THOUGHTLINE_AGENT_ABI,
    functionName: "mintGenesis",
    args: [input.publicUri, input.privateUri, dataHash],
  });
}

export interface UsagePaymentTransaction {
  to: Hex;
  data: Hex;
  value: bigint;
  chainId: number;
}

export interface PrepareUsagePaymentInput {
  contractAddress: string;
  tokenId: bigint | number | string;
  usageFee: bigint;
  chainId: number;
}

export function encodePayForUsageCalldata(
  tokenId: bigint | number | string
): Hex {
  return encodeFunctionData({
    abi: THOUGHTLINE_AGENT_ABI,
    functionName: "payForUsage",
    args: [BigInt(tokenId)],
  });
}

export function preparePayForUsageTransaction(
  input: PrepareUsagePaymentInput
): UsagePaymentTransaction {
  return {
    to: input.contractAddress as Hex,
    data: encodePayForUsageCalldata(input.tokenId),
    value: input.usageFee,
    chainId: input.chainId,
  };
}

export function normalizeBytes32(value: string): Hex {
  const hex = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Expected 32-byte hex value, got: ${value}`);
  }
  return hex as Hex;
}
