import type { LLMProvider } from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index";
import type { CreateFromTextInput } from "../agents/create-from-text";
import { createAgentFromText } from "../agents/create-from-text";
import {
  emit,
  emitProgressAsPipelineEvent,
  type EmitPipelineEvent,
} from "./events";

export interface RunGenesisPipelineDeps {
  llm: LLMProvider;
  archive: AgentArchive;
  emit?: EmitPipelineEvent;
}

export async function runGenesisPipeline(
  input: CreateFromTextInput,
  deps: RunGenesisPipelineDeps
) {
  await emit(deps.emit, { type: "preparing" });
  const agent = await createAgentFromText(input, {
    ...deps,
    emit: async (event, data) => {
      await emitProgressAsPipelineEvent(deps.emit, event, data);
    },
  });
  await emit(deps.emit, { type: "ready", payload: agent });
  return agent;
}
