"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, parseEther } from "viem";
import type { PrivateWorldview, PublicProfile } from "@thoughtline/shared";
import type { PrivateWorldviewSummary } from "@/lib/agent-artifact";
import type { TextSource } from "@/lib/agents/create-from-text";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import {
  encodeSetBreedingFeeCalldata,
  encodeSetUsageFeeCalldata,
  THOUGHTLINE_AGENT_ABI,
} from "@/lib/chain/thoughtline";
import { buildUnlockMessage } from "../unlock";

export type Hex = `0x${string}`;

export type GenesisReadyPayload = {
  publicProfile: PublicProfile;
  privateWorldview?: PrivateWorldview;
  privateWorldviewSummary?: PrivateWorldviewSummary;
  publicUri: string;
  privateUri: string;
  dataHash: Hex;
  mintCalldata: Hex;
  mintTransaction: { to: Hex | null; data: Hex; chainId: number };
};

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged", handler: (accounts: Hex[]) => void): void;
  removeListener?(
    event: "accountsChanged",
    handler: (accounts: Hex[]) => void
  ): void;
}

const GENESIS_SESSION_KEY = "thoughtline.genesis.review.v1";
const GALLERY_CACHE_KEY = "thoughtline.gallery.cache.v1";

type GenesisSessionState = {
  events: string[];
  ready: GenesisReadyPayload | null;
  error: string | null;
  mintTxHash: Hex | null;
  mintedTokenId: string | null;
  isMintConfirmed: boolean;
  isApproved: boolean;
};

