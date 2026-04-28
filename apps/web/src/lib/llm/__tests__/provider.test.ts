import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createProvider } from "../provider.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("OpenRouter provider", () => {
  it("sends messages to OpenRouter API and returns the response", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
        const body = await request.json() as any;

        // Verify the request shape
        expect(body.messages).toEqual([
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hello" },
        ]);
        expect(body.model).toBeDefined();

        return HttpResponse.json({
          choices: [
            {
              message: { role: "assistant", content: "Hi there!" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
          },
        });
      })
    );

    const provider = createProvider("openrouter", {
      apiKey: "test-key",
      model: "anthropic/claude-sonnet-4",
    });

    const response = await provider.chat([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ]);

    expect(response.content).toBe("Hi there!");
  });

  it("returns usage stats from the API response", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", () => {
        return HttpResponse.json({
          choices: [
            { message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 42, completion_tokens: 7 },
        });
      })
    );

    const provider = createProvider("openrouter", {
      apiKey: "test-key",
      model: "anthropic/claude-sonnet-4",
    });

    const response = await provider.chat([{ role: "user", content: "test" }]);

    expect(response.usage).toEqual({ inputTokens: 42, outputTokens: 7 });
  });

  it("throws a meaningful error on API failure", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", () => {
        return HttpResponse.json(
          { error: { message: "Invalid API key" } },
          { status: 401 }
        );
      })
    );

    const provider = createProvider("openrouter", {
      apiKey: "bad-key",
      model: "anthropic/claude-sonnet-4",
    });

    await expect(
      provider.chat([{ role: "user", content: "test" }])
    ).rejects.toThrow(/OpenRouter API error 401/);
  });

  it("streams chunks from chatStream()", async () => {
    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " world" } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("");

    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
        const body = await request.json() as any;
        expect(body.stream).toBe(true);

        return new HttpResponse(sseBody, {
          headers: { "Content-Type": "text/event-stream" },
        });
      })
    );

    const provider = createProvider("openrouter", {
      apiKey: "test-key",
      model: "anthropic/claude-sonnet-4",
    });

    const chunks: { content: string; done: boolean }[] = [];
    for await (const chunk of provider.chatStream([
      { role: "user", content: "test" },
    ])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: "Hello", done: false },
      { content: " world", done: false },
      { content: "", done: true },
    ]);
  });

  it("chatStream throws on API error", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", () => {
        return HttpResponse.json(
          { error: { message: "Rate limited" } },
          { status: 429 }
        );
      })
    );

    const provider = createProvider("openrouter", {
      apiKey: "test-key",
      model: "anthropic/claude-sonnet-4",
    });

    const drain = async () => {
      for await (const _ of provider.chatStream([
        { role: "user", content: "test" },
      ])) {
        // consume
      }
    };

    await expect(drain()).rejects.toThrow(/OpenRouter API error 429/);
  });

  it("throws on unknown provider name", () => {
    expect(() =>
      createProvider("bogus" as any, { apiKey: "x", model: "y" })
    ).toThrow(/Unknown LLM provider: bogus/);
  });
});
