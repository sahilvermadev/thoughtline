import { z } from "zod";
import { createAgentArchive } from "@/lib/agent-archive";
import { createGenesisMint } from "@/lib/genesis-mint";
import { createProviderForUseCaseFromEnv } from "@/lib/llm/provider";
import { fetchUrlSource } from "@/lib/source-files";
import { createRuntimeStorage } from "@/lib/storage/runtime";
import { createSseStream } from "@/lib/sse";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    name: z.string().min(1).max(100),
    expertiseType: z.string().trim().min(1).max(200).optional(),
    sourceLabels: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    desiredCapabilities: z
      .array(z.string().trim().min(1).max(160))
      .max(5)
      .optional(),
    sources: z
      .array(
        z.object({
          label: z.string().max(100).optional(),
          text: z.string().min(1).max(1_000_000),
        })
      )
      .default([]),
    sourceUrls: z.array(z.string().url()).max(8).default([]),
    ownerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    unlockSignature: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.sources.length === 0 && value.sourceUrls.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Attach a file, paste source text, or add a source URL.",
        path: ["sources"],
      });
    }
  });

export async function POST(request: Request): Promise<Response> {
  return createSseStream(async (send) => {
    const body = requestSchema.parse(await request.json());
    const storage = createRuntimeStorage();
    const archive = createAgentArchive(storage);
    const llm = createProviderForUseCaseFromEnv("genesis");
    const urlSources =
      body.sourceUrls.length > 0
        ? await Promise.all(
            body.sourceUrls.map(async (url) => {
              await send("fetching-source", { url });
              return fetchUrlSource(url);
            })
          )
        : [];

    await createGenesisMint(
      {
        ...body,
        sources: [...body.sources, ...urlSources],
      },
      {
        llm,
        archive,
        emit: send,
      }
    );
  });
}
