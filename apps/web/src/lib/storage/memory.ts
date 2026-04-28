import type { StorageProvider } from "@thoughtline/shared";
import type { AgentMetadata } from "@thoughtline/shared";
import { randomUUID } from "crypto";

export function createMemoryStorage(): StorageProvider {
  const store = new Map<string, AgentMetadata>();

  return {
    async upload(metadata) {
      const uri = `memory://${randomUUID()}`;
      store.set(uri, structuredClone(metadata));
      return uri;
    },

    async fetch(uri) {
      const data = store.get(uri);
      if (!data) {
        throw new Error(`Storage object not found: ${uri}`);
      }
      return structuredClone(data);
    },
  };
}
