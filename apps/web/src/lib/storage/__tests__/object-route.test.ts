import { describe, expect, it } from "vitest";
import { createStorageObjectResponse } from "../object-route";

describe("storage object response", () => {
  it("returns storage bytes as base64 without interpreting private data", async () => {
    const ciphertext = new TextEncoder().encode(
      JSON.stringify({
        values: ["this must stay encrypted to callers"],
      })
    );

    const response = await createStorageObjectResponse(
      new Request("http://localhost/api/storage/object?uri=memory%3A%2F%2Fblob"),
      {
        storage: {
          async upload() {
            throw new Error("unused");
          },
          async fetch(uri) {
            expect(uri).toBe("memory://blob");
            return ciphertext;
          },
        },
      }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      uri: "memory://blob",
      bytesBase64: Buffer.from(ciphertext).toString("base64"),
    });
    expect(JSON.stringify(body)).not.toContain("values");
    expect(JSON.stringify(body)).not.toContain("this must stay encrypted");
  });

  it("rejects missing uri", async () => {
    const response = await createStorageObjectResponse(
      new Request("http://localhost/api/storage/object")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});
