"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrivateWorldview } from "@thoughtline/shared";
import type { AgentConversationMessage } from "@/lib/agent-conversation";
import { sendAgentConversationMessage } from "@/lib/agent-conversation/client";
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
  const genesis = useGenesisBrowserFlow();
  const filteredAgents = useMemo(
    () => filterPublicAgentFeed(agents, search),
    [agents, search]
  );

  useEffect(() => {
    let active = true;

    async function loadGallery() {
      try {
        setIsLoadingGallery(true);
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
          setAgents(data);
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
    genesis,
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
      if (unlocked?.status !== "ready") {
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
        const response = await sendAgentConversationMessage({
          agent,
          privateWorldview: unlocked.worldview,
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
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
