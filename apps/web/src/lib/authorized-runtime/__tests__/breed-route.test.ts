import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData } from "viem";
import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
  SkillPackage,
} from "@thoughtline/shared";
import { createAgentArchive } from "@/lib/agent-archive";
import { THOUGHTLINE_AGENT_ABI } from "@/lib/chain/thoughtline";
import { createMemoryStorage } from "@/lib/storage/memory";
import { createAuthorizedBreedResponse } from "../breed-route";
import type { BreedingAccessReader } from "../breeding";
import { createWebCryptoProvider } from "@/lib/crypto/index";

const caller = "0x1111111111111111111111111111111111111111";

const skill: SkillPackage = {
  id: "decision-review",
  name: "Decision Review",
  description: "Reviews decisions.",
  skillMarkdown: "---\nname: Decision Review\n---\n## Procedure\nCompare options.",
  source: "genesis",
  parentSkillIds: [],
};

const parentAWorldview: PrivateWorldview = {
  values: ["clarity"],
  heuristics: ["Prefer reversible decisions"],
  blindspots: [],
  decisionStyle: "analytical",
  freeform: "Private parent A worldview.",
};

const parentBWorldview: PrivateWorldview = {
  values: ["craft"],
  heuristics: ["Ship small increments"],
  blindspots: [],
  decisionStyle: "deliberative",
  freeform: "Private parent B worldview.",
};

