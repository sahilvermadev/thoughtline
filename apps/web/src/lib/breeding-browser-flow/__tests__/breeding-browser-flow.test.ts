import { describe, expect, it, vi } from "vitest";
import type { PublicProfile } from "@thoughtline/shared";
import { buildUnlockMessage } from "@/lib/unlock";
import { breedAuthorizedChild } from "../index";

const owner = "0x1111111111111111111111111111111111111111" as const;

describe("authorized breeding browser flow", () => {
  it("signs a child unlock message, consumes SSE, and exposes the ready artifact", async () => {
    const request = vi.fn(async () => "0xsigned-child");
    const fetch = vi.fn(async () => {
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode("event: preparing\ndata: {}\n\n"));
            controller.enqueue(
              encoder.encode(
                `event: ready\ndata: ${JSON.stringify(readyArtifact())}\n\n`
              )
            );
            controller.close();
          },
        })
      );
    });
    const events: string[] = [];

    const ready = await breedAuthorizedChild({
      parentTokenIdA: "4",
      parentTokenIdB: "9",
      childName: "Clarity Builder",
      childBrief: "Turn operational notes into launch decisions.",
      callerAddress: owner,
      ethereum: { request },
      fetch,
      onEvent: (event) => events.push(event),
    });

    expect(events).toEqual(["preparing", "ready"]);
    expect(ready.publicProfile.parentIds).toEqual(["4", "9"]);
    expect(request).toHaveBeenCalledWith({
      method: "personal_sign",
      params: [
        buildUnlockMessage({
          scope: "breeding-child",
          ownerAddress: owner,
          agentName: "Clarity Builder",
        }),
        owner,
      ],
    });
    expect(fetch).toHaveBeenCalledWith("/api/breed-authorized", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentTokenIdA: "4",
        parentTokenIdB: "9",
        callerAddress: owner,
        childName: "Clarity Builder",
        childBrief: "Turn operational notes into launch decisions.",
        unlockSignature: "0xsigned-child",
      }),
    });
  });
});

function readyArtifact() {
  const publicProfile: PublicProfile = {
    name: "Clarity Builder",
    description: "A child advisor.",
    generation: 1,
    parentIds: ["4", "9"],
    createdAt: "2026-01-01T00:00:00.000Z",
    skills: [],
  };

  return {
    publicProfile,
    publicUri: "memory://public",
    privateUri: "memory://private",
    dataHash: `0x${"1".repeat(64)}`,
    mintCalldata: "0x1234",
    mintTransaction: {
      to: "0x3333333333333333333333333333333333333333",
      data: "0x1234",
      chainId: 16602,
    },
  };
}
