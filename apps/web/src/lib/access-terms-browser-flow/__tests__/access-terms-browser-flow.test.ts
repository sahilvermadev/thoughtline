import { describe, expect, it, vi } from "vitest";
import type { EthereumProvider } from "@/lib/browser-wallet";
import {
  payForUsageAndWait,
  setAccessFeeAndWait,
} from "../index";

const caller = "0x2222222222222222222222222222222222222222";

describe("access terms browser flow", () => {
  it("sends a usage payment, polls receipt, and refetches until authorized", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          transaction: tx("12"),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          usage: { feeWei: "12", isAuthorized: false, payTransaction: tx("12") },
          breeding: { feeWei: "0", isAuthorized: false, payTransaction: null },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          usage: { feeWei: "12", isAuthorized: true, payTransaction: null },
          breeding: { feeWei: "0", isAuthorized: false, payTransaction: null },
        })
      );
    const ethereum = fakeEthereum();

    const terms = await payForUsageAndWait(
      { tokenId: "7", callerAddress: caller },
      { fetch: fetchMock, ethereum, pollIntervalMs: 0 }
    );

    expect(terms.usage.isAuthorized).toBe(true);
    expect(ethereum.request).toHaveBeenCalledWith({
      method: "eth_sendTransaction",
      params: [
        {
          from: caller,
          to: "0x3333333333333333333333333333333333333333",
          data: "0xabc",
          value: "0xc",
          chainId: "0x40da",
        },
      ],
    });
    expect(ethereum.request).toHaveBeenCalledWith({
      method: "eth_getTransactionReceipt",
      params: ["0xhash"],
    });
  });

  it("sets an owner fee, polls receipt, and refetches until fee updates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          transaction: tx("0"),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          usage: { feeWei: "0", isAuthorized: true, payTransaction: null },
          breeding: { feeWei: "0", isAuthorized: true, payTransaction: null },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          usage: { feeWei: "99", isAuthorized: true, payTransaction: null },
          breeding: { feeWei: "0", isAuthorized: true, payTransaction: null },
        })
      );

    const terms = await setAccessFeeAndWait(
      {
        tokenId: "7",
        callerAddress: caller,
        kind: "usage",
        feeWei: "99",
      },
      { fetch: fetchMock, ethereum: fakeEthereum(), pollIntervalMs: 0 }
    );

    expect(terms.usage.feeWei).toBe("99");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agents/7/access-terms");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      kind: "usage",
      feeWei: "99",
    });
  });
});

function fakeEthereum(): EthereumProvider {
  return {
    request: vi.fn(async ({ method }) => {
      if (method === "eth_sendTransaction") return "0xhash";
      if (method === "eth_getTransactionReceipt") return { status: "0x1" };
      throw new Error(`Unexpected method ${method}`);
    }),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function tx(value: string) {
  return {
    to: "0x3333333333333333333333333333333333333333",
    data: "0xabc",
    value,
    chainId: 16602,
  };
}
