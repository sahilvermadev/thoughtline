export type PipelineEvent =
  | { type: "preparing" }
  | { type: "synthesizing-worldview" }
  | { type: "synthesizing-skills" }
  | { type: "describing" }
  | { type: "encrypting" }
  | { type: "uploading"; target: "public" | "private" | "both" }
  | { type: "ready"; payload: unknown };

export type EmitPipelineEvent = (event: PipelineEvent) => void | Promise<void>;

export async function emit(
  emitEvent: EmitPipelineEvent | undefined,
  event: PipelineEvent
): Promise<void> {
  await emitEvent?.(event);
}
