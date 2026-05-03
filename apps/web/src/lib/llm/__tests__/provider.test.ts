import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createProvider, createProviderForUseCaseFromEnv } from "../provider";

const server = setupServer();
const brokerMock = vi.hoisted(() => ({
  getServiceMetadata: vi.fn(),
  getRequestHeaders: vi.fn(),
  processResponse: vi.fn(),
  createZGComputeNetworkBroker: vi.fn(),
}));

vi.mock("@0glabs/0g-serving-broker", () => ({
  createZGComputeNetworkBroker: brokerMock.createZGComputeNetworkBroker,
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.clearAllMocks();
  brokerMock.getServiceMetadata.mockResolvedValue({
    endpoint: "https://compute.example/v1",
    model: "service-model",
  });
  brokerMock.getRequestHeaders.mockResolvedValue({
    Authorization: "Bearer broker-auth",
  });
  brokerMock.processResponse.mockResolvedValue(true);
  brokerMock.createZGComputeNetworkBroker.mockResolvedValue({
    inference: {
      getServiceMetadata: brokerMock.getServiceMetadata,
      getRequestHeaders: brokerMock.getRequestHeaders,
      processResponse: brokerMock.processResponse,
    },
  });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

function createTestZeroGProvider(model = "") {
  return createProvider("0g-compute", {
    apiKey: "unused",
    model,
    providerAddress: "0x1234567890123456789012345678901234567890",
    privateKey:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    rpcUrl: "http://127.0.0.1:8545",
  });
}

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

  it("creates providers from use-case environment routing", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as { model: string };
        expect(body.model).toBe("test-model");
        return HttpResponse.json({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        });
      })
    );

    const provider = createProviderForUseCaseFromEnv("conversation", {
      LLM_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "test-key",
      OPENROUTER_MODEL: "test-model",
    });

    await expect(
      provider.chat([{ role: "user", content: "test" }])
    ).resolves.toMatchObject({ content: "ok" });
  });
});

describe("0G Router provider", () => {
  it("sends messages to the 0G Router and returns the assistant response", async () => {
    server.use(
      http.post("https://router-api.0g.ai/v1/chat/completions", async ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer sk-test");
        const body = (await request.json()) as any;

        expect(body).toMatchObject({
          model: "deepseek/deepseek-chat-v3-0324",
          messages: [{ role: "user", content: "Hello" }],
        });

        return HttpResponse.json({
          choices: [{ message: { role: "assistant", content: "router ok" } }],
          usage: { prompt_tokens: 9, completion_tokens: 4 },
        });
      })
    );

    const response = await createProvider("0g-router", {
      apiKey: "sk-test",
      model: "deepseek/deepseek-chat-v3-0324",
    });

    await expect(
      response.chat([{ role: "user", content: "Hello" }])
    ).resolves.toEqual({
      content: "router ok",
      usage: { inputTokens: 9, outputTokens: 4 },
    });
  });

  it("throws a useful error on 0G Router failure", async () => {
    server.use(
      http.post("https://router-api.0g.ai/v1/chat/completions", () => {
        return HttpResponse.json(
          { error: { message: "bad key" } },
          { status: 401 }
        );
      })
    );

    const provider = createProvider("0g-router", {
      apiKey: "sk-bad",
      model: "zai-org/GLM-5-FP8",
    });

    await expect(
      provider.chat([{ role: "user", content: "test" }])
    ).rejects.toThrow(/0G Router API error 401/);
  });

  it("streams chunks from 0G Router chatStream()", async () => {
    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " router" } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("");

    server.use(
      http.post("https://router-api.0g.ai/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as any;
        expect(body.stream).toBe(true);
        return new HttpResponse(sseBody, {
          headers: { "Content-Type": "text/event-stream" },
        });
      })
    );

    const provider = createProvider("0g-router", {
      apiKey: "sk-test",
      model: "zai-org/GLM-5-FP8",
    });

    const chunks: { content: string; done: boolean }[] = [];
    for await (const chunk of provider.chatStream([
      { role: "user", content: "test" },
    ])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: "Hello", done: false },
      { content: " router", done: false },
      { content: "", done: true },
    ]);
  });

  it("creates a 0G Router provider from environment routing", async () => {
    server.use(
      http.post("https://router-api.0g.ai/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as any;
        expect(body.model).toBe("zai-org/GLM-5-FP8");
        return HttpResponse.json({
          choices: [{ message: { role: "assistant", content: "env router ok" } }],
        });
      })
    );

    const provider = createProviderForUseCaseFromEnv("genesis", {
      LLM_PROVIDER: "0g-router",
      OG_ROUTER_API_KEY: "sk-env",
      OG_ROUTER_MODEL: "zai-org/GLM-5-FP8",
    });

    await expect(
      provider.chat([{ role: "user", content: "test" }])
    ).resolves.toMatchObject({ content: "env router ok" });
  });

});

