import type {
  AgentMetadata,
  PrivateWorldview,
  PublicProfile,
  StorageProvider,
} from "@thoughtline/shared";
import { publicProfileSchema } from "@thoughtline/shared";
import type { CryptoProvider, EncryptionKey } from "../crypto/index";
import { createWebCryptoProvider } from "../crypto/index";
import {
  AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR,
  createPrivateWorldviewCodec,
} from "./private-worldview-codec";

export interface StoredAgent {
  publicUri: string;
  publicHash: string;
  privateUri: string;
  dataHash: string;
}

export interface AgentArchive {
  storePublic(profile: PublicProfile): Promise<{ uri: string; hash: string }>;
  loadPublic(uri: string): Promise<PublicProfile>;
  storePrivate(
    worldview: PrivateWorldview,
    encryptionKey: EncryptionKey
  ): Promise<{ uri: string; dataHash: string }>;
  loadPrivate(
    uri: string,
    encryptionKey: EncryptionKey
  ): Promise<PrivateWorldview>;
  loadPrivateForRuntime(uri: string): Promise<PrivateWorldview>;
  store(metadata: AgentMetadata, encryptionKey: EncryptionKey): Promise<StoredAgent>;
  load(
    publicUri: string,
    privateUri: string,
    encryptionKey: EncryptionKey
  ): Promise<AgentMetadata>;
}

export interface AgentArchiveOptions {
  runtimePublicKeyJwk?: JsonWebKey;
  runtimePrivateKeyJwk?: JsonWebKey;
}

export { AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR };

export function createAgentArchive(
  storage: StorageProvider,
  crypto: CryptoProvider = createWebCryptoProvider(),
  options?: AgentArchiveOptions
): AgentArchive {
  const privateWorldviewCodec = createPrivateWorldviewCodec(
    crypto,
    options
  );

  return {
    async storePublic(profile) {
      const bytes = encodeJson(profile);
      const hash = await crypto.sha256Hex(bytes);
      const { uri } = await storage.upload(bytes);
      return { uri, hash };
    },

    async loadPublic(uri) {
      const bytes = await storage.fetch(uri);
      return publicProfileSchema.parse(decodeJson(bytes));
    },

    async storePrivate(worldview, encryptionKey) {
      const bytes = await privateWorldviewCodec.encryptForStorage(
        worldview,
        encryptionKey
      );
      const dataHash = await crypto.sha256Hex(bytes);
      const { uri } = await storage.upload(bytes);
      return { uri, dataHash };
    },

    async loadPrivate(uri, encryptionKey) {
      return privateWorldviewCodec.decryptForOwner(
        await storage.fetch(uri),
        encryptionKey
      );
    },

    async loadPrivateForRuntime(uri) {
      return privateWorldviewCodec.decryptForRuntime(await storage.fetch(uri));
    },

    async store(metadata, encryptionKey) {
      const publicStored = await this.storePublic(metadata.publicProfile);
      const privateStored = await this.storePrivate(
        metadata.privateWorldview,
        encryptionKey
      );
      return {
        publicUri: publicStored.uri,
        publicHash: publicStored.hash,
        privateUri: privateStored.uri,
        dataHash: privateStored.dataHash,
      };
    },

    async load(publicUri, privateUri, encryptionKey) {
      const [publicProfile, privateWorldview] = await Promise.all([
        this.loadPublic(publicUri),
        this.loadPrivate(privateUri, encryptionKey),
      ]);
      return { publicProfile, privateWorldview };
    },
  };
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
