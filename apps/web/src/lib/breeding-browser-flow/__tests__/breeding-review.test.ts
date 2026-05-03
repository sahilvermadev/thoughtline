import { describe, expect, it } from "vitest";
import { canMintReviewedChild } from "../index";

describe("breeding artifact review", () => {
  it("requires explicit approval before minting a ready child artifact", () => {
    const ready = {
      mintTransaction: {
        to: "0x3333333333333333333333333333333333333333" as const,
        data: "0x1234" as const,
        chainId: 16602,
      },
    };

    expect(
      canMintReviewedChild({ ready, isMinting: false, isApproved: false })
    ).toBe(false);
    expect(
      canMintReviewedChild({ ready, isMinting: false, isApproved: true })
    ).toBe(true);
  });
});
