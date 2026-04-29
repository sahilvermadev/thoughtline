export type EncryptionKey = Uint8Array;

export interface CryptoProvider {
  encrypt(plaintext: Uint8Array, key: EncryptionKey): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array, key: EncryptionKey): Promise<Uint8Array>;
  sha256Hex(bytes: Uint8Array): Promise<string>;
}

const AES_IV_LENGTH = 12;
const AES_KEY_LENGTH = 32;

export function createWebCryptoProvider(): CryptoProvider {
  return {
    async encrypt(plaintext, key) {
      const cryptoKey = await importAesKey(key);
      const iv = globalThis.crypto.getRandomValues(
        new Uint8Array(AES_IV_LENGTH)
      );
      const encrypted = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        toArrayBuffer(plaintext)
      );
      const ciphertext = new Uint8Array(encrypted);
      const packaged = new Uint8Array(iv.length + ciphertext.length);
      packaged.set(iv, 0);
      packaged.set(ciphertext, iv.length);
      return packaged;
    },

    async decrypt(ciphertext, key) {
      if (ciphertext.length <= AES_IV_LENGTH) {
        throw new Error("Ciphertext is too short");
      }

      const cryptoKey = await importAesKey(key);
      const iv = ciphertext.slice(0, AES_IV_LENGTH);
      const encrypted = ciphertext.slice(AES_IV_LENGTH);
      const plaintext = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        encrypted
      );
      return new Uint8Array(plaintext);
    },

    sha256Hex,
  };
}

export async function deriveKeyFromSignature(
  signature: string
): Promise<EncryptionKey> {
  return sha256Bytes(new TextEncoder().encode(signature));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await sha256Bytes(bytes);
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(bytes)
  );
  return new Uint8Array(digest);
}

async function importAesKey(key: EncryptionKey): Promise<CryptoKey> {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error("AES-GCM key must be 32 bytes");
  }

  return globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}
