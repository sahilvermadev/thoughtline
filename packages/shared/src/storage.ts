import type { AgentMetadata } from "./schema.js";

export interface StorageProvider {
  upload(metadata: AgentMetadata): Promise<string>;
  fetch(uri: string): Promise<AgentMetadata>;
}
