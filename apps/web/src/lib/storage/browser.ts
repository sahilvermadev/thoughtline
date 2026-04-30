import type { StorageProvider } from "@thoughtline/shared";

export type FetchStorageObject = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export function createBrowserReadableStorage(
  fetchObject: FetchStorageObject = fetch
): StorageProvider {
  return {
    async upload() {
      throw new Error("Browser storage uploads are not supported here.");
    },
    async fetch(uri) {
      const response = await fetchObject(
        `/api/storage/object?uri=${encodeURIComponent(uri)}`
      );
      const body = (await response.json()) as {
        bytesBase64?: string;
        error?: string;
      };

      if (!response.ok || !body.bytesBase64) {
        throw new Error(body.error ?? "Failed to fetch storage object");
      }

      return base64ToBytes(body.bytesBase64);
    },
  };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
