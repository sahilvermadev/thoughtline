import { describe, expect, it, vi } from "vitest";
import { createBrowserReadableStorage } from "../browser";

describe("browser readable storage", () => {
  it("fetches public storage bytes through the storage object route", async () => {
    const bytes = new TextEncoder().encode("ciphertext bytes");
    const fetchObject = vi.fn(async () =>
      Response.json({
        uri: "0g://object",
        bytesBase64: Buffer.from(bytes).toString("base64"),
      })
    );

    const storage = createBrowserReadableStorage(fetchObject);

    await expect(storage.fetch("0g://object")).resolves.toEqual(bytes);
    expect(fetchObject).toHaveBeenCalledWith(
      "/api/storage/object?uri=0g%3A%2F%2Fobject"
    );
  });

  it("does not support browser uploads", async () => {
    const storage = createBrowserReadableStorage();

    await expect(storage.upload(new Uint8Array([1]))).rejects.toThrow(
      "Browser storage uploads are not supported here."
    );
  });
});
