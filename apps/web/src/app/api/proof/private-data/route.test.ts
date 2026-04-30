import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "@/lib/storage/memory";
import { sha256Hex } from "@/lib/crypto";
import { createPrivateDataProofResponse } from "@/lib/proof/private-data-route";

describe("POST /api/proof/private-data", () => {
  it("returns a proof that encrypted bytes match the expected dataHash", async () => {
    const storage = createMemoryStorage();
    const bytes = new TextEncoder().encode("encrypted worldview bytes");
    const uploaded = await storage.upload(bytes);
    const dataHash = await sha256Hex(bytes);

    const response = await createPrivateDataProofResponse(
      new Request("http://localhost/api/proof/private-data", {
        method: "POST",
        body: JSON.stringify({
          privateUri: uploaded.uri,
          dataHash,
        }),
      }),
      { storage }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      privateUri: string;
      expectedDataHash: string;
      actualDataHash: string;
      matches: boolean;
      byteLength: number;
    };

    expect(body.matches).toBe(true);
    expect(body.privateUri).toBe(uploaded.uri);
    expect(body.expectedDataHash).toBe(`0x${dataHash}`);
    expect(body.actualDataHash).toBe(`0x${dataHash}`);
    expect(body.byteLength).toBe(bytes.length);
  });

  it("rejects invalid requests", async () => {
    const response = await createPrivateDataProofResponse(
      new Request("http://localhost/api/proof/private-data", {
        method: "POST",
        body: JSON.stringify({ privateUri: "", dataHash: "nope" }),
      }),
      { storage: createMemoryStorage() }
    );

    expect(response.status).toBe(400);
  });
});
