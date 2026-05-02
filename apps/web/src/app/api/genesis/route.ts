import { z } from "zod";
import { createAgentArchive } from "@/lib/agent-archive";
import { createGenesisMint } from "@/lib/genesis-mint";
import { createProviderForUseCaseFromEnv } from "@/lib/llm/provider";
import { createRuntimeStorage } from "@/lib/storage/runtime";
import { createSseStream } from "@/lib/sse";

export const runtime = "nodejs";

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  expertiseType: z.string().trim().min(1).max(200).optional(),
  sourceLabels: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  sources: z
    .array(
      z.object({
        label: z.string().max(100).optional(),
        text: z.string().min(1).max(50_000),
      })
    )
    .min(1),
  ownerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  unlockSignature: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  return createSseStream(async (send) => {
    const body = requestSchema.parse(await request.json());
    const storage = createRuntimeStorage();
    const archive = createAgentArchive(storage);
    const llm = createProviderForUseCaseFromEnv("genesis");

    await createGenesisMint(body, {
      llm,
      archive,
      emit: send,
    });
  });
}
