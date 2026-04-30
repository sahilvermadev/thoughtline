import type { StorageProvider } from "@thoughtline/shared";
import { createStorage } from "./index";
import { createMemoryStorage } from "./memory";

export type StorageAdapterName = "memory" | "0g";

export interface StorageRuntimeEnv {
  STORAGE_ADAPTER?: string;
  NODE_ENV?: string;
}

let sharedMemoryStorage: StorageProvider | null = null;

export function selectStorageAdapter(
  env: StorageRuntimeEnv = process.env
): StorageAdapterName {
  if (env.STORAGE_ADAPTER === "memory") return "memory";
  if (env.STORAGE_ADAPTER === "0g") return "0g";
  return env.NODE_ENV === "production" ? "0g" : "memory";
}

export function createRuntimeStorage(
  env: StorageRuntimeEnv = process.env
): StorageProvider {
  const adapter = selectStorageAdapter(env);
  if (adapter === "memory") {
    sharedMemoryStorage ??= createMemoryStorage();
    return sharedMemoryStorage;
  }

  return createStorage(adapter);
}
