import type { LLMProvider } from "@thoughtline/shared";
import type { AgentArchive } from "../agent-archive/index.js";
import type { CreateFromTextInput } from "../agents/create-from-text.js";
import { createAgentFromText } from "../agents/create-from-text.js";
import { emit, type EmitPipelineEvent } from "./events.js";

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
  await emit(deps.emit, { type: "synthesizing-worldview" });
  await emit(deps.emit, { type: "synthesizing-skills" });
  const agent = await createAgentFromText(input, deps);
  await emit(deps.emit, { type: "ready", payload: agent });
  return agent;
}
