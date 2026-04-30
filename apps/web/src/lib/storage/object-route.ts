import { z } from "zod";
import type { StorageProvider } from "@thoughtline/shared";
import { createRuntimeStorage } from "@/lib/storage/runtime";

const requestSchema = z.object({
  uri: z.string().min(1),
});

export interface StorageObjectResponseDeps {
  storage?: StorageProvider;
}

export async function createStorageObjectResponse(
  request: Request,
  deps: StorageObjectResponseDeps = {}
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { uri } = requestSchema.parse({
      uri: url.searchParams.get("uri"),
    });
    const bytes = await (deps.storage ?? createRuntimeStorage()).fetch(uri);

    return Response.json({
      uri,
      bytesBase64: Buffer.from(bytes).toString("base64"),
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
