import { describe, expect, it } from "vitest";
import { selectStorageAdapter } from "../runtime";
import { createRuntimeStorage } from "../runtime";

describe("runtime storage configuration", () => {
  it("defaults to memory outside production and 0g in production", () => {
    expect(selectStorageAdapter({ NODE_ENV: "development" })).toBe("memory");
    expect(selectStorageAdapter({ NODE_ENV: "test" })).toBe("memory");
    expect(selectStorageAdapter({ NODE_ENV: "production" })).toBe("0g");
  });

  it("honors explicit storage adapter selection", () => {
    expect(
      selectStorageAdapter({ NODE_ENV: "production", STORAGE_ADAPTER: "memory" })
    ).toBe("memory");
    expect(
      selectStorageAdapter({ NODE_ENV: "test", STORAGE_ADAPTER: "0g" })
    ).toBe("0g");
  });

  it("reuses the shared in-memory storage across runtime calls", async () => {
    const first = createRuntimeStorage({
      NODE_ENV: "development",
      STORAGE_ADAPTER: "memory",
    });
    const second = createRuntimeStorage({
      NODE_ENV: "development",
      STORAGE_ADAPTER: "memory",
    });

    const uploaded = await first.upload(new TextEncoder().encode("shared"));
    await expect(second.fetch(uploaded.uri)).resolves.toBeInstanceOf(
      Uint8Array
    );
  });
});
