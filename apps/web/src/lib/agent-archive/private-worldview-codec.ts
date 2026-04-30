import type { PrivateWorldview } from "@thoughtline/shared";
import { privateWorldviewSchema } from "@thoughtline/shared";
import type { CryptoProvider, EncryptionKey } from "../crypto/index";
import {
  base64ToBytes,
  bytesToBase64,
  parseJwk,
  unwrapDataKeyForOwner,
  unwrapDataKeyForRuntime,
  wrapDataKeyForOwner,
  wrapDataKeyForRuntime,
  type OwnerWrappedDataKey,
  type RuntimeWrappedDataKey,
} from "./key-wrap";

export interface PrivateWorldviewCodec {
  encryptForStorage(
    worldview: PrivateWorldview,
    ownerUnlockKey: EncryptionKey
  ): Promise<Uint8Array>;
  decryptForOwner(
    bytes: Uint8Array,
    ownerUnlockKey: EncryptionKey
  ): Promise<PrivateWorldview>;
  decryptForRuntime(bytes: Uint8Array): Promise<PrivateWorldview>;
}

export interface PrivateWorldviewCodecOptions {
  runtimePublicKeyJwk?: JsonWebKey;
  runtimePrivateKeyJwk?: JsonWebKey;
}

interface PrivateWorldviewEnvelopeV2 {
  version: 2;
  algorithm: "AES-GCM";
  ciphertext: string;
  wrappedKeys: {
    owner: OwnerWrappedDataKey;
    runtime: RuntimeWrappedDataKey;
  };
}

export const AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR =
  "Authorized runtime requires a V2 private worldview envelope";

export function createPrivateWorldviewCodec(
  crypto: CryptoProvider,
  options: PrivateWorldviewCodecOptions = runtimeOptionsFromEnv()
): PrivateWorldviewCodec {
  return {
    async encryptForStorage(worldview, ownerUnlockKey) {
      const plaintext = encodeJson(worldview);
      if (!options.runtimePublicKeyJwk) {
        return crypto.encrypt(plaintext, ownerUnlockKey);
      }

      const dataKey = randomDataKey();
      const ciphertext = await crypto.encrypt(plaintext, dataKey);
      const envelope: PrivateWorldviewEnvelopeV2 = {
        version: 2,
        algorithm: "AES-GCM",
        ciphertext: bytesToBase64(ciphertext),
        wrappedKeys: {
          owner: await wrapDataKeyForOwner(dataKey, ownerUnlockKey, crypto),
          runtime: await wrapDataKeyForRuntime(
            dataKey,
            options.runtimePublicKeyJwk
          ),
        },
      };

      return encodeJson(envelope);
    },

    async decryptForOwner(bytes, ownerUnlockKey) {
      const envelope = tryDecodeEnvelopeV2(bytes);
      const plaintext = envelope
        ? await decryptEnvelopeForOwner(envelope, ownerUnlockKey, crypto)
        : await crypto.decrypt(bytes, ownerUnlockKey);
      return privateWorldviewSchema.parse(decodeJson(plaintext));
    },

    async decryptForRuntime(bytes) {
      const envelope = tryDecodeEnvelopeV2(bytes);
      if (!envelope) {
        throw new Error(AUTHORIZED_RUNTIME_REQUIRES_V2_ENVELOPE_ERROR);
      }

      const runtimePrivateKeyJwk =
        options.runtimePrivateKeyJwk ??
        runtimePrivateKeyFromEnv(readEnv("AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK"));
      const dataKey = await unwrapDataKeyForRuntime(
        envelope.wrappedKeys.runtime,
        runtimePrivateKeyJwk
      );
      const plaintext = await crypto.decrypt(
        base64ToBytes(envelope.ciphertext),
        dataKey
      );
      return privateWorldviewSchema.parse(decodeJson(plaintext));
    },
  };
}

async function decryptEnvelopeForOwner(
  envelope: PrivateWorldviewEnvelopeV2,
  ownerUnlockKey: EncryptionKey,
  crypto: CryptoProvider
): Promise<Uint8Array> {
  const dataKey = await unwrapDataKeyForOwner(
    envelope.wrappedKeys.owner,
    ownerUnlockKey,
    crypto
  );
  return crypto.decrypt(base64ToBytes(envelope.ciphertext), dataKey);
}

function tryDecodeEnvelopeV2(bytes: Uint8Array): PrivateWorldviewEnvelopeV2 | null {
  try {
    const decoded = decodeJson(bytes) as Partial<PrivateWorldviewEnvelopeV2>;
    if (decoded.version !== 2) return null;
    if (
      decoded.algorithm !== "AES-GCM" ||
      typeof decoded.ciphertext !== "string" ||
      decoded.wrappedKeys?.owner?.alg !== "AES-GCM" ||
      typeof decoded.wrappedKeys.owner.ciphertext !== "string" ||
      decoded.wrappedKeys?.runtime?.alg !== "RSA-OAEP-256" ||
      typeof decoded.wrappedKeys.runtime.ciphertext !== "string"
    ) {
      throw new Error("Invalid V2 private worldview envelope");
    }
    return decoded as PrivateWorldviewEnvelopeV2;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message.includes("JSON"))
    ) {
      return null;
    }
    throw error;
  }
}

function randomDataKey(): EncryptionKey {
  const key = new Uint8Array(32);
  globalThis.crypto.getRandomValues(key);
  return key;
}

function runtimeOptionsFromEnv(): PrivateWorldviewCodecOptions {
  return {
    runtimePublicKeyJwk: readEnv("AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK")
      ? parseJwk(
          readEnv("AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK")!,
          "AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK"
        )
      : undefined,
    runtimePrivateKeyJwk: readEnv("AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK")
      ? runtimePrivateKeyFromEnv(readEnv("AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK"))
      : undefined,
  };
}

function runtimePrivateKeyFromEnv(value: string | undefined): JsonWebKey {
  if (!value) {
    throw new Error(
      "Missing required environment variable: AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK"
    );
  }
  return parseJwk(value, "AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK");
}

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return (process.env as Record<string, string | undefined>)[name];
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
