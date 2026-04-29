import type { StorageProvider } from "@thoughtline/shared";
import { createHash, randomUUID } from "crypto";

export function createMemoryStorage(): StorageProvider {
  const store = new Map<string, Uint8Array>();

  return {
    async upload(bytes) {
      const uri = `memory://${randomUUID()}`;
      store.set(uri, new Uint8Array(bytes));
      const providerHash = createHash("sha256").update(bytes).digest("hex");
      return { uri, providerHash };
    },

    async fetch(uri) {
      const data = store.get(uri);
      if (!data) {
        throw new Error(`Storage object not found: ${uri}`);
      }
      return new Uint8Array(data);
    },
  };
}