describe("0G Compute provider", () => {
  it("sends messages to the 0G endpoint and returns the assistant response", async () => {
    server.use(
      http.post("https://compute.example/v1/chat/completions", async ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer broker-auth");
        const body = (await request.json()) as any;

        expect(body).toMatchObject({
          model: "service-model",
          messages: [{ role: "user", content: "Hello" }],
        });

        return HttpResponse.json(
          {
            id: "chat-body-id",
            choices: [{ message: { role: "assistant", content: "0G says hi" } }],
          },
          { headers: { "ZG-Res-Key": "chat-header-id" } }
        );
      })
    );

    const response = await createTestZeroGProvider().chat([
      { role: "user", content: "Hello" },
    ]);

    expect(response.content).toBe("0G says hi");
    expect(brokerMock.processResponse).toHaveBeenCalledWith(
      "0x1234567890123456789012345678901234567890",
      "chat-header-id",
      "{}"
    );
  });

  it("prefers the ZG-Res-Key header for settlement and maps usage tokens", async () => {
    server.use(
      http.post("https://compute.example/v1/chat/completions", () => {
        return HttpResponse.json(
          {
            id: "chat-body-id",
            choices: [{ message: { role: "assistant", content: "ok" } }],
            usage: { prompt_tokens: 11, completion_tokens: 7 },
          },
          { headers: { "zg-res-key": "chat-header-id" } }
        );
      })
    );

    const response = await createTestZeroGProvider("override-model").chat([
      { role: "user", content: "test" },
    ]);

    expect(response.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
    expect(brokerMock.processResponse).toHaveBeenCalledWith(
      "0x1234567890123456789012345678901234567890",
      "chat-header-id",
      JSON.stringify({ prompt_tokens: 11, completion_tokens: 7 })
    );
  });

  it("throws a useful error on 0G HTTP failure", async () => {
    server.use(
      http.post("https://compute.example/v1/chat/completions", () => {
        return HttpResponse.json({ error: "bad request" }, { status: 400 });
      })
    );

    await expect(
      createTestZeroGProvider().chat([{ role: "user", content: "test" }])
    ).rejects.toThrow(/0G Compute API error 400/);
    expect(brokerMock.processResponse).not.toHaveBeenCalled();
  });

  it("retries transient 0G failures before returning the assistant response", async () => {
    let calls = 0;
    server.use(
      http.post("https://compute.example/v1/chat/completions", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: "busy" }, { status: 429 });
        }
        return HttpResponse.json(
          {
            id: "retry-chat-id",
            choices: [{ message: { role: "assistant", content: "retried ok" } }],
          },
          { headers: { "ZG-Res-Key": "retry-chat-id" } }
        );
      })
    );

    const response = await createTestZeroGProvider().chat([
      { role: "user", content: "test" },
    ]);

    expect(response.content).toBe("retried ok");
    expect(calls).toBe(2);
    expect(brokerMock.processResponse).toHaveBeenCalledWith(
      "0x1234567890123456789012345678901234567890",
      "retry-chat-id",
      "{}"
    );
  });

  it("streams chunks and settles after the stream completes", async () => {
    const sseBody = [
      `data: ${JSON.stringify({ id: "stream-body-id", choices: [{ delta: { content: "Hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " 0G" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } })}\n\n`,
      `data: [DONE]\n\n`,
    ].join("");

    server.use(
      http.post("https://compute.example/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as any;
        expect(body.stream).toBe(true);

        return new HttpResponse(sseBody, {
          headers: { "Content-Type": "text/event-stream" },
        });
      })
    );

    const chunks: { content: string; done: boolean }[] = [];
    for await (const chunk of createTestZeroGProvider().chatStream([
      { role: "user", content: "test" },
    ])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: "Hello", done: false },
      { content: " 0G", done: false },
      { content: "", done: true },
    ]);
    expect(brokerMock.processResponse).toHaveBeenCalledWith(
      "0x1234567890123456789012345678901234567890",
      "stream-body-id",
      JSON.stringify({ prompt_tokens: 3, completion_tokens: 2 })
    );
  });

  it("creates a 0G provider from use-case environment routing", async () => {
    server.use(
      http.post("https://compute.example/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as any;
        expect(body.model).toBe("env-model");
        return HttpResponse.json(
          { id: "env-chat-id", choices: [{ message: { content: "env ok" } }] },
          { headers: { "ZG-Res-Key": "env-chat-id" } }
        );
      })
    );

    const provider = createProviderForUseCaseFromEnv("genesis", {
      LLM_PROVIDER: "0g-compute",
      OG_COMPUTE_PROVIDER_ADDRESS: "0x1234567890123456789012345678901234567890",
      OG_PRIVATE_KEY:
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      OG_RPC_URL: "http://127.0.0.1:8545",
      OG_COMPUTE_MODEL: "env-model",
    });

    await expect(
      provider.chat([{ role: "user", content: "test" }])
    ).resolves.toMatchObject({ content: "env ok" });
  });

  it.skipIf(process.env.VITEST_0G_COMPUTE !== "1")(
    "runs a real gated 0G Compute chat",
    async () => {
      server.close();
      vi.doUnmock("@0glabs/0g-serving-broker");
      vi.resetModules();
      const { createProviderForUseCaseFromEnv: createRealProviderFromEnv } =
        await import("../provider");

      const provider = createRealProviderFromEnv("genesis");
      const response = await provider.chat([
        { role: "user", content: "Reply with exactly: ok" },
      ]);

      expect(response.content.length).toBeGreaterThan(0);
    },
    60_000
  );
});

describe("0G live integration", () => {
  it.skipIf(process.env.VITEST_0G_ROUTER !== "1")(
    "runs a real gated 0G Router chat",
    async () => {
      server.close();
      const provider = createProviderForUseCaseFromEnv("genesis");
      const response = await provider.chat([
        { role: "user", content: "Reply with exactly: ok" },
      ]);

      expect(response.content.length).toBeGreaterThan(0);
    },
    60_000
  );
});
