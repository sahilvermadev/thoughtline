import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import {
  THOUGHTLINE_AGENT_ABI,
  encodeMintChildCalldata,
  encodePayForUsageCalldata,
  encodePayForBreedingCalldata,
  encodeSetBreedingFeeCalldata,
  encodeSetUsageFeeCalldata,
  encodeMintGenesisCalldata,
  normalizeBytes32,
  prepareSetBreedingFeeTransaction,
  prepareSetUsageFeeTransaction,
} from "../thoughtline";
import { createThoughtLineChainReader, type ThoughtLinePublicClient } from "../reader";

describe("ThoughtLine chain helpers", () => {
  it("normalizes sha256 hex into bytes32 calldata", () => {
    const hash = "a".repeat(64);

    expect(normalizeBytes32(hash)).toBe(`0x${hash}`);
    expect(normalizeBytes32(`0x${hash}`)).toBe(`0x${hash}`);
    expect(() => normalizeBytes32("abc")).toThrow(/32-byte hex/i);
  });

  it("encodes mintGenesis calldata with storage pointers and data hash", () => {
    const data = encodeMintGenesisCalldata({
      publicUri: "0g://public",
      privateUri: "0g://private",
      dataHash: "b".repeat(64),
    });

    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data,
    });

    expect(decoded.functionName).toBe("mintGenesis");
    expect(decoded.args).toEqual([
      "0g://public",
      "0g://private",
      `0x${"b".repeat(64)}`,
    ]);
  });

  it("encodes payForUsage calldata", () => {
    const data = encodePayForUsageCalldata(7n);
    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data,
    });

    expect(decoded.functionName).toBe("payForUsage");
    expect(decoded.args).toEqual([7n]);
  });

  it("encodes mintChild calldata with parent token ids", () => {
    const data = encodeMintChildCalldata({
      publicUri: "0g://child-public",
      privateUri: "0g://child-private",
      dataHash: "d".repeat(64),
      parentTokenIdA: 4n,
      parentTokenIdB: 9n,
    });

    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data,
    });

    expect(decoded.functionName).toBe("mintChild");
    expect(decoded.args).toEqual([
      "0g://child-public",
      "0g://child-private",
      `0x${"d".repeat(64)}`,
      4n,
      9n,
    ]);
  });

  it("encodes payForBreeding calldata", () => {
    const data = encodePayForBreedingCalldata(7n);
    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data,
    });

    expect(decoded.functionName).toBe("payForBreeding");
    expect(decoded.args).toEqual([7n]);
  });

  it("encodes owner fee-setting calldata and transaction prep", () => {
    const usage = encodeSetUsageFeeCalldata(7n, 12n);
    const breeding = encodeSetBreedingFeeCalldata(7n, 34n);

    expect(
      decodeFunctionData({ abi: THOUGHTLINE_AGENT_ABI, data: usage })
    ).toEqual({
      functionName: "setUsageFee",
      args: [7n, 12n],
    });
    expect(
      decodeFunctionData({ abi: THOUGHTLINE_AGENT_ABI, data: breeding })
    ).toEqual({
      functionName: "setBreedingFee",
      args: [7n, 34n],
    });

    expect(
      prepareSetUsageFeeTransaction({
        contractAddress: "0x3333333333333333333333333333333333333333",
        tokenId: 7n,
        feeWei: 12n,
        chainId: 16602,
      })
    ).toMatchObject({
      to: "0x3333333333333333333333333333333333333333",
      value: 0n,
      chainId: 16602,
    });
  });

  it("reads token authorization and storage pointers from a viem client", async () => {
    const client = fakeClient({
      ownerOf: "0x1111111111111111111111111111111111111111",
      tokenURI: "0g://public",
      privateWorldviewURI: "0g://private",
      dataHash: `0x${"c".repeat(64)}`,
      authorizedUsersOf: ["0x2222222222222222222222222222222222222222"],
      isAuthorizedUser: true,
      usageFee: 12n,
      authorizedBreedersOf: ["0x4444444444444444444444444444444444444444"],
      isAuthorizedBreeder: true,
      breedingFee: 34n,
    });
    const reader = createThoughtLineChainReader(
      {
        NEXT_PUBLIC_CONTRACT_ADDRESS: "0x3333333333333333333333333333333333333333",
        NEXT_PUBLIC_CHAIN_ID: "16602",
      },
      client
    );

    await expect(reader.ownerOf(4n)).resolves.toBe(
      "0x1111111111111111111111111111111111111111"
    );
    await expect(reader.publicProfileURI(4n)).resolves.toBe("0g://public");
    await expect(reader.privateWorldviewURI(4n)).resolves.toBe("0g://private");
    await expect(reader.dataHash(4n)).resolves.toBe(`0x${"c".repeat(64)}`);
    await expect(reader.authorizedUsersOf(4n)).resolves.toEqual([
      "0x2222222222222222222222222222222222222222",
    ]);
    await expect(
      reader.isAuthorizedUser(
        4n,
        "0x2222222222222222222222222222222222222222"
      )
    ).resolves.toBe(true);
    await expect(reader.usageFee(4n)).resolves.toBe(12n);
    await expect(reader.authorizedBreedersOf(4n)).resolves.toEqual([
      "0x4444444444444444444444444444444444444444",
    ]);
    await expect(
      reader.isAuthorizedBreeder(
        4n,
        "0x4444444444444444444444444444444444444444"
      )
    ).resolves.toBe(true);
    await expect(reader.breedingFee(4n)).resolves.toBe(34n);

    const tx = await reader.preparePayForUsage(4n);
    expect(tx).toMatchObject({
      to: "0x3333333333333333333333333333333333333333",
      value: 12n,
      chainId: 16602,
    });
    expect(
      decodeFunctionData({ abi: THOUGHTLINE_AGENT_ABI, data: tx.data })
        .functionName
    ).toBe("payForUsage");

    const breedingTx = await reader.preparePayForBreeding(4n);
    expect(breedingTx).toMatchObject({
      to: "0x3333333333333333333333333333333333333333",
      value: 34n,
      chainId: 16602,
    });
    expect(
      decodeFunctionData({ abi: THOUGHTLINE_AGENT_ABI, data: breedingTx.data })
        .functionName
    ).toBe("payForBreeding");

    const usageFeeTx = await reader.prepareSetUsageFee(4n, 56n);
    expect(usageFeeTx).toMatchObject({
      to: "0x3333333333333333333333333333333333333333",
      value: 0n,
      chainId: 16602,
    });
    expect(
      decodeFunctionData({ abi: THOUGHTLINE_AGENT_ABI, data: usageFeeTx.data })
    ).toEqual({
      functionName: "setUsageFee",
      args: [4n, 56n],
    });

    const breedingFeeTx = await reader.prepareSetBreedingFee(4n, 78n);
    expect(
      decodeFunctionData({ abi: THOUGHTLINE_AGENT_ABI, data: breedingFeeTx.data })
    ).toEqual({
      functionName: "setBreedingFee",
      args: [4n, 78n],
    });
  });
});

function fakeClient(results: Record<string, unknown>): ThoughtLinePublicClient {
  return {
    async getContractEvents() {
      return [];
    },
    async readContract(input) {
      return results[input.functionName];
    },
  };
}
