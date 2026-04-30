import { describe, expect, it } from "vitest";
import { createChainPublicAgentSource } from "../public-agents-source";

describe("createChainPublicAgentSource", () => {
  it("returns an empty gallery when the contract address is invalid", async () => {
    const source = createChainPublicAgentSource({
      NEXT_PUBLIC_CONTRACT_ADDRESS: "not-an-address",
      GALILEO_RPC_URL: "https://evmrpc-testnet.0g.ai",
    });

    await expect(source.listMintedAgents()).resolves.toEqual([]);
  });
});
