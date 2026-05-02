import type { StorageProvider } from "@thoughtline/shared";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  readZeroGStorageConfig,
  type ZeroGStorageConfig,
} from "./zero-g/config";
import { uploadWithCurrentFlowAbi } from "./zero-g/flow-upload";
import { parseZeroGUri, rootHashToUri } from "./zero-g/uri";

export type { ZeroGStorageConfig } from "./zero-g/config";
export { readZeroGStorageConfig } from "./zero-g/config";
export { parseZeroGUri, rootHashToUri } from "./zero-g/uri";

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
        const [, uploadErr] = await uploadWithCurrentFlowAbi(
          indexer,
          file,
          config.rpcUrl,
          wallet
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

function formatSdkError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
