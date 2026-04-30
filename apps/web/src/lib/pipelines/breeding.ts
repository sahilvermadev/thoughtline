import type { LLMProvider } from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index";
import type { BreedingInput } from "../breeding/create-from-breeding";
import { createAgentFromBreeding } from "../breeding/create-from-breeding";
import {
  emit,
  emitProgressAsPipelineEvent,
  type EmitPipelineEvent,
} from "./events";

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
  const agent = await createAgentFromBreeding(input, {
    ...deps,
    emit: async (event, data) => {
      await emitProgressAsPipelineEvent(deps.emit, event, data);
    },
  });
  await emit(deps.emit, { type: "ready", payload: agent });
  return agent;
}
