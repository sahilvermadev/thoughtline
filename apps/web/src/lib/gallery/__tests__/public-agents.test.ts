import { describe, expect, it } from "vitest";
import { createAgentArchive } from "@/lib/agent-archive";
import { createMemoryStorage } from "@/lib/storage/memory";
import {
  loadPublicAgents,
  loadPublicAgentsResult,
  serializePublicAgents,
  type MintedAgentRecord,
} from "../public-agents";

function makeProfile(name: string, createdAt: string) {
  return {
    name,
    description: `${name} description`,
    skills: [
      {
        id: `${name.toLowerCase()}-skill`,
        name: `${name} Skill`,
        description: `${name} can do work`,
        skillMarkdown: `# ${name} Skill`,
        source: "genesis" as const,
        parentSkillIds: [],
      },
    ],
    parentIds: null,
    generation: 0,
    createdAt,
  };
}

describe("public gallery agents", () => {
  it("loads public profiles and sorts newest tokens first", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage);
    const older = await archive.storePublic(
      makeProfile("Older", "2024-01-01T00:00:00.000Z")
    );
    const newer = await archive.storePublic(
      makeProfile("Newer", "2024-01-02T00:00:00.000Z")
    );

    const source = {
      async listMintedAgents(): Promise<MintedAgentRecord[]> {
        return [
          {
            tokenId: 2n,
            owner: "0x2222222222222222222222222222222222222222",
            publicUri: newer.uri,
            privateUri: "0g://private-newer",
            dataHash: `0x${"b".repeat(64)}`,
            hasParents: true,
            parentA: 4n,
            parentB: 5n,
          },
          {
            tokenId: 1n,
            owner: "0x1111111111111111111111111111111111111111",
            publicUri: older.uri,
            privateUri: "0g://private-older",
            dataHash: `0x${"a".repeat(64)}`,
            hasParents: false,
            parentA: 0n,
            parentB: 0n,
          },
        ];
      },
    };

    const agents = await loadPublicAgents({ storage, source });

    expect(agents).toHaveLength(2);
    expect(agents[0].tokenId).toBe(2n);
    expect(agents[0].publicProfile.name).toBe("Newer");
    expect(agents[1].tokenId).toBe(1n);
    expect(agents[1].publicProfile.name).toBe("Older");

    const serialized = serializePublicAgents(agents);
    expect(serialized[0]).toMatchObject({
      tokenId: "2",
      dataHash: `0x${"b".repeat(64)}`,
      parentA: "4",
      parentB: "5",
    });
    expect(serialized[1]).toMatchObject({
      tokenId: "1",
      hasParents: false,
      parentA: null,
      parentB: null,
    });
  });

  it("skips minted agents whose public profile can no longer be loaded", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage);
    const stored = await archive.storePublic(
      makeProfile("Visible", "2024-01-01T00:00:00.000Z")
    );

    const source = {
      async listMintedAgents(): Promise<MintedAgentRecord[]> {
        return [
          {
            tokenId: 2n,
            owner: "0x2222222222222222222222222222222222222222",
            publicUri: "memory://missing",
            privateUri: "0g://private-missing",
            dataHash: `0x${"b".repeat(64)}`,
            hasParents: false,
            parentA: 0n,
            parentB: 0n,
          },
          {
            tokenId: 1n,
            owner: "0x1111111111111111111111111111111111111111",
            publicUri: stored.uri,
            privateUri: "0g://private-visible",
            dataHash: `0x${"a".repeat(64)}`,
            hasParents: false,
            parentA: 0n,
            parentB: 0n,
          },
        ];
      },
    };

    const agents = await loadPublicAgents({ storage, source });

    expect(agents).toHaveLength(1);
    expect(agents[0].tokenId).toBe(1n);
    expect(agents[0].publicProfile.name).toBe("Visible");
  });

  it("reports public profile hydration failures for recovery diagnostics", async () => {
    const storage = createMemoryStorage();
    const source = {
      async listMintedAgents(): Promise<MintedAgentRecord[]> {
        return [
          {
            tokenId: 2n,
            owner: "0x2222222222222222222222222222222222222222",
            publicUri: "memory://missing",
            privateUri: "0g://private-missing",
            dataHash: `0x${"b".repeat(64)}`,
            hasParents: false,
            parentA: 0n,
            parentB: 0n,
          },
        ];
      },
    };

    const result = await loadPublicAgentsResult({ storage, source });

    expect(result.agents).toEqual([]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        tokenId: "2",
        publicUri: "memory://missing",
      }),
    ]);
    expect(result.failures[0].error).toBeTruthy();
  });
});
