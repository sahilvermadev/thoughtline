import { describe, expect, it } from "vitest";
import {
  assertCanUseCapability,
  assertCapabilityAccess,
  canAccessCapability,
  canUseCapability,
} from "../access";

describe("authorization access module", () => {
  it("allows owners and explicitly authorized addresses", () => {
    const access = {
      ownerAddress: "0xABC",
      authorizedAddresses: ["0xDEF"],
    };

    expect(canAccessCapability("0xabc", access)).toBe(true);
    expect(canAccessCapability("0xdef", access)).toBe(true);
    expect(canAccessCapability("0x123", access)).toBe(false);
  });

  it("keeps usage and breeding capability errors distinct", () => {
    expect(() =>
      assertCapabilityAccess("usage", "0x123", "7", {
        ownerAddress: "0xabc",
        authorizedAddresses: [],
      })
    ).toThrow("usage on agent 7");

    expect(() =>
      assertCapabilityAccess("breeding", "0x123", "7", {
        ownerAddress: "0xabc",
        authorizedAddresses: [],
      })
    ).toThrow("breed with agent 7");
  });

  it("checks a capability request through one interface", () => {
    const request = {
      capability: "usage" as const,
      callerAddress: "0xdef",
      tokenId: "9",
      access: {
        ownerAddress: "0xabc",
        authorizedAddresses: ["0xDEF"],
      },
    };

    expect(canUseCapability(request)).toBe(true);
    expect(() => assertCanUseCapability(request)).not.toThrow();
  });
});
