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

export async function emitProgressAsPipelineEvent(
  emitEvent: EmitPipelineEvent | undefined,
  event: string,
  data: unknown
): Promise<void> {
  await emit(emitEvent, progressToPipelineEvent(event, data));
}

function progressToPipelineEvent(event: string, data: unknown): PipelineEvent {
  switch (event) {
    case "synthesizing-worldview":
    case "synthesizing-skills":
    case "encrypting":
      return { type: event };
    case "uploading":
      return {
        type: "uploading",
        target: readUploadTarget(data),
      };
    default:
      return { type: "ready", payload: data };
  }
}

function readUploadTarget(data: unknown): "public" | "private" | "both" {
  if (
    typeof data === "object" &&
    data !== null &&
    "target" in data &&
    ((data as { target?: unknown }).target === "public" ||
      (data as { target?: unknown }).target === "private" ||
      (data as { target?: unknown }).target === "both")
  ) {
    return (data as { target: "public" | "private" | "both" }).target;
  }

  return "both";
}
