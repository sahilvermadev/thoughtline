"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import type { PrivateWorldview } from "@thoughtline/shared";
import type { AgentConversationMessage } from "@/lib/agent-conversation";
import {
  sendAgentConversationMessage,
  sendAuthorizedAgentConversationMessage,
} from "@/lib/agent-conversation/client";
import type { AccessTermsResponseBody } from "@/lib/authorized-runtime/access-terms-route";
import {
  fetchAgentAccessTerms,
  payForUsageAndWait,
  setAccessFeeAndWait,
} from "@/lib/access-terms-browser-flow";
import {
  breedAuthorizedChild,
  canMintReviewedChild,
  type BreedingReadyPayload,
} from "@/lib/breeding-browser-flow";
import { getBrowserEthereum } from "@/lib/browser-wallet";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import {
  createPrivateDataProofRequest,
  filterPublicAgentFeed,
  type PublicAgentProofState,
} from "@/lib/gallery/public-feed";
import { useGenesisBrowserFlow } from "@/lib/genesis-browser-flow";
import { unlockAgentWorldview } from "@/lib/owner-unlock";
import type { PrivateDataHashProof } from "@/lib/proof/private-data";

type UnlockState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; worldview: PrivateWorldview }
  | { status: "error"; error: string };

type ConversationState = {
  status: "idle" | "loading" | "error";
  messages: AgentConversationMessage[];
  error?: string;
};

type AccessTermsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; terms: AccessTermsResponseBody }
  | { status: "updating"; terms: AccessTermsResponseBody }
  | { status: "error"; error: string; terms?: AccessTermsResponseBody };

type BreedingState = {
  parentTokenIdA: string;
  parentTokenIdB: string;
  childName: string;
  childBrief: string;
  events: string[];
  ready: BreedingReadyPayload | null;
  isApproved: boolean;
  error: string | null;
  mintTxHash: `0x${string}` | null;
  isBreeding: boolean;
  isMinting: boolean;
};

const GALLERY_CACHE_KEY = "thoughtline.gallery.cache.v1";

