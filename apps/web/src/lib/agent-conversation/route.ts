import { z } from "zod";
import {
  privateWorldviewSchema,
  publicProfileSchema,
  type LLMProvider,
} from "@thoughtline/shared";
import { createProviderForUseCaseFromEnv } from "@/lib/llm/provider";
import { converseWithAgent } from ".";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
  usedSkillId: z.string().nullable().optional(),
});

const requestSchema = z.object({
  privateWorldview: privateWorldviewSchema,
  publicProfile: publicProfileSchema,
  messages: z.array(messageSchema).min(1).max(50),
  skillId: z.string().min(1).optional(),
});

export interface ConverseAgentDeps {
  llm?: LLMProvider;
}

export async function createConverseAgentResponse(
  request: Request,
  deps: ConverseAgentDeps = {}
): Promise<Response> {
  try {
    const body = requestSchema.parse(await request.json());
    const llm = deps.llm ?? createProviderForUseCaseFromEnv("conversation");
    const result = await converseWithAgent(body, llm);

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

    return Response.json({ error: message }, { status: 400 });
  }
}
