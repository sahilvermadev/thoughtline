import { describe, expect, it } from "vitest";
import { buildUnlockMessage, deriveUnlockKey } from "../index";

describe("unlock module", () => {
  it("builds deterministic genesis and token-scoped unlock messages", () => {
    const genesis = buildUnlockMessage({
      purpose: "genesis",
      ownerAddress: "0xabc",
      agentName: "Clarity",
    });
    const token = buildUnlockMessage({
      purpose: "agent",
      ownerAddress: "0xabc",
      tokenId: "7",
    });

    expect(genesis).toContain("Scope: genesis");
    expect(genesis).toContain("Agent: Clarity");
    expect(token).toContain("Scope: agent-token");
    expect(token).toContain("Token ID: 7");
    expect(genesis).not.toBe(token);
  });

  it("builds independent token-scoped unlock messages", () => {
    const tokenA = buildUnlockMessage({
      scope: "agent-token",
      ownerAddress: "0xabc",
      tokenId: "7",
    });
    const tokenB = buildUnlockMessage({
      scope: "agent-token",
      ownerAddress: "0xabc",
      tokenId: "8",
    });

    expect(tokenA).not.toBe(tokenB);
  });

  it("derives the same AES key for the same wallet signature", async () => {
    const a = await deriveUnlockKey("0xsigned");
    const b = await deriveUnlockKey("0xsigned");
    const c = await deriveUnlockKey("0xother");

    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...c]);
    expect(a).toHaveLength(32);
  });
});
