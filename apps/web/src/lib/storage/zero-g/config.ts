const DEFAULT_RPC_URL = "https://evmrpc-testnet.0g.ai";
const DEFAULT_STORAGE_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";

export interface ZeroGStorageConfig {
  rpcUrl: string;
  storageIndexer: string;
  privateKey: string;
}

export function readZeroGStorageConfig(
  env: Record<string, string | undefined> = process.env
): ZeroGStorageConfig {
  const privateKey = firstNonEmpty(env.OG_PRIVATE_KEY, env.PRIVATE_KEY);
  const rpcUrl = firstNonEmpty(env.OG_RPC_URL, env.RPC_URL) ?? DEFAULT_RPC_URL;
  const storageIndexer =
    firstNonEmpty(
      env.OG_STORAGE_INDEXER,
      env.OG_STORAGE_ENDPOINT,
      env.STORAGE_INDEXER
    ) ?? DEFAULT_STORAGE_INDEXER;

  if (!privateKey) {
    throw new Error("Missing OG_PRIVATE_KEY or PRIVATE_KEY for 0G Storage");
  }

  return { rpcUrl, storageIndexer, privateKey };
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "");
}
