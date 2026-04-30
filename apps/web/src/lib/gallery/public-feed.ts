import type { StorageProvider } from "@thoughtline/shared";
import type { PrivateDataHashProof } from "../proof/private-data";
import {
  loadPublicAgents,
  loadPublicAgentsResult,
  serializePublicAgents,
  type PublicAgentHydrationFailure,
  type PublicAgentSource,
  type PublicAgentView,
} from "./public-agents";

export interface PublicAgentFeedDeps {
  storage: StorageProvider;
  source: PublicAgentSource;
}

export async function loadPublicAgentFeed(
  deps: PublicAgentFeedDeps
): Promise<PublicAgentView[]> {
  return serializePublicAgents(await loadPublicAgents(deps));
}

export interface PublicAgentFeedResult {
  agents: PublicAgentView[];
  failures: PublicAgentHydrationFailure[];
}

export async function loadPublicAgentFeedResult(
  deps: PublicAgentFeedDeps
): Promise<PublicAgentFeedResult> {
  const result = await loadPublicAgentsResult(deps);
  return {
    agents: serializePublicAgents(result.agents),
    failures: result.failures,
  };
}

export function filterPublicAgentFeed(
  agents: PublicAgentView[],
  search: string
): PublicAgentView[] {
  const query = search.trim().toLowerCase();
  if (!query) return agents;
  return agents.filter((agent) =>
    getPublicAgentSearchText(agent).includes(query)
  );
}

export function getPublicAgentLineage(agent: PublicAgentView): string {
  return agent.publicProfile.parentIds === null
    ? "Genesis"
    : `Parents ${agent.publicProfile.parentIds[0]} + ${agent.publicProfile.parentIds[1]}`;
}

export function createPrivateDataProofRequest(agent: PublicAgentView) {
  return {
    privateUri: agent.privateUri,
    dataHash: agent.dataHash,
  };
}

export type PublicAgentProofState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; proof: PrivateDataHashProof }
  | { status: "error"; error: string };

function getPublicAgentSearchText(agent: PublicAgentView): string {
  return [
    agent.tokenId,
    agent.owner,
    agent.dataHash,
    agent.publicUri,
    agent.privateUri,
    agent.publicProfile.name,
    agent.publicProfile.description,
    ...agent.publicProfile.skills.map((skill) =>
      [skill.name, skill.description, skill.skillMarkdown, skill.id].join(" ")
    ),
  ]
    .join(" ")
    .toLowerCase();
}
