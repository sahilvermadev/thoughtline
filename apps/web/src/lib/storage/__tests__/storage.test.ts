import { describe, it, expect } from "vitest";
import { createStorage } from "../index.js";

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
});
