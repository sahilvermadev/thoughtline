import { createRuntimeStorage } from "../storage/runtime";
import { createChainPublicAgentSource } from "./public-agents-source";
import type { PublicAgentSource } from "./public-agents";
import { loadPublicAgentFeedResult } from "./public-feed";

export interface PublicAgentsResponseDeps {
  storage?: ReturnType<typeof createRuntimeStorage>;
  source?: PublicAgentSource;
}

export async function createPublicAgentsResponse(
  deps: PublicAgentsResponseDeps = {}
): Promise<Response> {
  try {
    const storage = deps.storage ?? createRuntimeStorage();
    const source = deps.source ?? createChainPublicAgentSource();
    const result = await loadPublicAgentFeedResult({ storage, source });

    return Response.json(result.agents, {
      headers: {
        "X-ThoughtLine-Gallery-Failures": JSON.stringify(result.failures),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
