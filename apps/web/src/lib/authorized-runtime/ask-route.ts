import { z } from "zod";
import type { LLMProvider, StorageProvider } from "@thoughtline/shared";
import { createProviderForUseCaseFromEnv } from "../llm/provider";
import { createRuntimeStorage } from "../storage/runtime";
import { createThoughtLineChainReader, type ThoughtLineChainReader } from "../chain/reader";
import { createChainAgentAccessReader } from "./access-reader";
import {
  createAuthorizedAgentRuntime,
  type AgentAccessReader,
} from "./index";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
  usedSkillId: z.string().nullable().optional(),
});

const requestSchema = z.object({
  callerAddress: addressSchema,
  messages: z.array(messageSchema).min(1).max(50),
  skillId: z.string().min(1).max(80).optional(),
});

export interface AuthorizedAskDeps {
  accessReader?: AgentAccessReader;
  llm?: LLMProvider;
  storage?: StorageProvider;
  chain?: ThoughtLineChainReader;
}

export async function createAuthorizedAskResponse(
  request: Request,
  tokenId: string,
  deps: AuthorizedAskDeps = {}
): Promise<Response> {
  try {
    if (!/^\d+$/.test(tokenId)) {
      return Response.json({ error: "Invalid tokenId" }, { status: 400 });
    }

    const body = requestSchema.parse(await request.json());
    const storage = deps.storage ?? createRuntimeStorage();
    const chain = deps.chain ?? createThoughtLineChainReader();
    const accessReader =
      deps.accessReader ?? createChainAgentAccessReader({ chain, storage });
    const llm = deps.llm ?? createProviderForUseCaseFromEnv("conversation");
    const runtime = createAuthorizedAgentRuntime({ accessReader, llm });
    const result = await runtime.ask({
      tokenId,
      callerAddress: body.callerAddress,
      messages: body.messages,
      skillId: body.skillId,
    });

    return Response.json({
      message: result.message,
      usedSkillId: result.usedSkillId,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request"
        : error instanceof Error
          ? error.message
          : String(error);
    const status = /not authorized/i.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
