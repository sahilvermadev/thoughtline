import { describe, expect, it } from "vitest";
import type { PrivateWorldview, PublicProfile, SkillPackage } from "@thoughtline/shared";
import { createAgentArchive } from "@/lib/agent-archive";
import type { ThoughtLineChainReader } from "@/lib/chain/reader";
import { createMemoryStorage } from "@/lib/storage/memory";
import { createWebCryptoProvider, type EncryptionKey } from "@/lib/crypto";
import { createChainBreedingAccessReader } from "../access-reader";

const skill: SkillPackage = {
  id: "decision-review",
  name: "Decision Review",
  description: "Reviews decisions.",
  skillMarkdown: "---\nname: Decision Review\n---\n## Procedure\nCompare options.",
  source: "genesis",
  parentSkillIds: [],
};

const publicProfile: PublicProfile = {
  name: "The Analyst",
  description: "Reviews decisions.",
  generation: 0,
  parentIds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  skills: [skill],
};

const privateWorldview: PrivateWorldview = {
  values: ["clarity"],
  heuristics: ["Prefer reversible decisions"],
  blindspots: [],
  decisionStyle: "analytical",
  freeform: "Private runtime worldview.",
};

describe("chain breeding access reader", () => {
  it("loads public profile and V2 private worldview for breeding access", async () => {
    const storage = createMemoryStorage();
    const keyPair = await generateRuntimeKeyPair();
    const archive = createAgentArchive(storage, createWebCryptoProvider(), {
      runtimePublicKeyJwk: keyPair.publicKeyJwk,
      runtimePrivateKeyJwk: keyPair.privateKeyJwk,
    });
    const publicStored = await archive.storePublic(publicProfile);
    const privateStored = await archive.storePrivate(privateWorldview, testKey());
    const reader = createChainBreedingAccessReader({
      storage,
      archive,
      chain: fakeChain({
        publicUri: publicStored.uri,
        privateUri: privateStored.uri,
        authorizedBreeders: ["0x2222222222222222222222222222222222222222"],
      }),
    });

    await expect(reader.getBreedingAccess("7")).resolves.toEqual({
      ownerAddress: "0x1111111111111111111111111111111111111111",
      authorizedBreeders: ["0x2222222222222222222222222222222222222222"],
      publicProfile,
      privateWorldview,
    });
  });

  it("explains that legacy private blobs must be unlocked before breeding", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage);
    const publicStored = await archive.storePublic(publicProfile);
    const privateStored = await archive.storePrivate(privateWorldview, testKey());
    const reader = createChainBreedingAccessReader({
      storage,
      archive,
      chain: fakeChain({
        publicUri: publicStored.uri,
        privateUri: privateStored.uri,
        authorizedBreeders: [],
      }),
    });

    await expect(reader.getBreedingAccess("7")).rejects.toThrow(
      "Parent #7 was stored before runtime breeding access was enabled"
    );
  });

  it("uses a browser-supplied private worldview for legacy breeding parents", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage);
    const publicStored = await archive.storePublic(publicProfile);
    const privateStored = await archive.storePrivate(privateWorldview, testKey());
    const reader = createChainBreedingAccessReader({
      storage,
      archive,
      privateWorldviews: {
        "7": privateWorldview,
      },
      chain: fakeChain({
        publicUri: publicStored.uri,
        privateUri: privateStored.uri,
        authorizedBreeders: [],
      }),
    });

    await expect(reader.getBreedingAccess("7")).resolves.toEqual({
      ownerAddress: "0x1111111111111111111111111111111111111111",
      authorizedBreeders: [],
      publicProfile,
      privateWorldview,
    });
  });
});

function testKey(): EncryptionKey {
  return new Uint8Array(32).fill(7);
}

function fakeChain(input: {
  publicUri: string;
  privateUri: string;
  authorizedBreeders: `0x${string}`[];
}): ThoughtLineChainReader {
  return {
    async listMintedAgents() {
      return [];
    },
    async ownerOf() {
      return "0x1111111111111111111111111111111111111111";
    },
    async tokenURI() {
      return input.publicUri;
    },
    async publicProfileURI() {
      return input.publicUri;
    },
    async privateWorldviewURI() {
      return input.privateUri;
    },
    async dataHash() {
      return `0x${"1".repeat(64)}`;
    },
    async authorizedUsersOf() {
      return [];
    },
    async authorizedBreedersOf() {
      return input.authorizedBreeders;
    },
    async isAuthorizedUser() {
      return false;
    },
    async isAuthorizedBreeder() {
      return false;
    },
    async usageFee() {
      return 0n;
    },
    async breedingFee() {
      return 0n;
    },
    async preparePayForUsage() {
      throw new Error("Not used");
    },
    async preparePayForBreeding() {
      throw new Error("Not used");
    },
    async prepareSetUsageFee() {
      throw new Error("Not used");
    },
    async prepareSetBreedingFee() {
      throw new Error("Not used");
    },
  };
}

async function generateRuntimeKeyPair(): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  return {
    publicKeyJwk: await globalThis.crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey
    ),
    privateKeyJwk: await globalThis.crypto.subtle.exportKey(
      "jwk",
      keyPair.privateKey
    ),
  };
}
