import { z } from "zod";
import { createRuntimeStorage } from "@/lib/storage/runtime";
import { verifyPrivateDataHash } from "@/lib/proof/private-data";

const requestSchema = z.object({
  privateUri: z.string().min(1),
  dataHash: z.string().min(1),
});

export interface PrivateDataProofDeps {
  storage?: ReturnType<typeof createRuntimeStorage>;
}

export async function createPrivateDataProofResponse(
  request: Request,
  deps: PrivateDataProofDeps = {}
): Promise<Response> {
  try {
    const body = requestSchema.parse(await request.json());
    const proof = await verifyPrivateDataHash({
      storage: deps.storage ?? createRuntimeStorage(),
      privateUri: body.privateUri,
      dataHash: body.dataHash,
    });

    return Response.json(proof);
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
