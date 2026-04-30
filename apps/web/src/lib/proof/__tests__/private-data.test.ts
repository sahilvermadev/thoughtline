import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/crypto";
import { createMemoryStorage } from "@/lib/storage/memory";
import { verifyPrivateDataHash } from "../private-data";

describe("private data proof", () => {
  it("verifies fetched encrypted bytes against the expected dataHash", async () => {
    const storage = createMemoryStorage();
    const bytes = new TextEncoder().encode("encrypted private worldview bytes");
    const uploaded = await storage.upload(bytes);
    const dataHash = await sha256Hex(bytes);

    const proof = await verifyPrivateDataHash({
      storage,
      privateUri: uploaded.uri,
      dataHash,
    });

    expect(proof.matches).toBe(true);
    expect(proof.expectedDataHash).toBe(`0x${dataHash}`);
    expect(proof.actualDataHash).toBe(`0x${dataHash}`);
    expect(proof.byteLength).toBe(bytes.length);
  });

  it("returns a failed proof for a mismatched dataHash", async () => {
    const storage = createMemoryStorage();
    const uploaded = await storage.upload(new TextEncoder().encode("ciphertext"));

    const proof = await verifyPrivateDataHash({
      storage,
      privateUri: uploaded.uri,
      dataHash: `0x${"0".repeat(63)}1`,
    });

    expect(proof.matches).toBe(false);
  });
});
