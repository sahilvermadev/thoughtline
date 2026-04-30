import { describe, it, expect } from "vitest";
import { createStorage } from "../index";
import {
  createZeroGStorage,
  parseZeroGUri,
  readZeroGStorageConfig,
  rootHashToUri,
} from "../zero-g";

describe("StorageProvider", () => {
  describe("memory adapter", () => {
    it("uploads bytes and returns a URI that can be fetched back", async () => {
      const storage = createStorage("memory");
      const bytes = new TextEncoder().encode("hello world");

      const { uri, providerHash } = await storage.upload(bytes);
      expect(uri).toBeTruthy();
      expect(providerHash).toMatch(/^[0-9a-f]{64}$/);

      const fetched = await storage.fetch(uri);
      expect(new TextDecoder().decode(fetched)).toBe("hello world");
    });

    it("returns the same hash for identical bytes across uploads", async () => {
      const storage = createStorage("memory");
      const bytes = new TextEncoder().encode("same content");

      const a = await storage.upload(bytes);
      const b = await storage.upload(bytes);

      expect(a.providerHash).toBe(b.providerHash);
      expect(a.uri).not.toBe(b.uri);
    });

    it("returns different URIs for different uploads", async () => {
      const storage = createStorage("memory");

      const a = await storage.upload(new TextEncoder().encode("first"));
      const b = await storage.upload(new TextEncoder().encode("second"));

      expect(a.uri).not.toBe(b.uri);
      expect(a.providerHash).not.toBe(b.providerHash);
    });

    it("throws when fetching a non-existent URI", async () => {
      const storage = createStorage("memory");

      await expect(storage.fetch("nonexistent")).rejects.toThrow(/not found/i);
    });
  });

  describe("0g adapter", () => {
    it("parses and formats 0G storage URIs", () => {
      const rootHash = `0x${"a".repeat(64)}`;

      expect(rootHashToUri(rootHash)).toBe(`0g://${rootHash}`);
      expect(parseZeroGUri(`0g://${rootHash}`)).toBe(rootHash);
      expect(() => parseZeroGUri("https://example.com/file")).toThrow(
        /invalid 0g storage uri/i
      );
      expect(() => rootHashToUri("not-a-root")).toThrow(
        /invalid 0g root hash/i
      );
    });

    it("validates private key configuration before creating the env adapter", () => {
      expect(() => readZeroGStorageConfig({})).toThrow(/private_key/i);
      expect(
        readZeroGStorageConfig({
          OG_PRIVATE_KEY: `0x${"1".repeat(64)}`,
        }).storageIndexer
      ).toContain("indexer-storage-testnet");
    });

    it("rejects invalid 0G URIs before downloading", async () => {
      const storage = createZeroGStorage({
        privateKey: `0x${"1".repeat(64)}`,
        rpcUrl: "https://evmrpc-testnet.0g.ai",
        storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
      });

      await expect(storage.fetch("0g://not-a-root")).rejects.toThrow(
        /invalid 0g storage uri/i
      );
    });

    it.skipIf(process.env.VITEST_0G !== "1")(
      "round-trips bytes through Galileo storage",
      async () => {
        const storage = createStorage("0g");
        const bytes = new TextEncoder().encode(
          `thoughtline storage test ${Date.now()}`
        );

        const uploaded = await storage.upload(bytes);
        expect(uploaded.uri).toMatch(/^0g:\/\/0x[0-9a-fA-F]{64}$/);
        expect(uploaded.providerHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

        const fetched = await storage.fetch(uploaded.uri);
        expect(new TextDecoder().decode(fetched)).toBe(
          new TextDecoder().decode(bytes)
        );
      },
      120_000
    );
  });
});
