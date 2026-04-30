import type { StorageProvider } from "@thoughtline/shared";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_RPC_URL = "https://evmrpc-testnet.0g.ai";
const DEFAULT_STORAGE_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";

export interface ZeroGStorageConfig {
  rpcUrl: string;
  storageIndexer: string;
  privateKey: string;
}

export function createZeroGStorage(
  config: ZeroGStorageConfig = readZeroGStorageConfig()
): StorageProvider {
  return {
    async upload(bytes) {
      if (bytes.length === 0) {
        throw new Error("Cannot upload empty bytes to 0G Storage");
      }

      const tempDir = await mkdtemp(join(tmpdir(), "thoughtline-0g-upload-"));
      const tempPath = join(tempDir, `${randomUUID()}.bin`);
      await writeFile(tempPath, bytes);

      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(config.privateKey, provider);
      const indexer = new Indexer(config.storageIndexer);
      const file = await ZgFile.fromFilePath(tempPath);

      try {
        const [tree, treeErr] = await file.merkleTree();
        if (treeErr) {
          throw new Error(`0G merkle tree error: ${formatSdkError(treeErr)}`);
        }
        if (!tree) {
          throw new Error("0G merkle tree generation returned no tree");
        }

        const rootHash = tree.rootHash();
        if (!rootHash) {
          throw new Error("0G merkle tree returned no root hash");
        }
        const [, uploadErr] = await indexer.upload(
          file,
          config.rpcUrl,
          wallet as never
        );
        if (uploadErr) {
          throw new Error(`0G upload failed: ${formatSdkError(uploadErr)}`);
        }

        return { uri: rootHashToUri(rootHash), providerHash: rootHash };
      } finally {
        await file.close();
        await rm(tempDir, { recursive: true, force: true });
      }
    },

    async fetch(uri) {
      const rootHash = parseZeroGUri(uri);
      const tempDir = await mkdtemp(join(tmpdir(), "thoughtline-0g-download-"));
      const tempPath = join(tempDir, `${randomUUID()}.bin`);
      const indexer = new Indexer(config.storageIndexer);

      try {
        const err = await indexer.download(rootHash, tempPath, true);
        if (err) {
          throw new Error(`0G download failed: ${formatSdkError(err)}`);
        }
        return new Uint8Array(await readFile(tempPath));
      } catch (error) {
        throw new Error(`0G download failed: ${formatSdkError(error)}`);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

export function parseZeroGUri(uri: string): string {
  const match = /^0g:\/\/(0x[0-9a-fA-F]{64})$/.exec(uri);
  if (!match) {
    throw new Error(`Invalid 0G Storage URI: ${uri}`);
  }
  return match[1];
}

export function rootHashToUri(rootHash: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) {
    throw new Error(`Invalid 0G root hash: ${rootHash}`);
  }
  return `0g://${rootHash}`;
}

export function readZeroGStorageConfig(
  env: Record<string, string | undefined> = process.env
): ZeroGStorageConfig {
  const privateKey = env.OG_PRIVATE_KEY ?? env.PRIVATE_KEY;
  const rpcUrl = env.OG_RPC_URL ?? env.RPC_URL ?? DEFAULT_RPC_URL;
  const storageIndexer =
    env.OG_STORAGE_INDEXER ??
    env.OG_STORAGE_ENDPOINT ??
    env.STORAGE_INDEXER ??
    DEFAULT_STORAGE_INDEXER;

  if (!privateKey) {
    throw new Error("Missing OG_PRIVATE_KEY or PRIVATE_KEY for 0G Storage");
  }

  return { rpcUrl, storageIndexer, privateKey };
}

function formatSdkError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
