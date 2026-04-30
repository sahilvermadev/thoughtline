import { describe, expect, it } from "vitest";
import { createAgentArchive } from "@/lib/agent-archive";
import { createMemoryStorage } from "@/lib/storage/memory";
import { createPublicAgentsResponse } from "@/lib/gallery/public-agents-route";

function makeProfile(name: string, createdAt: string) {
  return {
    name,
    description: `${name} description`,
    skills: [
      {
        id: `${name.toLowerCase().replace(/\s+/g, "-")}-skill`,
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

describe("GET /api/agents", () => {
  it("returns public agent records for the gallery", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage);
    const stored = await archive.storePublic(
      makeProfile("Gallery Agent", "2024-01-01T00:00:00.000Z")
    );

    const response = await createPublicAgentsResponse({
      storage,
      source: {
        async listMintedAgents() {
          return [
            {
              tokenId: 9n,
              owner: "0x9999999999999999999999999999999999999999",
              publicUri: stored.uri,
              privateUri: "0g://private-gallery",
              dataHash: `0x${"9".repeat(64)}`,
              hasParents: false,
              parentA: 0n,
              parentB: 0n,
            },
          ];
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-ThoughtLine-Gallery-Failures")).toBe("[]");
    const body = (await response.json()) as Array<{
      tokenId: string;
      publicProfile: { name: string };
      dataHash: string;
      privateUri: string;
    }>;

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      tokenId: "9",
      publicProfile: { name: "Gallery Agent" },
      dataHash: `0x${"9".repeat(64)}`,
      privateUri: "0g://private-gallery",
    });
  });
});