export function useAgentWorkbench() {
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<PublicAgentView[]>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryWarning, setGalleryWarning] = useState<string | null>(null);
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);
  const [proofs, setProofs] = useState<Record<string, PublicAgentProofState>>(
    {}
  );
  const [unlockedAgents, setUnlockedAgents] = useState<Record<string, UnlockState>>(
    {}
  );
  const [conversations, setConversations] = useState<
    Record<string, ConversationState>
  >({});
  const [accessTerms, setAccessTerms] = useState<Record<string, AccessTermsState>>(
    {}
  );
  const [feeInputs, setFeeInputs] = useState<
    Record<string, { usage: string; breeding: string }>
  >({});
  const [breeding, setBreeding] = useState<BreedingState>({
    parentTokenIdA: "",
    parentTokenIdB: "",
    childName: "",
    childBrief: "",
    events: [],
    ready: null,
    isApproved: false,
    error: null,
    mintTxHash: null,
    isBreeding: false,
    isMinting: false,
  });
  const genesis = useGenesisBrowserFlow();
  const filteredAgents = useMemo(
    () => filterPublicAgentFeed(agents, search),
    [agents, search]
  );

  useEffect(() => {
    let active = true;

    async function loadGallery() {
      try {
        const cachedAgents = loadCachedGalleryAgents();
        if (cachedAgents.length > 0) {
          setAgents(cachedAgents);
          setIsLoadingGallery(false);
        } else {
          setIsLoadingGallery(true);
        }
        setGalleryError(null);
        setGalleryWarning(null);
        const response = await fetch("/api/agents");
        if (!response.ok) {
          throw new Error(
            (await response.json())?.error ?? "Failed to load gallery"
          );
        }

        const data = (await response.json()) as PublicAgentView[];
        if (active) {
          if (data.length > 0) {
            setAgents(data);
            saveCachedGalleryAgents(data);
          } else if (cachedAgents.length > 0) {
            setGalleryWarning(
              "Showing cached agents while the gallery sync catches up."
            );
          } else {
            setAgents(data);
          }
          const failures = parseGalleryFailures(response);
          if (failures.length > 0) {
            setGalleryWarning(
              `${failures.length} minted agent${
                failures.length === 1 ? "" : "s"
              } could not load public profile data.`
            );
          }
        }
      } catch (error) {
        if (active) {
          setGalleryError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (active) setIsLoadingGallery(false);
      }
    }

    void loadGallery();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!genesis.address || agents.length === 0) return;
    let active = true;

    async function loadAccessTerms() {
      const address = genesis.address;
      if (!address) return;

      setAccessTerms((current) => {
        const next = { ...current };
        for (const agent of agents) {
          if (!next[agent.tokenId]) next[agent.tokenId] = { status: "loading" };
        }
        return next;
      });

      await Promise.all(
        agents.map(async (agent) => {
          try {
            const terms = await fetchAgentAccessTerms(agent.tokenId, address);
            if (!active) return;
            setAccessTerms((current) => ({
              ...current,
              [agent.tokenId]: { status: "ready", terms },
            }));
            setFeeInputs((current) => ({
              ...current,
              [agent.tokenId]: current[agent.tokenId] ?? {
                usage: "",
                breeding: "",
              },
            }));
          } catch (error) {
            if (!active) return;
            setAccessTerms((current) => ({
              ...current,
              [agent.tokenId]: {
                status: "error",
                error: formatError(error),
                terms: accessTermsValue(current[agent.tokenId]),
              },
            }));
          }
        })
      );
    }

    void loadAccessTerms();

    return () => {
      active = false;
    };
  }, [agents, genesis.address]);

  useEffect(() => {
    if (genesis.address) return;
    setUnlockedAgents({});
    setAccessTerms({});
    setFeeInputs({});
  }, [genesis.address]);

  return {
    search,
    setSearch,
    agents,
    filteredAgents,
    galleryError,
    galleryWarning,
    isLoadingGallery,
    proofs,
    unlockedAgents,
    conversations,
    accessTerms,
    feeInputs,
    breeding,
    setBreedingParentA: (tokenId: string) =>
      setBreeding((current) => ({ ...current, parentTokenIdA: tokenId })),
    setBreedingParentB: (tokenId: string) =>
      setBreeding((current) => ({ ...current, parentTokenIdB: tokenId })),
    setBreedingChildName: (childName: string) =>
      setBreeding((current) => ({ ...current, childName })),
    setBreedingChildBrief: (childBrief: string) =>
      setBreeding((current) => ({ ...current, childBrief })),
    approveBreedChildReview: () =>
      setBreeding((current) => ({ ...current, isApproved: true })),
    genesis,
    setFeeInput: (
      tokenId: string,
      kind: "usage" | "breeding",
      value: string
    ) =>
      setFeeInputs((current) => ({
        ...current,
        [tokenId]: {
          usage: current[tokenId]?.usage ?? "",
          breeding: current[tokenId]?.breeding ?? "",
          [kind]: value,
        },
      })),
    setAccessFee: async (
      agent: PublicAgentView,
      kind: "usage" | "breeding"
    ) => {
      if (!genesis.address) return;
      const rawFee = feeInputs[agent.tokenId]?.[kind] ?? "";
      let feeWei: string;
      try {
        feeWei = parseEther(rawFee.trim() === "" ? "0" : rawFee.trim()).toString();
      } catch {
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            error: "Enter a valid 0G amount.",
            terms: accessTermsValue(current[agent.tokenId]),
          },
        }));
        return;
      }

      const existing = accessTerms[agent.tokenId];
      if (existing?.status === "ready" || existing?.status === "updating") {
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: { status: "updating", terms: existing.terms },
        }));
      }

      try {
        const terms = await setAccessFeeAndWait(
          {
            tokenId: agent.tokenId,
            callerAddress: genesis.address,
            kind,
            feeWei,
          },
          {
            ethereum: getBrowserEthereum(),
          }
        );
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: { status: "ready", terms },
        }));
      } catch (error) {
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            error: formatError(error),
            terms: accessTermsValue(current[agent.tokenId]),
          },
        }));
      }
    },
    payForUsage: async (agent: PublicAgentView) => {
      if (!genesis.address) return;
      const existing = accessTerms[agent.tokenId];
      if (existing?.status === "ready" || existing?.status === "updating") {
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: { status: "updating", terms: existing.terms },
        }));
      }

      try {
        const terms = await payForUsageAndWait(
          {
            tokenId: agent.tokenId,
            callerAddress: genesis.address,
          },
          { ethereum: getBrowserEthereum() }
        );
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: { status: "ready", terms },
        }));
      } catch (error) {
        setAccessTerms((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            error: formatError(error),
            terms: accessTermsValue(current[agent.tokenId]),
          },
        }));
      }
    },
    unlockAgent: async (agent: PublicAgentView) => {
      setUnlockedAgents((current) => ({
        ...current,
        [agent.tokenId]: { status: "loading" },
      }));

      try {
        const worldview = await unlockAgentWorldview({
          agent,
          connectedAddress: genesis.address,
          ethereum: getBrowserEthereum(),
        });
        setUnlockedAgents((current) => ({
          ...current,
          [agent.tokenId]: { status: "ready", worldview },
        }));
      } catch (error) {
        setUnlockedAgents((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            error: formatError(error),
          },
        }));
      }
    },
    sendMessage: async (
      agent: PublicAgentView,
      input: { content: string; skillId?: string }
    ) => {
      const unlocked = unlockedAgents[agent.tokenId];
      const isOwner =
        !!genesis.address &&
        genesis.address.toLowerCase() === agent.owner.toLowerCase();
      const termsState = accessTerms[agent.tokenId];
      const canAuthorizedAsk =
        !isOwner &&
        !!genesis.address &&
        (termsState?.status === "ready" || termsState?.status === "updating") &&
        termsState.terms.usage.isAuthorized;

      if (isOwner && unlocked?.status !== "ready") {
        setConversations((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            messages: current[agent.tokenId]?.messages ?? [],
            error: "Unlock this agent before sending a message.",
          },
        }));
        return;
      }
      if (!isOwner && !canAuthorizedAsk) {
        setConversations((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            messages: current[agent.tokenId]?.messages ?? [],
            error: "Pay for usage or connect an authorized wallet before asking.",
          },
        }));
        return;
      }

      const userMessage: AgentConversationMessage = {
        role: "user",
        content: input.content,
      };
      const nextMessages = [
        ...(conversations[agent.tokenId]?.messages ?? []),
        userMessage,
      ];

      setConversations((current) => ({
        ...current,
        [agent.tokenId]: {
          status: "loading",
          messages: nextMessages,
        },
      }));

      try {
        const response =
          unlocked?.status === "ready"
            ? await sendAgentConversationMessage({
                agent,
                privateWorldview: unlocked.worldview,
                messages: nextMessages,
                skillId: input.skillId,
              })
            : await sendAuthorizedAgentConversationMessage({
                tokenId: agent.tokenId,
                callerAddress: genesis.address ?? "",
                messages: nextMessages,
                skillId: input.skillId,
              });
        setConversations((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "idle",
            messages: [...nextMessages, response.message],
          },
        }));
      } catch (error) {
        setConversations((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            messages: nextMessages,
            error: formatError(error),
          },
        }));
      }
    },
    verifyAgent: async (agent: PublicAgentView) => {
      setProofs((current) => ({
        ...current,
        [agent.tokenId]: { status: "loading" },
      }));

      try {
        const response = await fetch("/api/proof/private-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPrivateDataProofRequest(agent)),
        });

        const body = (await response.json()) as
          | PrivateDataHashProof
          | { error: string };

        if (!response.ok) {
          throw new Error("error" in body ? body.error : "Verification failed");
        }

        setProofs((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "ready",
            proof: body as PrivateDataHashProof,
          },
        }));
      } catch (error) {
        setProofs((current) => ({
          ...current,
          [agent.tokenId]: {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    breedSelectedParents: async () => {
      if (!genesis.address) {
        setBreeding((current) => ({
          ...current,
          error: "Connect a wallet before breeding.",
        }));
        return;
      }
      if (!breeding.parentTokenIdA || !breeding.parentTokenIdB) {
        setBreeding((current) => ({
          ...current,
          error: "Select two parent agents.",
        }));
        return;
      }
      if (breeding.parentTokenIdA === breeding.parentTokenIdB) {
        setBreeding((current) => ({
          ...current,
          error: "Select two distinct parent agents.",
        }));
        return;
      }
      if (breeding.childName.trim().length === 0) {
        setBreeding((current) => ({
          ...current,
          error: "Enter a child name.",
        }));
        return;
      }
      if (breeding.childBrief.trim().length === 0) {
        setBreeding((current) => ({
          ...current,
          error: "Enter a child brief.",
        }));
        return;
      }

      setBreeding((current) => ({
        ...current,
        events: [],
        ready: null,
        isApproved: false,
        error: null,
        mintTxHash: null,
        isBreeding: true,
      }));

      try {
        const unlockedParentA = unlockedAgents[breeding.parentTokenIdA];
        const unlockedParentB = unlockedAgents[breeding.parentTokenIdB];
        const ready = await breedAuthorizedChild({
          parentTokenIdA: breeding.parentTokenIdA,
          parentTokenIdB: breeding.parentTokenIdB,
          childName: breeding.childName.trim(),
          childBrief: breeding.childBrief.trim() || undefined,
          callerAddress: genesis.address,
          ethereum: getBrowserEthereum(),
          parentWorldviewA:
            unlockedParentA?.status === "ready"
              ? unlockedParentA.worldview
              : undefined,
          parentWorldviewB:
            unlockedParentB?.status === "ready"
              ? unlockedParentB.worldview
              : undefined,
          onEvent: (event, data) => {
            setBreeding((current) => ({
              ...current,
              events: [...current.events, event],
              ready:
                event === "ready"
                  ? (data as BreedingReadyPayload)
                  : current.ready,
              error:
                event === "error"
                  ? ((data as { message?: string }).message ?? "Breeding failed")
                  : current.error,
            }));
          },
        });
        setBreeding((current) => ({ ...current, ready }));
      } catch (error) {
        setBreeding((current) => ({
          ...current,
          error: formatError(error),
        }));
      } finally {
        setBreeding((current) => ({ ...current, isBreeding: false }));
      }
    },
    mintBreedChild: async () => {
      if (!genesis.address) return;
      if (
        !canMintReviewedChild({
          ready: breeding.ready,
          isMinting: breeding.isMinting,
          isApproved: breeding.isApproved,
        })
      ) {
        setBreeding((current) => ({
          ...current,
          error: "Approve the generated child artifact before minting.",
        }));
        return;
      }
      if (!breeding.ready?.mintTransaction.to) {
        setBreeding((current) => ({
          ...current,
          error: "Set NEXT_PUBLIC_CONTRACT_ADDRESS before minting.",
        }));
        return;
      }

      try {
        setBreeding((current) => ({
          ...current,
          isMinting: true,
          error: null,
          mintTxHash: null,
        }));
        const txHash = (await getBrowserEthereum().request({
          method: "eth_sendTransaction",
          params: [
            {
              from: genesis.address,
              to: breeding.ready.mintTransaction.to,
              data: breeding.ready.mintCalldata,
            },
          ],
        })) as `0x${string}`;
        setBreeding((current) => ({
          ...current,
          events: [...current.events, "mint-submitted"],
          mintTxHash: txHash,
        }));
      } catch (error) {
        setBreeding((current) => ({
          ...current,
          error: formatError(error),
        }));
      } finally {
        setBreeding((current) => ({ ...current, isMinting: false }));
      }
    },
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function saveCachedGalleryAgents(agents: PublicAgentView[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(agents));
  } catch {
    // Cache is best-effort only.
  }
}

function accessTermsValue(
  state: AccessTermsState | undefined
): AccessTermsResponseBody | undefined {
  if (!state) return undefined;
  return "terms" in state ? state.terms : undefined;
}

function parseGalleryFailures(response: Response): unknown[] {
  const value = response.headers.get("X-ThoughtLine-Gallery-Failures");
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
