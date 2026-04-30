import { describe, expect, it } from "vitest";
import { readSse } from "../index";

describe("genesis browser flow", () => {
  it("parses SSE chunks into public events", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: preparing\ndata: {"ok":true}\n\n')
        );
        controller.enqueue(
          encoder.encode('event: ready\ndata: {"publicUri":"0g://x"}\n\n')
        );
        controller.close();
      },
    });

    const events: Array<{ event: string; data: unknown }> = [];
    await readSse(stream, (event, data) => events.push({ event, data }));

    expect(events).toEqual([
      { event: "preparing", data: { ok: true } },
      { event: "ready", data: { publicUri: "0g://x" } },
    ]);
  });
});
