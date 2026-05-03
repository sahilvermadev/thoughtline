import { describe, expect, it } from "vitest";
import {
  canMintReviewedGenesis,
  isSuccessfulReceipt,
  waitForTransactionReceipt,
  type EthereumProvider,
} from "../index";

describe("genesis artifact review", () => {
  it("requires explicit approval before minting a ready artifact", () => {
    const ready = {
      mintTransaction: {
        to: "0x3333333333333333333333333333333333333333" as const,
        data: "0x1234" as const,
        chainId: 16602,
      },
    };

    expect(
      canMintReviewedGenesis({ ready, isMinting: false, isApproved: false })
    ).toBe(false);
    expect(
      canMintReviewedGenesis({ ready, isMinting: false, isApproved: true })
    ).toBe(true);
    expect(
      canMintReviewedGenesis({
        ready,
        isMinting: false,
        isApproved: true,
        isMintConfirmed: true,
      })
    ).toBe(false);
  });

  it("recognizes successful and reverted mint receipts", () => {
    expect(isSuccessfulReceipt({ status: "0x1" })).toBe(true);
    expect(isSuccessfulReceipt({ status: "1" })).toBe(true);
    expect(isSuccessfulReceipt({ status: "0x0" })).toBe(false);
  });

  it("waits for a submitted mint transaction to be mined", async () => {
    let calls = 0;
    const ethereum: EthereumProvider = {
      async request() {
        calls += 1;
        if (calls < 2) return null;
        return { status: "0x1", logs: [] };
      },
    };

    await expect(
      waitForTransactionReceipt(ethereum, "0xabc" as const, {
        attempts: 2,
        intervalMs: 0,
      })
    ).resolves.toEqual({ status: "0x1", logs: [] });
  });
});
