import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import {
  THOUGHTLINE_AGENT_ABI,
  encodePayForUsageCalldata,
  encodeMintGenesisCalldata,
  normalizeBytes32,
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

  it("reads token authorization and storage pointers from a viem client", async () => {
    const client = fakeClient({
      ownerOf: "0x1111111111111111111111111111111111111111",
      tokenURI: "0g://public",
      privateWorldviewURI: "0g://private",
      dataHash: `0x${"c".repeat(64)}`,
      authorizedUsersOf: ["0x2222222222222222222222222222222222222222"],
      isAuthorizedUser: true,
      usageFee: 12n,
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
