import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";
import { canUseCapability } from "../authorization/access";
import {
  converseWithAgent,
  type AgentConversationMessage,
} from "../agent-conversation";

export interface AgentAccessRecord {
  ownerAddress: string;
  authorizedUsers: string[];
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
}

export interface AgentAccessReader {
  getAgentAccess(tokenId: string): Promise<AgentAccessRecord>;
}

export interface AuthorizedRuntimeInput {
  tokenId: string;
  callerAddress: string;
  messages: AgentConversationMessage[];
  skillId?: string;
}

export interface AuthorizedRuntimeResponse {
  message: AgentConversationMessage & { role: "assistant" };
  usedSkillId: string | null;
}

export interface AuthorizedAgentRuntime {
  ask(input: AuthorizedRuntimeInput): Promise<AuthorizedRuntimeResponse>;
  invoke(input: {
    tokenId: string;
    callerAddress: string;
    skillId: string;
    input: string;
  }): Promise<{ response: string }>;
}

export interface AuthorizedAgentRuntimeDeps {
  accessReader: AgentAccessReader;
  llm: LLMProvider;
}

export function createAuthorizedAgentRuntime(
  deps: AuthorizedAgentRuntimeDeps
): AuthorizedAgentRuntime {
  async function ask(
    input: AuthorizedRuntimeInput
  ): Promise<AuthorizedRuntimeResponse> {
    const access = await deps.accessReader.getAgentAccess(input.tokenId);

    if (!canInvoke(input.callerAddress, access)) {
      throw new Error("Caller is not authorized to invoke this agent");
    }

    const result = await converseWithAgent(
      {
        privateWorldview: access.privateWorldview,
        publicProfile: access.publicProfile,
        messages: input.messages,
        skillId: input.skillId,
      },
      deps.llm
    );

    const isOwner =
      input.callerAddress.toLowerCase() === access.ownerAddress.toLowerCase();
    return isOwner
      ? result
      : filterAuthorizedResponse(result, access.privateWorldview);
  }

  return {
    ask,

    async invoke(input) {
      const result = await ask({
        tokenId: input.tokenId,
        callerAddress: input.callerAddress,
        messages: [{ role: "user", content: input.input }],
        skillId: input.skillId,
      });
      return { response: result.message.content };
    },
  };
}

export function canInvoke(
  callerAddress: string,
  access: Pick<AgentAccessRecord, "ownerAddress" | "authorizedUsers">
): boolean {
  return canUseCapability({
    capability: "usage",
    callerAddress,
    tokenId: "unknown",
    access: {
      ownerAddress: access.ownerAddress,
      authorizedAddresses: access.authorizedUsers,
    },
  });
}

function filterAuthorizedResponse(
  response: AuthorizedRuntimeResponse,
  privateWorldview: PrivateWorldview
): AuthorizedRuntimeResponse {
  const privateSnippets = [
    ...privateWorldview.values,
    ...privateWorldview.heuristics,
    ...privateWorldview.blindspots,
    privateWorldview.decisionStyle,
    privateWorldview.freeform,
  ]
    .map(normalize)
    .filter((snippet) => snippet.length >= 12);
  const normalizedResponse = normalize(response.message.content);

  if (
    privateSnippets.some((snippet) =>
      normalizedResponse.includes(snippet.slice(0, 120))
    )
  ) {
    return {
      ...response,
      message: {
        ...response.message,
        content:
          "I can use this agent's private worldview to answer, but I cannot reveal its raw private fields.",
      },
    };
  }

  return response;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
