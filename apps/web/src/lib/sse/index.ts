export type SseSender = (event: string, data?: unknown) => Promise<void>;

export function createSseStream(
  run: (send: SseSender) => Promise<void>
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = createSseSender(controller);
      try {
        await run(send);
      } catch (error) {
        await send("error", {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

export function createSseSender(
  controller: ReadableStreamDefaultController<Uint8Array>
): SseSender {
  const encoder = new TextEncoder();
  return async (event, data = {}) => {
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  };
}
