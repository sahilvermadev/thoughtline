import type { StorageProvider } from "@thoughtline/shared";
import { createMemoryStorage } from "./memory.js";

export function createStorage(adapter: "memory" | "0g"): StorageProvider {
  switch (adapter) {
    case "memory":
      return createMemoryStorage();
    case "0g":
      throw new Error("0G Storage adapter not yet implemented");
    default:
      throw new Error(`Unknown storage adapter: ${adapter}`);
  }
}
