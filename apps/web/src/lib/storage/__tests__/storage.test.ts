import { describe, it, expect } from "vitest";
import type { AgentMetadata } from "@thoughtline/shared";
import { createStorage } from "../index.js";

const testMetadata: AgentMetadata = {
  name: "The Stoic",
  description: "A calm, rational advisor",
  worldview: {
    values: ["discipline", "reason"],
    heuristics: ["Focus on what you can control"],
    blindspots: ["Undervalues emotion"],
    decisionStyle: "analytical",
    freeform: "A stoic philosopher who values reason above all.",
  },
  parentIds: null,
  generation: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("StorageProvider", () => {
  describe("memory adapter", () => {
    it("uploads metadata and returns a URI that can be fetched", async () => {
      const storage = createStorage("memory");

      const uri = await storage.upload(testMetadata);
      expect(uri).toBeTruthy();

      const fetched = await storage.fetch(uri);
      expect(fetched).toEqual(testMetadata);
    });

    it("returns different URIs for different uploads", async () => {
      const storage = createStorage("memory");

      const uri1 = await storage.upload(testMetadata);
      const uri2 = await storage.upload({
        ...testMetadata,
        name: "The Contrarian",
      });

      expect(uri1).not.toBe(uri2);
    });

    it("throws when fetching a non-existent URI", async () => {
      const storage = createStorage("memory");

      await expect(storage.fetch("nonexistent")).rejects.toThrow(
        /not found/i
      );
    });
  });
});
