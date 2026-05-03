import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { decodeFunctionData } from "viem";
import { POST } from "./route";
import { THOUGHTLINE_AGENT_ABI } from "@/lib/chain/thoughtline";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.STORAGE_ADAPTER;
});
afterAll(() => server.close());

describe("POST /api/genesis", () => {
  it("streams genesis progress and returns mint artifacts with creator-visible private worldview", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.STORAGE_ADAPTER = "memory";

    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as {
          messages: Array<{ role: string; content: string }>;
        };
        const prompt = body.messages.at(-1)?.content ?? "";

        if (prompt.includes("Extract the private worldview")) {
          return HttpResponse.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    privateWorldview: {
                      values: ["clarity"],
                      heuristics: ["Prefer reversible decisions"],
                      blindspots: [],
                      decisionStyle: "analytical",
                      freeform: "Private reasoning fingerprint.",
                    },
                  }),
                },
              },
            ],
          });
        }

        if (prompt.includes("Create 3-5 public skill packages")) {
          return HttpResponse.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    skills: [
                      {
                        id: "decision-review",
                        name: "Decision Review",
                        description: "Reviews a decision for tradeoffs.",
                        skillMarkdown:
                          "---\nname: Decision Review\n---\n## When to Use\nUse for decisions.\n## Inputs\nA decision.\n## Procedure\nCompare options.\n## Output\nA recommendation.",
                        source: "genesis",
                        parentSkillIds: [],
                      },
                    ],
                  }),
                },
              },
            ],
          });
        }

        return HttpResponse.json({
          choices: [
            {
              message: {
                content: "A concise advisor for careful decisions.",
              },
            },
          ],
        });
      })
    );

    const response = await POST(
      new Request("http://localhost/api/genesis", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Agent",
          expertiseType: "Decision review specialist",
          sourceLabels: ["founder notes", "customer calls"],
          desiredCapabilities: ["Review pitch decks"],
          ownerAddress: "0x1111111111111111111111111111111111111111",
          unlockSignature: "0xsigned",
          sources: [{ text: "I value clarity and careful tradeoffs." }],
        }),
      })
    );

    const events = await readSse(response);
    expect(events.map((event) => event.event)).toEqual([
      "preparing",
      "preparing-sources",
      "synthesizing-worldview",
      "synthesizing-skills",
      "encrypting",
      "uploading",
      "ready",
    ]);

    const ready = events.at(-1)?.data as Record<string, unknown>;
    expect(JSON.stringify(ready)).toContain("Private reasoning fingerprint");
    expect(
      (ready.privateWorldview as Record<string, unknown>).freeform
    ).toBe("Private reasoning fingerprint.");
    expect(ready.publicUri).toMatch(/^memory:\/\//);
    expect(ready.privateUri).toMatch(/^memory:\/\//);
    expect(ready.dataHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect((ready.publicProfile as Record<string, unknown>).expertiseType).toBe(
      "Decision review specialist"
    );
    expect((ready.publicProfile as Record<string, unknown>).sourceLabels).toEqual(
      ["founder notes", "customer calls"]
    );
    expect(
      (ready.publicProfile as Record<string, unknown>).desiredCapabilities
    ).toEqual(["Review pitch decks"]);

    const decoded = decodeFunctionData({
      abi: THOUGHTLINE_AGENT_ABI,
      data: ready.mintCalldata as `0x${string}`,
    });
    expect(decoded.functionName).toBe("mintGenesis");
    expect(decoded.args).toEqual([
      ready.publicUri,
      ready.privateUri,
      ready.dataHash,
    ]);
  });

  it("accepts sourceUrls and turns fetched pages into source material", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.STORAGE_ADAPTER = "memory";
    let worldviewPrompt = "";

    server.use(
      http.get("https://nav.al/rich", () =>
        HttpResponse.html(`<!doctype html>
          <html>
            <head><title>How to Get Rich</title></head>
            <body>
              <article>
                <h1>How to Get Rich</h1>
                <p>Seek specific knowledge and leverage.</p>
                <p>Accountability compounds judgment.</p>
              </article>
            </body>
          </html>`)
      ),
      http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as {
          messages: Array<{ role: string; content: string }>;
        };
        const prompt = body.messages.at(-1)?.content ?? "";

        if (prompt.includes("Extract the private worldview")) {
          worldviewPrompt = prompt;
          return HttpResponse.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    privateWorldview: {
                      values: ["specific knowledge"],
                      heuristics: ["Use leverage with accountability"],
                      blindspots: [],
                      decisionStyle: "contrarian",
                      freeform: "Private reasoning fingerprint.",
                    },
                  }),
                },
              },
            ],
          });
        }

        if (prompt.includes("Create 3-5 public skill packages")) {
          return HttpResponse.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    skills: [
                      {
                        id: "leverage-review",
                        name: "Leverage Review",
                        description: "Reviews a plan for leverage.",
                        skillMarkdown:
                          "---\nname: Leverage Review\n---\n## When to Use\nUse for plans.\n## Inputs\nA plan.\n## Procedure\nFind leverage.\n## Output\nA review.",
                        source: "genesis",
                        parentSkillIds: [],
                      },
                    ],
                  }),
                },
              },
            ],
          });
        }

        return HttpResponse.json({
          choices: [{ message: { content: "A leverage-focused agent." } }],
        });
      })
    );

    const response = await POST(
      new Request("http://localhost/api/genesis", {
        method: "POST",
        body: JSON.stringify({
          name: "URL Agent",
          ownerAddress: "0x1111111111111111111111111111111111111111",
          unlockSignature: "0xsigned",
          sourceUrls: ["https://nav.al/rich"],
        }),
      })
    );

    const events = await readSse(response);
    expect(events.map((event) => event.event)).toContain("fetching-source");
    expect(worldviewPrompt).toContain("How to Get Rich");
    expect(worldviewPrompt).toContain("Seek specific knowledge and leverage.");

    const ready = events.at(-1)?.data as Record<string, unknown>;
    expect((ready.publicProfile as Record<string, unknown>).sourceCount).toBe(1);
  });
});

async function readSse(response: Response) {
  const text = await response.text();
  return text
    .trim()
    .split("\n\n")
    .map((chunk) => {
      const event = chunk.match(/^event: (.+)$/m)?.[1] ?? "";
      const data = chunk.match(/^data: (.+)$/m)?.[1] ?? "{}";
      return { event, data: JSON.parse(data) as unknown };
    });
}
