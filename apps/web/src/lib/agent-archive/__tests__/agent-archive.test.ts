import { describe, it, expect } from "vitest";
import type { AgentMetadata } from "@thoughtline/shared";
import { createMemoryStorage } from "../../storage/memory";
import {
  AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR,
  createAgentArchive,
} from "../index";
import {
  createWebCryptoProvider,
  type CryptoProvider,
  type EncryptionKey,
} from "../../crypto/index";

const sampleMetadata: AgentMetadata = {
  publicProfile: {
    name: "The Stoic",
    description: "A calm, rational advisor",
    skills: [
      {
        id: "reason-from-first-principles",
        name: "Reason From First Principles",
        description: "Breaks problems into controllable fundamentals.",
        skillMarkdown: `---
name: Reason From First Principles
description: Breaks problems into controllable fundamentals.
---

## When to Use

Use this for hard decisions.

## Inputs

- A decision prompt

## Procedure

1. Identify controllable facts.
2. Separate assumptions from evidence.

## Output

Return a concise recommendation.`,
        source: "genesis",
        parentSkillIds: [],
      },
    ],
    parentIds: null,
    generation: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  privateWorldview: {
    values: ["discipline", "reason"],
    heuristics: ["Focus on what you can control"],
    blindspots: ["Undervalues emotion"],
    decisionStyle: "analytical",
    freeform: "A stoic philosopher who values reason above all.",
  },
};

describe("AgentArchive", () => {
  it("round-trips split metadata through storage", async () => {
    const archive = createAgentArchive(createMemoryStorage(), fakeCrypto());

    const stored = await archive.store(sampleMetadata, testKey());
    expect(stored.publicUri).toBeTruthy();
    expect(stored.privateUri).toBeTruthy();
    expect(stored.dataHash).toMatch(/^[0-9a-f]{64}$/);

    const loaded = await archive.load(
      stored.publicUri,
      stored.privateUri,
      testKey()
    );
    expect(loaded).toEqual(sampleMetadata);
  });

  it("computes dataHash from private ciphertext bytes", async () => {
    const archive = createAgentArchive(createMemoryStorage(), fakeCrypto());

    const stored = await archive.storePrivate(
      sampleMetadata.privateWorldview,
      testKey()
    );

    expect(stored.dataHash).toBe(
      await fakeCrypto().sha256Hex(
        await fakeCrypto().encrypt(
          new TextEncoder().encode(
            JSON.stringify(sampleMetadata.privateWorldview)
          ),
          testKey()
        )
      )
    );
  });

  it("rejects loading public bytes that do not match the public profile schema", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage, fakeCrypto());

    const { uri } = await storage.upload(
      new TextEncoder().encode(JSON.stringify({ not: "valid" }))
    );

    await expect(archive.loadPublic(uri)).rejects.toThrow();
  });

  it("stores a V2 private worldview envelope when a runtime public key is configured", async () => {
    const storage = createMemoryStorage();
    const keyPair = await generateRuntimeKeyPair();
    const archive = createAgentArchive(storage, createWebCryptoProvider(), {
      runtimePublicKeyJwk: keyPair.publicKeyJwk,
      runtimePrivateKeyJwk: keyPair.privateKeyJwk,
    });

    const stored = await archive.storePrivate(
      sampleMetadata.privateWorldview,
      testKey()
    );
    const envelopeBytes = await storage.fetch(stored.uri);
    const envelope = JSON.parse(new TextDecoder().decode(envelopeBytes)) as {
      version: number;
      ciphertext: string;
      wrappedKeys: { owner: unknown; runtime: unknown };
    };

    expect(envelope.version).toBe(2);
    expect(envelope.ciphertext).toBeTruthy();
    expect(envelope.wrappedKeys.owner).toBeTruthy();
    expect(envelope.wrappedKeys.runtime).toBeTruthy();
    expect(stored.dataHash).toBe(
      await createWebCryptoProvider().sha256Hex(envelopeBytes)
    );
  });

  it("loads V2 private worldviews through owner and runtime unwrap paths", async () => {
    const storage = createMemoryStorage();
    const keyPair = await generateRuntimeKeyPair();
    const archive = createAgentArchive(storage, createWebCryptoProvider(), {
      runtimePublicKeyJwk: keyPair.publicKeyJwk,
      runtimePrivateKeyJwk: keyPair.privateKeyJwk,
    });

    const stored = await archive.storePrivate(
      sampleMetadata.privateWorldview,
      testKey()
    );

    await expect(archive.loadPrivate(stored.uri, testKey())).resolves.toEqual(
      sampleMetadata.privateWorldview
    );
    await expect(archive.loadPrivateForRuntime(stored.uri)).resolves.toEqual(
      sampleMetadata.privateWorldview
    );
  });

  it("keeps legacy raw ciphertext load support for owner unlock", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage, fakeCrypto());
    const stored = await archive.storePrivate(
      sampleMetadata.privateWorldview,
      testKey()
    );

    await expect(archive.loadPrivate(stored.uri, testKey())).resolves.toEqual(
      sampleMetadata.privateWorldview
    );
  });

  it("rejects legacy raw ciphertext for runtime private loads", async () => {
    const storage = createMemoryStorage();
    const archive = createAgentArchive(storage, fakeCrypto());
    const stored = await archive.storePrivate(
      sampleMetadata.privateWorldview,
      testKey()
    );

    await expect(archive.loadPrivateForRuntime(stored.uri)).rejects.toThrow(
      AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR
    );
  });
});

function testKey(): EncryptionKey {
  return new Uint8Array(32).fill(7);
}

function fakeCrypto(): CryptoProvider {
  return {
    async encrypt(plaintext) {
      const encrypted = new Uint8Array(plaintext.length + 1);
      encrypted[0] = 42;
      encrypted.set(plaintext, 1);
      return encrypted;
    },
    async decrypt(ciphertext) {
      if (ciphertext[0] !== 42) throw new Error("Invalid fake ciphertext");
      return ciphertext.slice(1);
    },
    async sha256Hex(bytes) {
      const hash = await globalThis.crypto.subtle.digest(
        "SHA-256",
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer
      );
      return [...new Uint8Array(hash)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
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
