import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
} from "@thoughtline/shared";
import { buildSkillInvocationMessages } from "../skills/invoke.js";

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
  skillId: string;
  input: string;
}

export interface AuthorizedRuntimeResponse {
  response: string;
}

export interface AuthorizedAgentRuntime {
  invoke(input: AuthorizedRuntimeInput): Promise<AuthorizedRuntimeResponse>;
}

export interface AuthorizedAgentRuntimeDeps {
  accessReader: AgentAccessReader;
  llm: LLMProvider;
}

export function createAuthorizedAgentRuntime(
  deps: AuthorizedAgentRuntimeDeps
): AuthorizedAgentRuntime {
  return {
    async invoke(input) {
      const access = await deps.accessReader.getAgentAccess(input.tokenId);

      if (!canInvoke(input.callerAddress, access)) {
        throw new Error("Caller is not authorized to invoke this agent");
      }

      const messages = buildSkillInvocationMessages({
        privateWorldview: access.privateWorldview,
        publicProfile: access.publicProfile,
        skillId: input.skillId,
        input: input.input,
      });
      const response = await deps.llm.chat(messages);

      return { response: response.content };
    },
  };
}

export function canInvoke(
  callerAddress: string,
  access: Pick<AgentAccessRecord, "ownerAddress" | "authorizedUsers">
): boolean {
  const caller = normalizeAddress(callerAddress);
  return (
    caller === normalizeAddress(access.ownerAddress) ||
    access.authorizedUsers.some((user) => normalizeAddress(user) === caller)
  );
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}
