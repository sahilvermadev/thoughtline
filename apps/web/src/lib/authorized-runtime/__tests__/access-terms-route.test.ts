import { describe, expect, it } from "vitest";
import type { ThoughtLineChainReader } from "@/lib/chain/reader";
import {
  createAccessTermsGetResponse,
  createAccessTermsPostResponse,
  createPayUsageResponse,
} from "../access-terms-route";

const caller = "0x2222222222222222222222222222222222222222";

describe("agent access terms routes", () => {
  it("returns usage and breeding terms without payment transactions for zero fees", async () => {
    const response = await createAccessTermsGetResponse(getRequest(), "7", {
      chain: fakeChain({ usageFee: 0n, breedingFee: 0n }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      usage: {
        feeWei: "0",
        isAuthorized: false,
        payTransaction: null,
      },
      breeding: {
        feeWei: "0",
        isAuthorized: false,
        payTransaction: null,
      },
    });
  });

  it("returns usage payment transaction only when unauthorized and fee is positive", async () => {
    const response = await createAccessTermsGetResponse(getRequest(), "7", {
      chain: fakeChain({ usageFee: 12n, breedingFee: 0n }),
    });
    const body = await response.json();

    expect(body.usage).toMatchObject({
      feeWei: "12",
      isAuthorized: false,
      payTransaction: {
        to: "0x3333333333333333333333333333333333333333",
        value: "12",
        chainId: 16602,
      },
    });
    expect(body.breeding.payTransaction).toBeNull();
  });

  it("prepares usage and breeding fee-setting transactions", async () => {
    const usage = await createAccessTermsPostResponse(postRequest("usage", "12"), "7", {
      chain: fakeChain({ usageFee: 0n, breedingFee: 0n }),
    });
    const breeding = await createAccessTermsPostResponse(
      postRequest("breeding", "34"),
      "7",
      { chain: fakeChain({ usageFee: 0n, breedingFee: 0n }) }
    );

    expect(usage.status).toBe(200);
    await expect(usage.json()).resolves.toMatchObject({
      transaction: { value: "0", chainId: 16602 },
    });
    await expect(breeding.json()).resolves.toMatchObject({
      transaction: { value: "0", chainId: 16602 },
    });
  });

  it("rejects invalid fee-setting request bodies", async () => {
    const response = await createAccessTermsPostResponse(
      postRequest("invalid", "-1"),
      "7",
      { chain: fakeChain({ usageFee: 0n, breedingFee: 0n }) }
    );

    expect(response.status).toBe(400);
  });

  it("prepares pay-for-usage and rejects disabled zero-fee payment", async () => {
    const paid = await createPayUsageResponse(new Request("http://localhost"), "7", {
      chain: fakeChain({ usageFee: 12n, breedingFee: 0n }),
    });
    const disabled = await createPayUsageResponse(
      new Request("http://localhost"),
      "7",
      { chain: fakeChain({ usageFee: 0n, breedingFee: 0n }) }
    );

    expect(paid.status).toBe(200);
    await expect(paid.json()).resolves.toMatchObject({
      transaction: { value: "12", chainId: 16602 },
    });
    expect(disabled.status).toBe(400);
    await expect(disabled.json()).resolves.toHaveProperty("error");
  });
});

function getRequest(): Request {
  return new Request(
    `http://localhost/api/agents/7/access-terms?callerAddress=${caller}`
  );
}

function postRequest(kind: string, feeWei: string): Request {
  return new Request("http://localhost/api/agents/7/access-terms", {
    method: "POST",
    body: JSON.stringify({ kind, feeWei }),
  });
}

function fakeChain(input: {
  usageFee: bigint;
  breedingFee: bigint;
  usageAuthorized?: boolean;
  breedingAuthorized?: boolean;
}): ThoughtLineChainReader {
  return {
    async listMintedAgents() {
      return [];
    },
    async ownerOf() {
      return "0x1111111111111111111111111111111111111111";
    },
    async tokenURI() {
      return "0g://public";
    },
    async publicProfileURI() {
      return "0g://public";
    },
    async privateWorldviewURI() {
      return "0g://private";
    },
    async dataHash() {
      return `0x${"1".repeat(64)}`;
    },
    async authorizedUsersOf() {
      return [];
    },
    async authorizedBreedersOf() {
      return [];
    },
    async isAuthorizedUser() {
      return input.usageAuthorized ?? false;
    },
    async isAuthorizedBreeder() {
      return input.breedingAuthorized ?? false;
    },
    async usageFee() {
      return input.usageFee;
    },
    async breedingFee() {
      return input.breedingFee;
    },
    async preparePayForUsage() {
      return tx(input.usageFee);
    },
    async preparePayForBreeding() {
      return tx(input.breedingFee);
    },
    async prepareSetUsageFee(_tokenId, feeWei) {
      return tx(BigInt(feeWei), 0n);
    },
    async prepareSetBreedingFee(_tokenId, feeWei) {
      return tx(BigInt(feeWei), 0n);
    },
  };
}

function tx(encodedFee: bigint, value = encodedFee) {
  return {
    to: "0x3333333333333333333333333333333333333333" as `0x${string}`,
    data: `0x${encodedFee.toString(16).padStart(64, "0")}` as `0x${string}`,
    value,
    chainId: 16602,
  };
}
