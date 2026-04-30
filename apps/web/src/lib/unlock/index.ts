import { deriveKeyFromSignature, type EncryptionKey } from "../crypto";

export type UnlockScope = "genesis" | "agent-token" | "breeding-child";
export type UnlockPurpose = "genesis" | "agent";

export interface UnlockMessageInput {
  purpose?: UnlockPurpose;
  scope?: UnlockScope;
  ownerAddress: string;
  agentName?: string;
  tokenId?: string;
}

export function buildUnlockMessage(input: UnlockMessageInput): string {
  const scope = normalizeUnlockScope(input);
  if (scope === "agent-token" && !input.tokenId) {
    throw new Error("Token ID is required for agent unlock messages");
  }
  if (scope === "genesis" && !input.agentName) {
    throw new Error("Agent name is required for genesis unlock messages");
  }
  if (scope === "breeding-child" && !input.agentName) {
    throw new Error("Child agent name is required for breeding unlock messages");
  }

  const subject = buildUnlockSubject(scope, input);

  return [
    "ThoughtLine private worldview unlock",
    `Scope: ${scope}`,
    `Owner: ${input.ownerAddress}`,
    subject,
  ].join("\n");
}

export async function deriveUnlockKey(
  signature: string
): Promise<EncryptionKey> {
  return deriveKeyFromSignature(signature);
}

function normalizeUnlockScope(input: UnlockMessageInput): UnlockScope {
  if (input.scope) return input.scope;
  if (input.purpose === "agent") return "agent-token";
  return "genesis";
}

function buildUnlockSubject(
  scope: UnlockScope,
  input: UnlockMessageInput
): string {
  switch (scope) {
    case "agent-token":
      return `Token ID: ${input.tokenId}`;
    case "breeding-child":
      return `Child agent: ${input.agentName}`;
    case "genesis":
      return `Agent: ${input.agentName}`;
  }
}
