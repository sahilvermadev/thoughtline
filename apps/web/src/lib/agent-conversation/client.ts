import type { PrivateWorldview } from "@thoughtline/shared";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import type {
  AgentConversationMessage,
  ConverseWithAgentResponse,
} from "@/lib/agent-conversation";

export interface SendAgentMessageInput {
  agent: PublicAgentView;
  privateWorldview: PrivateWorldview;
  messages: AgentConversationMessage[];
  skillId?: string;
}

export interface SendAuthorizedAgentMessageInput {
  tokenId: string;
  callerAddress: string;
  messages: AgentConversationMessage[];
  skillId?: string;
}

export async function sendAgentConversationMessage(
  input: SendAgentMessageInput
): Promise<ConverseWithAgentResponse> {
  const response = await fetch("/api/converse-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      privateWorldview: input.privateWorldview,
      publicProfile: input.agent.publicProfile,
      messages: input.messages,
      skillId: input.skillId,
    }),
  });

  const body = (await response.json()) as
    | ConverseWithAgentResponse
    | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? body.error : "Agent conversation failed");
  }

  if (!("message" in body)) {
    throw new Error("Agent conversation returned no message");
  }

  return body;
}

export async function sendAuthorizedAgentConversationMessage(
  input: SendAuthorizedAgentMessageInput
): Promise<ConverseWithAgentResponse> {
  const response = await fetch(`/api/agents/${input.tokenId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callerAddress: input.callerAddress,
      messages: input.messages,
      skillId: input.skillId,
    }),
  });

  const body = (await response.json()) as
    | ConverseWithAgentResponse
    | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? body.error : "Authorized ask failed");
  }

  if (!("message" in body)) {
    throw new Error("Authorized ask returned no message");
  }

  return body;
}
