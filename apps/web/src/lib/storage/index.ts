import type { StorageProvider } from "@thoughtline/shared";
import { createMemoryStorage } from "./memory";
import { createZeroGStorage } from "./zero-g";

export function createStorage(adapter: "memory" | "0g"): StorageProvider {
  switch (adapter) {
    case "memory":
      return createMemoryStorage();
    case "0g":
      return createZeroGStorage();
    default:
      throw new Error(`Unknown storage adapter: ${adapter}`);
  }
}