export function useGenesisBrowserFlow() {
  const [address, setAddress] = useState<Hex | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [ready, setReady] = useState<GenesisReadyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<Hex | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [isMintConfirmed, setIsMintConfirmed] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const isBusy = isForging || isSigning || isMinting;

  useEffect(() => {
    const ethereum = getOptionalEthereum();
    if (!ethereum) return;

    let active = true;
    const connectedEthereum = ethereum;

    async function hydrateConnectedAccount() {
      try {
        const accounts = (await connectedEthereum.request({
          method: "eth_accounts",
        })) as Hex[];
        if (!active) return;
        setAddress(accounts[0] ?? null);
      } catch {
        // Some injected wallets may reject passive account reads. The explicit
        // connect button still requests access when the user chooses it.
      }
    }

    void hydrateConnectedAccount();

    if (!connectedEthereum.on) {
      return () => {
        active = false;
      };
    }

    const handleAccountsChanged = (accounts: Hex[]) => {
      setAddress(accounts[0] ?? null);
      if (!accounts[0]) {
        setIsApproved(false);
        setError(null);
      }
    };

    connectedEthereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      active = false;
      connectedEthereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    const session = loadGenesisSession();
    if (
      !session.events.length &&
      !session.ready &&
      !session.error &&
      !session.mintTxHash &&
      !session.mintedTokenId &&
      !session.isMintConfirmed &&
      !session.isApproved
    ) {
      return;
    }

    setEvents(session.events);
    setReady(session.ready);
    setError(session.error);
    setMintTxHash(session.mintTxHash);
    setMintedTokenId(session.mintedTokenId);
    setIsMintConfirmed(session.isMintConfirmed);
    setIsApproved(session.isApproved);
  }, []);

  useEffect(() => {
    saveGenesisSession({
      events,
      ready,
      error,
      mintTxHash,
      mintedTokenId,
      isMintConfirmed,
      isApproved,
    });
  }, [events, ready, error, mintTxHash, mintedTokenId, isMintConfirmed, isApproved]);

  useEffect(() => {
    if (!isBusy) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue =
        "Agent creation is still running. Reloading will lose the live stream.";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isBusy]);

  return useMemo(
    () => ({
      address,
      events,
      ready,
      error,
      mintTxHash,
      mintedTokenId,
      isMintConfirmed,
      isApproved,
      isForging,
      isSigning,
      isMinting,
      isBusy,
      connectWallet: async () => {
        setError(null);
        try {
          const accounts = (await getEthereum().request({
            method: "eth_requestAccounts",
          })) as Hex[];
          setAddress(accounts[0] ?? null);
        } catch (err) {
          setError(formatError(err));
        }
      },
      disconnectWallet: async () => {
        setError(null);
        try {
          await getEthereum().request({
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }],
          });
        } catch {
          // Not every injected wallet supports permission revocation. We still
          // clear local app state so the user can leave the session.
        } finally {
          setAddress(null);
          setIsApproved(false);
          setMintTxHash(null);
        }
      },
      forgeGenesis: async (input: {
        name: string;
        sources: TextSource[];
        sourceUrls?: string[];
        expertiseType?: string;
        sourceLabels?: string[];
        desiredCapabilities?: string[];
      }) => {
        if (!address) return;
        setError(null);
        setReady(null);
        setMintTxHash(null);
        setMintedTokenId(null);
        setIsMintConfirmed(false);
        setIsApproved(false);
        setEvents([]);
        setIsForging(true);

        try {
          setIsSigning(true);
          const unlockSignature = (await getEthereum().request({
            method: "personal_sign",
            params: [
              buildUnlockMessage({
                purpose: "genesis",
                ownerAddress: address,
                agentName: input.name,
              }),
              address,
            ],
          })) as string;
          setIsSigning(false);

          const response = await fetch("/api/genesis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: input.name,
              expertiseType: input.expertiseType,
              sourceLabels: input.sourceLabels,
              desiredCapabilities: input.desiredCapabilities,
              ownerAddress: address,
              unlockSignature,
              sources: input.sources,
              sourceUrls: input.sourceUrls,
            }),
          });

          if (!response.body) throw new Error("Genesis stream did not start");

          await readSse(response.body, (event, data) => {
            setEvents((current) => [...current, event]);
            if (event === "ready") setReady(data as GenesisReadyPayload);
            if (event === "error") {
              const payload = data as { message?: string };
              setError(payload.message ?? "Genesis failed");
            }
          });
        } catch (err) {
          setError(formatError(err));
        } finally {
          setIsSigning(false);
          setIsForging(false);
        }
      },
      approveGenesisReview: () => setIsApproved(true),
      clearGenesisReview: () => {
        setEvents([]);
        setReady(null);
        setError(null);
        setMintTxHash(null);
        setMintedTokenId(null);
        setIsMintConfirmed(false);
        setIsApproved(false);
        clearGenesisSession();
      },
      mintGenesis: async (input?: {
        usageFeeOg?: string;
        breedingFeeOg?: string;
      }) => {
        if (!isApproved) {
          setError("Approve the generated agent artifact before minting.");
          return;
        }
        if (!ready?.mintTransaction.to) {
          setError("Set NEXT_PUBLIC_CONTRACT_ADDRESS before minting.");
          return;
        }
        if (!address) return;

        try {
          const usageFeeWei = parseOgFee(input?.usageFeeOg);
          const breedingFeeWei = parseOgFee(input?.breedingFeeOg);
          setError(null);
          setMintTxHash(null);
          setMintedTokenId(null);
          setIsMintConfirmed(false);
          setIsMinting(true);
          const txHash = (await getEthereum().request({
            method: "eth_sendTransaction",
            params: [
              {
                from: address,
                to: ready.mintTransaction.to,
                data: ready.mintCalldata,
              },
            ],
          })) as Hex;
          setMintTxHash(txHash);
          setEvents((current) => [...current, "mint-submitted"]);
          const receipt = await waitForTransactionReceipt(getEthereum(), txHash);
          if (!isSuccessfulReceipt(receipt)) {
            throw new Error("Mint transaction was mined but reverted.");
          }
          const tokenId = extractMintedTokenId(receipt);
          if (tokenId) setMintedTokenId(tokenId);
          setIsMintConfirmed(true);
          setEvents((current) => [...current, "mint-confirmed"]);
          if ((usageFeeWei > 0n || breedingFeeWei > 0n) && !tokenId) {
            throw new Error(
              "Mint confirmed, but the minted token id was not found in the receipt. Set fees from the agent page."
            );
          }
          if (tokenId && usageFeeWei > 0n) {
            setEvents((current) => [...current, "setting-usage-fee"]);
            await sendTransactionAndWait(getEthereum(), {
              from: address,
              to: ready.mintTransaction.to,
              data: encodeSetUsageFeeCalldata(tokenId, usageFeeWei),
            });
            setEvents((current) => [...current, "usage-fee-set"]);
          }
          if (tokenId && breedingFeeWei > 0n) {
            setEvents((current) => [...current, "setting-breeding-fee"]);
            await sendTransactionAndWait(getEthereum(), {
              from: address,
              to: ready.mintTransaction.to,
              data: encodeSetBreedingFeeCalldata(tokenId, breedingFeeWei),
            });
            setEvents((current) => [...current, "breeding-fee-set"]);
          }
        } catch (err) {
          setError(formatError(err));
        } finally {
          setIsMinting(false);
        }
      },
    }),
    [
      address,
      error,
      events,
      isApproved,
      isBusy,
      isForging,
      isMinting,
      isMintConfirmed,
      isSigning,
      mintTxHash,
      mintedTokenId,
      ready,
    ]
  );
}

