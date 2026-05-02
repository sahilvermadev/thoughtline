import type { EthereumProvider } from "@/lib/browser-wallet";
import type { AccessTermsResponseBody, SerializedPaymentTransaction } from "@/lib/authorized-runtime/access-terms-route";

export interface AccessTermsBrowserFlowDeps {
  fetch?: typeof fetch;
  ethereum: EthereumProvider;
  pollIntervalMs?: number;
  maxPolls?: number;
}

export interface SetFeeInput {
  tokenId: string;
  callerAddress: string;
  kind: "usage" | "breeding";
  feeWei: string;
}

export interface PayUsageInput {
  tokenId: string;
  callerAddress: string;
}

export async function fetchAgentAccessTerms(
  tokenId: string,
  callerAddress: string,
  fetchImpl: typeof fetch = fetch
): Promise<AccessTermsResponseBody> {
  const response = await fetchImpl(
    `/api/agents/${tokenId}/access-terms?callerAddress=${encodeURIComponent(
      callerAddress
    )}`
  );
  const body = (await response.json()) as AccessTermsResponseBody | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? body.error : "Failed to load access terms");
  }
  return body as AccessTermsResponseBody;
}

export async function payForUsageAndWait(
  input: PayUsageInput,
  deps: AccessTermsBrowserFlowDeps
): Promise<AccessTermsResponseBody> {
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(`/api/agents/${input.tokenId}/pay-usage`, {
    method: "POST",
  });
  const body = (await response.json()) as
    | { transaction: SerializedPaymentTransaction }
    | { error?: string };
  if (!response.ok || !("transaction" in body)) {
    throw new Error("error" in body ? body.error : "Failed to prepare payment");
  }

  await sendTransactionAndWait(body.transaction, input.callerAddress, deps);
  return pollAccessTerms(input.tokenId, input.callerAddress, deps, (terms) =>
    terms.usage.isAuthorized
  );
}

export async function setAccessFeeAndWait(
  input: SetFeeInput,
  deps: AccessTermsBrowserFlowDeps
): Promise<AccessTermsResponseBody> {
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(`/api/agents/${input.tokenId}/access-terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: input.kind, feeWei: input.feeWei }),
  });
  const body = (await response.json()) as
    | { transaction: SerializedPaymentTransaction }
    | { error?: string };
  if (!response.ok || !("transaction" in body)) {
    throw new Error("error" in body ? body.error : "Failed to prepare fee update");
  }

  await sendTransactionAndWait(body.transaction, input.callerAddress, deps);
  return pollAccessTerms(input.tokenId, input.callerAddress, deps, (terms) =>
    terms[input.kind].feeWei === input.feeWei
  );
}

async function sendTransactionAndWait(
  transaction: SerializedPaymentTransaction,
  from: string,
  deps: AccessTermsBrowserFlowDeps
): Promise<void> {
  const hash = (await deps.ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: transaction.to,
        data: transaction.data,
        value: toHexQuantity(BigInt(transaction.value)),
        chainId: toHexQuantity(BigInt(transaction.chainId)),
      },
    ],
  })) as string;

  await pollReceipt(hash, deps);
}

async function pollReceipt(
  transactionHash: string,
  deps: AccessTermsBrowserFlowDeps
): Promise<void> {
  await poll(deps, async () => {
    const receipt = await deps.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });
    return receipt ? true : null;
  }, "Transaction was not mined in time");
}

async function pollAccessTerms(
  tokenId: string,
  callerAddress: string,
  deps: AccessTermsBrowserFlowDeps,
  done: (terms: AccessTermsResponseBody) => boolean
): Promise<AccessTermsResponseBody> {
  return poll(
    deps,
    async () => {
      const terms = await fetchAgentAccessTerms(tokenId, callerAddress, deps.fetch ?? fetch);
      return done(terms) ? terms : null;
    },
    "Access terms did not update in time"
  );
}

async function poll<T>(
  deps: AccessTermsBrowserFlowDeps,
  attempt: () => Promise<T | null>,
  timeoutMessage: string
): Promise<T> {
  const maxPolls = deps.maxPolls ?? 30;
  for (let index = 0; index < maxPolls; index += 1) {
    const value = await attempt();
    if (value) return value;
    await delay(deps.pollIntervalMs ?? 1500);
  }
  throw new Error(timeoutMessage);
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toHexQuantity(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}`;
}
