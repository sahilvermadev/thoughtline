export type ProgressEmitter = (
  event: string,
  data?: unknown
) => Promise<void> | void;

export async function emitProgress(
  emit: ProgressEmitter | undefined,
  event: string,
  data?: unknown
): Promise<void> {
  await emit?.(event, data);
}

export async function runProgressStep<T>(
  emit: ProgressEmitter | undefined,
  event: string,
  run: () => Promise<T> | T,
  data?: unknown
): Promise<T> {
  await emitProgress(emit, event, data);
  return run();
}
