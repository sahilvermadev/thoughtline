export interface UploadResult {
  uri: string;
  providerHash?: string;
}

export interface StorageProvider {
  upload(bytes: Uint8Array): Promise<UploadResult>;
  fetch(uri: string): Promise<Uint8Array>;
}
