"use client";

import { useMemo, useState } from "react";
import type { PublicProfile } from "@thoughtline/shared";
import { buildUnlockMessage } from "../unlock";

export type Hex = `0x${string}`;

export type GenesisReadyPayload = {
  publicProfile: PublicProfile;
  publicUri: string;
  privateUri: string;
  dataHash: Hex;
  mintCalldata: Hex;
  mintTransaction: { to: Hex | null; data: Hex; chainId: number };
};

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function useGenesisBrowserFlow() {
  const [address, setAddress] = useState<Hex | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [ready, setReady] = useState<GenesisReadyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForging, setIsForging] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const isBusy = isForging || isSigning || isMinting;

  return useMemo(
    () => ({
      address,
      events,
      ready,
      error,
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
      forgeGenesis: async (input: { name: string; sourceText: string }) => {
        if (!address) return;
        setError(null);
        setReady(null);
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
              ownerAddress: address,
              unlockSignature,
              sources: [{ label: "source", text: input.sourceText }],
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
      mintGenesis: async () => {
        if (!ready?.mintTransaction.to) {
          setError("Set NEXT_PUBLIC_CONTRACT_ADDRESS before minting.");
          return;
        }
        if (!address) return;

        try {
          setIsMinting(true);
          await getEthereum().request({
            method: "eth_sendTransaction",
            params: [
              {
                from: address,
                to: ready.mintTransaction.to,
                data: ready.mintCalldata,
              },
            ],
          });
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
      isBusy,
      isForging,
      isMinting,
      isSigning,
      ready,
    ]
  );
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
  const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!ethereum) throw new Error("No browser wallet found.");
  return ethereum;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
