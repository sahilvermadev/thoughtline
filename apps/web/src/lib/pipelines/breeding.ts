import type { LLMProvider } from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index.js";
import type { BreedingInput } from "../breeding/create-from-breeding.js";
import { createAgentFromBreeding } from "../breeding/create-from-breeding.js";
import { emit, type EmitPipelineEvent } from "./events.js";

export interface RunBreedingPipelineDeps {
  llm: LLMProvider;
  archive: AgentArchive;
  emit?: EmitPipelineEvent;
}

export async function runBreedingPipeline(
  input: BreedingInput,
  deps: RunBreedingPipelineDeps
) {
  await emit(deps.emit, { type: "preparing" });
  await emit(deps.emit, { type: "synthesizing-worldview" });
  await emit(deps.emit, { type: "synthesizing-skills" });
  const agent = await createAgentFromBreeding(input, deps);
  await emit(deps.emit, { type: "ready", payload: agent });
  return agent;
}
