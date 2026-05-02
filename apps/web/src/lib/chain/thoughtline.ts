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
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
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
    name: "intelligentDataOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "dataDescription", type: "string" },
          { name: "dataHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "iTransfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      {
        name: "proofs",
        type: "tuple[]",
        components: [
          {
            name: "accessProof",
            type: "tuple",
            components: [
              { name: "oldDataHash", type: "bytes32" },
              { name: "newDataHash", type: "bytes32" },
              { name: "nonce", type: "bytes" },
              { name: "encryptedPubKey", type: "bytes" },
              { name: "proof", type: "bytes" },
            ],
          },
          {
            name: "ownershipProof",
            type: "tuple",
            components: [
              { name: "oracleType", type: "uint8" },
              { name: "oldDataHash", type: "bytes32" },
              { name: "newDataHash", type: "bytes32" },
              { name: "sealedKey", type: "bytes" },
              { name: "encryptedPubKey", type: "bytes" },
              { name: "nonce", type: "bytes" },
              { name: "proof", type: "bytes" },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "iClone",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      {
        name: "proofs",
        type: "tuple[]",
        components: [
          {
            name: "accessProof",
            type: "tuple",
            components: [
              { name: "oldDataHash", type: "bytes32" },
              { name: "newDataHash", type: "bytes32" },
              { name: "nonce", type: "bytes" },
              { name: "encryptedPubKey", type: "bytes" },
              { name: "proof", type: "bytes" },
            ],
          },
          {
            name: "ownershipProof",
            type: "tuple",
            components: [
              { name: "oracleType", type: "uint8" },
              { name: "oldDataHash", type: "bytes32" },
              { name: "newDataHash", type: "bytes32" },
              { name: "sealedKey", type: "bytes" },
              { name: "encryptedPubKey", type: "bytes" },
              { name: "nonce", type: "bytes" },
              { name: "proof", type: "bytes" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "newTokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "authorizeUsage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [],
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
    name: "delegateAccess",
    stateMutability: "nonpayable",
    inputs: [{ name: "assistant", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getDelegateAccess",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "authorizedBreedersOf",
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
    name: "isAuthorizedBreeder",
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
    name: "breedingFee",
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
  {
    type: "function",
    name: "setUsageFee",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setBreedingFee",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payForBreeding",
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

export interface MintChildCalldataInput {
  publicUri: string;
  privateUri: string;
  dataHash: string;
  parentTokenIdA: bigint | number | string;
  parentTokenIdB: bigint | number | string;
}

export function encodeMintChildCalldata(input: MintChildCalldataInput): Hex {
  const dataHash = normalizeBytes32(input.dataHash);
  return encodeFunctionData({
    abi: THOUGHTLINE_AGENT_ABI,
    functionName: "mintChild",
    args: [
      input.publicUri,
      input.privateUri,
      dataHash,
      BigInt(input.parentTokenIdA),
      BigInt(input.parentTokenIdB),
    ],
  });
}

export interface PaymentTransaction {
  to: Hex;
  data: Hex;
  value: bigint;
  chainId: number;
}

export type UsagePaymentTransaction = PaymentTransaction;
export type BreedingPaymentTransaction = PaymentTransaction;
export type FeeSettingTransaction = PaymentTransaction;

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

export function encodePayForBreedingCalldata(
  tokenId: bigint | number | string
): Hex {
  return encodeFunctionData({
    abi: THOUGHTLINE_AGENT_ABI,
    functionName: "payForBreeding",
    args: [BigInt(tokenId)],
  });
}

export function encodeSetUsageFeeCalldata(
  tokenId: bigint | number | string,
  feeWei: bigint | number | string
): Hex {
  return encodeFunctionData({
    abi: THOUGHTLINE_AGENT_ABI,
    functionName: "setUsageFee",
    args: [BigInt(tokenId), BigInt(feeWei)],
  });
}

export function encodeSetBreedingFeeCalldata(
  tokenId: bigint | number | string,
  feeWei: bigint | number | string
): Hex {
  return encodeFunctionData({
    abi: THOUGHTLINE_AGENT_ABI,
    functionName: "setBreedingFee",
    args: [BigInt(tokenId), BigInt(feeWei)],
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

export interface PrepareFeeSettingInput {
  contractAddress: string;
  tokenId: bigint | number | string;
  feeWei: bigint | number | string;
  chainId: number;
}

export function prepareSetUsageFeeTransaction(
  input: PrepareFeeSettingInput
): FeeSettingTransaction {
  return {
    to: input.contractAddress as Hex,
    data: encodeSetUsageFeeCalldata(input.tokenId, input.feeWei),
    value: 0n,
    chainId: input.chainId,
  };
}

export function prepareSetBreedingFeeTransaction(
  input: PrepareFeeSettingInput
): FeeSettingTransaction {
  return {
    to: input.contractAddress as Hex,
    data: encodeSetBreedingFeeCalldata(input.tokenId, input.feeWei),
    value: 0n,
    chainId: input.chainId,
  };
}

export interface PrepareBreedingPaymentInput {
  contractAddress: string;
  tokenId: bigint | number | string;
  breedingFee: bigint;
  chainId: number;
}

export function preparePayForBreedingTransaction(
  input: PrepareBreedingPaymentInput
): BreedingPaymentTransaction {
  return {
    to: input.contractAddress as Hex,
    data: encodePayForBreedingCalldata(input.tokenId),
    value: input.breedingFee,
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