describe("authorized breeding route", () => {
  it("streams breeding progress and returns a child mint artifact", async () => {
    const storage = createMemoryStorage();
    const keyPair = await generateRuntimeKeyPair();
    const response = await createAuthorizedBreedResponse(
      new Request("http://localhost/api/breed-authorized", {
        method: "POST",
        body: JSON.stringify({
          parentTokenIdA: "4",
          parentTokenIdB: "9",
          callerAddress: caller,
          childName: "Clarity Builder",
          childBrief: "Turn operational notes into launch decisions.",
          unlockSignature: "0xsigned-child",
        }),
      }),
      {
        accessReader: fakeAccessReader(),
        llm: fakeBreedingLLM(),
        archive: createAgentArchive(storage, createWebCryptoProvider(), {
          runtimePublicKeyJwk: keyPair.publicKeyJwk,
          runtimePrivateKeyJwk: keyPair.privateKeyJwk,
        }),
        storage,
        env: {
          NEXT_PUBLIC_CONTRACT_ADDRESS:
            "0x3333333333333333333333333333333333333333",
          NEXT_PUBLIC_CHAIN_ID: "16602",
        },
      }
    );

    const events = await readSse(response);
    expect(events.map((event) => event.event)).toEqual([
      "preparing",
      "loading-parents",
      "synthesizing-worldview",
      "synthesizing-skills",
      "encrypting",
      "uploading",
      "ready",
    ]);

    const ready = events.at(-1)?.data as Record<string, unknown>;
    expect(JSON.stringify(ready)).not.toContain(parentAWorldview.freeform);
    expect(JSON.stringify(ready)).not.toContain(parentBWorldview.freeform);
    expect(ready.publicUri).toMatch(/^memory:\/\//);
    expect(ready.privateUri).toMatch(/^memory:\/\//);
    expect(ready.dataHash).toMatch(/^0x[0-9a-f]{64}$/);

    const publicProfile = ready.publicProfile as PublicProfile;
    expect(publicProfile.name).toBe("Clarity Builder");
    expect(publicProfile.parentIds).toEqual(["4", "9"]);
    expect(publicProfile.positioning).toBe(
      "Turn operational notes into launch decisions."
    );

    const privateBytes = await storage.fetch(ready.privateUri as string);
    const envelope = JSON.parse(new TextDecoder().decode(privateBytes)) as {
      version: number;
      wrappedKeys: { runtime?: unknown };
    };
    expect(envelope.version).toBe(2);
    expect(envelope.wrappedKeys.runtime).toBeTruthy();

    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data: ready.mintCalldata as `0x${string}`,
    });
    expect(decoded.functionName).toBe("mintChild");
    expect(decoded.args).toEqual([
      ready.publicUri,
      ready.privateUri,
      ready.dataHash,
      4n,
      9n,
    ]);
  });

  it("uses runtime archive keys from process.env when route deps do not inject env", async () => {
    const storage = createMemoryStorage();
    const keyPair = await generateRuntimeKeyPair();
    vi.stubEnv(
      "AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK",
      JSON.stringify(keyPair.publicKeyJwk)
    );
    vi.stubEnv(
      "AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK",
      JSON.stringify(keyPair.privateKeyJwk)
    );

    try {
      const response = await createAuthorizedBreedResponse(
        new Request("http://localhost/api/breed-authorized", {
          method: "POST",
          body: JSON.stringify({
            parentTokenIdA: "4",
            parentTokenIdB: "9",
            callerAddress: caller,
            childName: "Env Child",
            childBrief: "Use route runtime keys.",
            unlockSignature: "0xsigned-child",
          }),
        }),
        {
          accessReader: fakeAccessReader(),
          llm: fakeBreedingLLM(),
          storage,
        }
      );

      const events = await readSse(response);
      const ready = events.at(-1)?.data as Record<string, unknown>;
      const privateBytes = await storage.fetch(ready.privateUri as string);
      const envelope = JSON.parse(new TextDecoder().decode(privateBytes)) as {
        version: number;
        wrappedKeys: { runtime?: unknown };
      };
      expect(envelope.version).toBe(2);
      expect(envelope.wrappedKeys.runtime).toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects an unauthorized caller before invoking the LLM", async () => {
    const llm = {
      chat: vi.fn(),
      async *chatStream() {
        throw new Error("Not used");
      },
    } satisfies LLMProvider;

    const response = await createAuthorizedBreedResponse(
      new Request("http://localhost/api/breed-authorized", {
        method: "POST",
        body: JSON.stringify({
          parentTokenIdA: "4",
          parentTokenIdB: "9",
          callerAddress: "0x2222222222222222222222222222222222222222",
          childName: "Blocked Child",
          unlockSignature: "0xsigned-child",
        }),
      }),
      {
        accessReader: fakeAccessReader(),
        llm,
        archive: createAgentArchive(createMemoryStorage()),
      }
    );

    const events = await readSse(response);
    expect(events.map((event) => event.event)).toEqual([
      "preparing",
      "loading-parents",
      "error",
    ]);
    expect((events.at(-1)?.data as { message: string }).message).toMatch(
      /not authorized to breed/i
    );
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it("rejects duplicate parent ids before invoking the LLM", async () => {
    const llm = {
      chat: vi.fn(),
      async *chatStream() {
        throw new Error("Not used");
      },
    } satisfies LLMProvider;

    const response = await createAuthorizedBreedResponse(
      new Request("http://localhost/api/breed-authorized", {
        method: "POST",
        body: JSON.stringify({
          parentTokenIdA: "4",
          parentTokenIdB: "4",
          callerAddress: caller,
          childName: "Duplicate Child",
          unlockSignature: "0xsigned-child",
        }),
      }),
      {
        accessReader: fakeAccessReader(),
        llm,
        archive: createAgentArchive(createMemoryStorage()),
      }
    );

    const events = await readSse(response);
    expect(events.map((event) => event.event)).toEqual(["error"]);
    expect((events.at(-1)?.data as { message: string }).message).toMatch(
      /distinct/i
    );
    expect(llm.chat).not.toHaveBeenCalled();
  });
});

function fakeAccessReader(): BreedingAccessReader {
  return {
    async getBreedingAccess(tokenId) {
      const parent =
        tokenId === "4"
          ? { name: "Parent A", worldview: parentAWorldview }
          : { name: "Parent B", worldview: parentBWorldview };
      return {
        ownerAddress: caller,
        authorizedBreeders: [],
        publicProfile: profile(parent.name),
        privateWorldview: parent.worldview,
      };
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

function profile(name: string): PublicProfile {
  return {
    name,
    description: `${name} public profile.`,
    generation: 0,
    parentIds: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    skills: [skill],
  };
}

function fakeBreedingLLM(): LLMProvider {
  let calls = 0;
  return {
    async chat() {
      calls += 1;
      if (calls === 1) {
        return {
          content: JSON.stringify({
            values: ["clarity", "craft"],
            heuristics: ["Make reversible progress"],
            blindspots: [],
            decisionStyle: "adaptive",
            freeform: "Private child worldview.",
          }),
        };
      }
      if (calls === 2) {
        return {
          content: JSON.stringify({
            skills: [
              {
                ...skill,
                id: "reversible-progress",
                name: "Reversible Progress",
                source: "synthesized",
                parentSkillIds: ["decision-review"],
              },
            ],
          }),
        };
      }
      return { content: "A child advisor for practical clarity." };
    },
    async *chatStream() {
      throw new Error("Not used");
    },
  };
}

async function readSse(response: Response) {
  const text = await response.text();
  return text
    .trim()
    .split("\n\n")
    .map((chunk) => {
      const event = chunk.match(/^event: (.+)$/m)?.[1] ?? "";
      const data = chunk.match(/^data: (.+)$/m)?.[1] ?? "{}";
      return { event, data: JSON.parse(data) as unknown };
    });
}
