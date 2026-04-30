import type { CryptoProvider, EncryptionKey } from "../crypto/index";

export interface OwnerWrappedDataKey {
  alg: "AES-GCM";
  ciphertext: string;
}

export interface RuntimeWrappedDataKey {
  alg: "RSA-OAEP-256";
  ciphertext: string;
}

export async function wrapDataKeyForOwner(
  dataKey: EncryptionKey,
  ownerUnlockKey: EncryptionKey,
  crypto: CryptoProvider
): Promise<OwnerWrappedDataKey> {
  return {
    alg: "AES-GCM",
    ciphertext: bytesToBase64(await crypto.encrypt(dataKey, ownerUnlockKey)),
  };
}

export async function unwrapDataKeyForOwner(
  wrapped: OwnerWrappedDataKey,
  ownerUnlockKey: EncryptionKey,
  crypto: CryptoProvider
): Promise<EncryptionKey> {
  return crypto.decrypt(base64ToBytes(wrapped.ciphertext), ownerUnlockKey);
}

export async function wrapDataKeyForRuntime(
  dataKey: EncryptionKey,
  publicKeyJwk: JsonWebKey
): Promise<RuntimeWrappedDataKey> {
  const publicKey = await globalThis.crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    toArrayBuffer(dataKey)
  );

  return {
    alg: "RSA-OAEP-256",
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function unwrapDataKeyForRuntime(
  wrapped: RuntimeWrappedDataKey,
  privateKeyJwk: JsonWebKey
): Promise<EncryptionKey> {
  const privateKey = await globalThis.crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    toArrayBuffer(base64ToBytes(wrapped.ciphertext))
  );

  return new Uint8Array(decrypted);
}

export function parseJwk(value: string, name: string): JsonWebKey {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("JWK must be a JSON object");
    }
    return parsed as JsonWebKey;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${name}: ${detail}`);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (typeof btoa === "function") return btoa(binary);
  return getBuffer().from(bytes).toString("base64");
}

export function base64ToBytes(value: string): Uint8Array {
  const binary =
    typeof atob === "function"
      ? atob(value)
      : getBuffer().from(value, "base64").toString("binary");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getBuffer(): {
  from(value: Uint8Array | string, encoding?: "base64"): { toString(encoding: "base64" | "binary"): string };
} {
  const maybeBuffer = (globalThis as unknown as {
    Buffer?: {
      from(
        value: Uint8Array | string,
        encoding?: "base64"
      ): { toString(encoding: "base64" | "binary"): string };
    };
  }).Buffer;
  if (!maybeBuffer) throw new Error("No base64 encoder is available");
  return maybeBuffer;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}
