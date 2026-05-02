import { describe, expect, it, vi } from "vitest";
import type { PrivateWorldview, PublicProfile } from "@thoughtline/shared";
import { createAgentArchive } from "@/lib/agent-archive";
import {
  sendAgentConversationMessage,
  sendAuthorizedAgentConversationMessage,
} from "@/lib/agent-conversation/client";
import type { EthereumProvider } from "@/lib/browser-wallet";
import { unlockAgentWorldview } from "@/lib/owner-unlock";
import { createMemoryStorage } from "@/lib/storage/memory";
import { buildUnlockMessage, deriveUnlockKey } from "@/lib/unlock";

const owner =
  "0x1111111111111111111111111111111111111111" as `0x${string}`;
const nonOwner = "0x2222222222222222222222222222222222222222";
const signature = "0xsigned-token-unlock";

const privateWorldview: PrivateWorldview = {
  values: ["clarity"],
  heuristics: ["Prefer reversible decisions"],
  blindspots: [],
  decisionStyle: "analytical",
  freeform: "Private reasoning fingerprint.",
};

const publicProfile: PublicProfile = {
  name: "The Analyst",
  description: "Reviews decisions.",
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  skills: [
    {
      id: "decision-review",
      name: "Decision Review",
      description: "Reviews a decision for tradeoffs.",
      skillMarkdown:
        "---\nname: Decision Review\n---\n## Procedure\nCompare options.",
      source: "genesis",
      parentSkillIds: [],
    },
  ],
};

describe("agent workbench browser helpers", () => {
  it("unlocks an owned agent using a token-scoped signature", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage);
    const key = await deriveUnlockKey(signature);
    const privateStored = await archive.storePrivate(privateWorldview, key);
    const request = vi.fn(async () => signature);

    const unlocked = await unlockAgentWorldview({
      agent: agentView(privateStored.uri),
      connectedAddress: owner.toUpperCase(),
      ethereum: { request } satisfies EthereumProvider,
      storage,
    });

    expect(unlocked).toEqual(privateWorldview);
    expect(request).toHaveBeenCalledWith({
      method: "personal_sign",
      params: [
        buildUnlockMessage({
          scope: "agent-token",
          ownerAddress: owner.toUpperCase(),
          tokenId: "7",
        }),
        owner.toUpperCase(),
      ],
    });
  });

  it("rejects non-owner unlock before requesting a signature", async () => {
    const request = vi.fn();

    await expect(
      unlockAgentWorldview({
        agent: agentView("memory://private"),
        connectedAddress: nonOwner,
        ethereum: { request } satisfies EthereumProvider,
        storage: createMemoryStorage(),
      })
    ).rejects.toThrow("Only the token owner");

    expect(request).not.toHaveBeenCalled();
  });

  it("sends an owner-unlocked conversation message with the decrypted worldview", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content: "Use option A.",
              usedSkillId: "decision-review",
            },
            usedSkillId: "decision-review",
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await sendAgentConversationMessage({
      agent: agentView("memory://private"),
      privateWorldview,
      messages: [{ role: "user", content: "Pick an option." }],
      skillId: "decision-review",
    });

    expect(response.message.content).toBe("Use option A.");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/converse-agent");
    expect(requestBody.skillId).toBe("decision-review");
    expect(requestBody.messages).toEqual([
      { role: "user", content: "Pick an option." },
    ]);
    expect(requestBody.publicProfile.skills[0].id).toBe("decision-review");
    expect(requestBody.privateWorldview).toEqual(privateWorldview);

    vi.unstubAllGlobals();
  });

  it("sends an authorized non-owner ask without a private worldview payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            role: "assistant",
            content: "Use option A.",
            usedSkillId: "decision-review",
          },
          usedSkillId: "decision-review",
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendAuthorizedAgentConversationMessage({
      tokenId: "7",
      callerAddress: nonOwner,
      messages: [{ role: "user", content: "Pick an option." }],
      skillId: "decision-review",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/agents/7/ask");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      callerAddress: nonOwner,
      messages: [{ role: "user", content: "Pick an option." }],
      skillId: "decision-review",
    });
    expect(requestBody.privateWorldview).toBeUndefined();

    vi.unstubAllGlobals();
  });
});

function agentView(privateUri: string) {
  return {
    tokenId: "7",
    owner,
    publicUri: "memory://public",
    privateUri,
    dataHash: `0x${"1".repeat(64)}` as `0x${string}`,
    hasParents: false,
    parentA: null,
    parentB: null,
    publicProfile,
  };
}