export function canMintReviewedGenesis(input: {
  ready: Pick<GenesisReadyPayload, "mintTransaction"> | null;
  isMinting: boolean;
  isApproved: boolean;
  isMintConfirmed?: boolean;
}): boolean {
  return (
    input.isApproved &&
    !input.isMinting &&
    !input.isMintConfirmed &&
    Boolean(input.ready?.mintTransaction.to)
  );
}

type TransactionReceipt = {
  status?: string;
  logs?: Array<{
    address?: Hex;
    topics?: Hex[];
    data?: Hex;
  }>;
};

export async function waitForTransactionReceipt(
  ethereum: EthereumProvider,
  txHash: Hex,
  options: { attempts?: number; intervalMs?: number } = {}
): Promise<TransactionReceipt> {
  const attempts = options.attempts ?? 60;
  const intervalMs = options.intervalMs ?? 2000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as TransactionReceipt | null;
    if (receipt) return receipt;
    await delay(intervalMs);
  }

  throw new Error(
    "Mint transaction was submitted, but confirmation timed out. Check the transaction link and refresh the Agents page."
  );
}

export function isSuccessfulReceipt(receipt: TransactionReceipt): boolean {
  return receipt.status === "0x1" || receipt.status === "1";
}

export function extractMintedTokenId(receipt: TransactionReceipt): string | null {
  for (const log of receipt.logs ?? []) {
    if (!log.topics?.length || !log.data) continue;
    try {
      const decoded = decodeEventLog({
        abi: THOUGHTLINE_AGENT_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName !== "AgentMinted") continue;
      const args = decoded.args as { tokenId?: bigint | number | string };
      return args.tokenId?.toString() ?? null;
    } catch {
      // Ignore logs from other events/contracts in the same receipt.
    }
  }
  return null;
}

async function sendTransactionAndWait(
  ethereum: EthereumProvider,
  transaction: { from: Hex; to: Hex; data: Hex }
) {
  const txHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [transaction],
  })) as Hex;
  const receipt = await waitForTransactionReceipt(ethereum, txHash);
  if (!isSuccessfulReceipt(receipt)) {
    throw new Error("Fee-setting transaction was mined but reverted.");
  }
}

export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = chunk.match(/^event: (.+)$/m)?.[1];
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      if (event) onEvent(event, data ? JSON.parse(data) : {});
    }
  }
}

function getEthereum(): EthereumProvider {
  const ethereum = getOptionalEthereum();
  if (!ethereum) throw new Error("No browser wallet found.");
  return ethereum;
}

function getOptionalEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultGenesisSession(): GenesisSessionState {
  return {
    events: [],
    ready: null,
    error: null,
    mintTxHash: null,
    mintedTokenId: null,
    isMintConfirmed: false,
    isApproved: false,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOgFee(value: string | undefined): bigint {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return 0n;
  try {
    return parseEther(trimmed);
  } catch {
    throw new Error("Enter valid 0G fee amounts before minting.");
  }
}

function loadGenesisSession(): GenesisSessionState {
  if (typeof window === "undefined") return defaultGenesisSession();
  try {
    const raw = window.sessionStorage.getItem(GENESIS_SESSION_KEY);
    if (!raw) return defaultGenesisSession();
    const session = { ...defaultGenesisSession(), ...JSON.parse(raw) };
    if (isStaleGenesisSession(session)) {
      clearGenesisSession();
      return defaultGenesisSession();
    }
    return session;
  } catch {
    return defaultGenesisSession();
  }
}

function isStaleGenesisSession(session: GenesisSessionState): boolean {
  if (!session.ready || typeof window === "undefined") return false;
  const gallery = loadCachedGalleryAgents();
  if (gallery.length === 0) return false;

  return gallery.some(
    (agent) =>
      agent.publicUri === session.ready?.publicUri ||
      agent.dataHash === session.ready?.dataHash ||
      agent.publicProfile.name === session.ready?.publicProfile.name
  );
}

function loadCachedGalleryAgents(): PublicAgentView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PublicAgentView[]) : [];
  } catch {
    return [];
  }
}

function saveGenesisSession(state: GenesisSessionState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GENESIS_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Session storage is a convenience for reload recovery. Ignore quota or
    // privacy-mode failures; the live flow still works without it.
  }
}

function clearGenesisSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(GENESIS_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}
