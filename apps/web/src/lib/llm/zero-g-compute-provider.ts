import type { LLMMessage, LLMProvider, LLMResponse } from "@thoughtline/shared";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import type { ProviderConfig } from "./types";
import {
  isRecord,
  readAssistantContent,
  readDeltaContent,
  readUsage,
  requireConfig,
} from "./response-utils";

export function createZeroGComputeProvider(config: ProviderConfig): LLMProvider {
  const providerAddress = requireConfig(
    "providerAddress",
    config.providerAddress,
    "0g-compute"
  );
  const privateKey = requireConfig("privateKey", config.privateKey, "0g-compute");
  const rpcUrl = requireConfig("rpcUrl", config.rpcUrl, "0g-compute");

  let brokerPromise: ReturnType<typeof createZGComputeNetworkBroker> | undefined;
  let metadataPromise:
    | Promise<{ endpoint: string; model: string }>
    | undefined;

  async function getBroker() {
    if (!brokerPromise) {
      const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, rpcProvider);
      brokerPromise = createZGComputeNetworkBroker(wallet as any);
    }

    return brokerPromise;
  }

  async function getMetadata() {
    if (!metadataPromise) {
      metadataPromise = getBroker().then((broker) =>
        broker.inference.getServiceMetadata(providerAddress)
      );
    }

    return metadataPromise;
  }

  async function request(body: Record<string, unknown>): Promise<Response> {
    const broker = await getBroker();
    const metadata = await getMetadata();
    const headers = await broker.inference.getRequestHeaders(providerAddress);
    const model = config.model || metadata.model;
    const res = await fetch(`${metadata.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ model, ...body }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`0G Compute API error ${res.status}: ${text}`);
    }

    return res;
  }

  async function settle(res: Response, data: unknown): Promise<void> {
    const broker = await getBroker();
    const chatID = extractChatID(res, data);
    if (!chatID) {
      throw new Error("0G Compute response did not include a chat id");
    }

    const usage = isRecord(data) && isRecord(data.usage) ? data.usage : {};
    await broker.inference.processResponse(
      providerAddress,
      chatID,
      JSON.stringify(usage)
    );
  }

  return {
    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
      const res = await request({ messages });
      const data = await res.json();
      const content = readAssistantContent(data);
      if (content === undefined) {
        throw new Error("0G Compute response did not include assistant content");
      }

      await settle(res, data);

      return {
        content,
        usage: readUsage(data),
      };
    },

    async *chatStream(
      messages: LLMMessage[]
    ): AsyncIterable<{ content: string; done: boolean }> {
      const res = await request({ messages, stream: true });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("0G Compute stream response had no body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fallbackID: string | undefined;
      let usage: unknown = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            await settleStream(res, fallbackID, usage);
            yield { content: "", done: true };
            return;
          }

          const parsed = JSON.parse(data);
          if (!fallbackID && isRecord(parsed) && typeof parsed.id === "string") {
            fallbackID = parsed.id;
          }
          if (isRecord(parsed) && parsed.usage !== undefined) {
            usage = parsed.usage;
          }

          const content = readDeltaContent(parsed);
          if (content !== undefined) {
            yield { content, done: false };
          }
        }
      }

      await settleStream(res, fallbackID, usage);
      yield { content: "", done: true };
    },
  };

  async function settleStream(
    res: Response,
    fallbackID: string | undefined,
    usage: unknown
  ) {
    const broker = await getBroker();
    const chatID = readHeaderChatID(res) ?? fallbackID;
    if (!chatID) {
      throw new Error("0G Compute response did not include a chat id");
    }

    await broker.inference.processResponse(
      providerAddress,
      chatID,
      JSON.stringify(usage ?? {})
    );
  }
}

function extractChatID(res: Response, data: unknown): string | undefined {
  return readHeaderChatID(res) ?? (isRecord(data) && typeof data.id === "string"
    ? data.id
    : undefined);
}

function readHeaderChatID(res: Response): string | undefined {
  return res.headers.get("ZG-Res-Key") ?? res.headers.get("zg-res-key") ?? undefined;
}
