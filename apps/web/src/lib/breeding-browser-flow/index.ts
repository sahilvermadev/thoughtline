"use client";

import type { PublicProfile } from "@thoughtline/shared";
import { buildUnlockMessage } from "../unlock";
import { readSse, type EthereumProvider, type Hex } from "../genesis-browser-flow";

export type BreedingReadyPayload = {
  publicProfile: PublicProfile;
  publicUri: string;
  privateUri: string;
  dataHash: Hex;
  mintCalldata: Hex;
  mintTransaction: { to: Hex | null; data: Hex; chainId: number };
};

export interface AuthorizedBreedingBrowserInput {
  parentTokenIdA: string;
  parentTokenIdB: string;
  childName: string;
  childBrief?: string;
  callerAddress: Hex;
  ethereum: EthereumProvider;
  fetch?: typeof globalThis.fetch;
  onEvent?: (event: string, data: unknown) => void;
}

export async function breedAuthorizedChild(
  input: AuthorizedBreedingBrowserInput
): Promise<BreedingReadyPayload> {
  const unlockSignature = (await input.ethereum.request({
    method: "personal_sign",
    params: [
      buildUnlockMessage({
        scope: "breeding-child",
        ownerAddress: input.callerAddress,
        agentName: input.childName,
      }),
      input.callerAddress,
    ],
  })) as string;

  const fetchImpl = input.fetch ?? globalThis.fetch;
  const response = await fetchImpl("/api/breed-authorized", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentTokenIdA: input.parentTokenIdA,
      parentTokenIdB: input.parentTokenIdB,
      callerAddress: input.callerAddress,
      childName: input.childName,
      childBrief: input.childBrief,
      unlockSignature,
    }),
  });

  if (!response.body) throw new Error("Breeding stream did not start");

  let ready: BreedingReadyPayload | null = null;
  await readSse(response.body, (event, data) => {
    input.onEvent?.(event, data);
    if (event === "ready") ready = data as BreedingReadyPayload;
    if (event === "error") {
      const payload = data as { message?: string };
      throw new Error(payload.message ?? "Breeding failed");
    }
  });

  if (!ready) throw new Error("Breeding finished without a child artifact");
  return ready;
}
