import { z } from "zod";
import type { LLMProvider, StorageProvider } from "@thoughtline/shared";
import { createAgentArchive, type AgentArchive } from "../agent-archive";
import { createChildMintArtifact } from "../agent-artifact";
import { createThoughtLineChainReader, type ThoughtLineChainReader } from "../chain/reader";
import { createProviderForUseCaseFromEnv } from "../llm/provider";
import { emitProgress } from "../progress";
import { createSseStream } from "../sse";
import { createRuntimeStorage } from "../storage/runtime";
import { deriveUnlockKey } from "../unlock";
import { parseJwk } from "../agent-archive/key-wrap";
import { createChainBreedingAccessReader } from "./access-reader";
import {
  createAuthorizedBreedingRuntime,
  type BreedingAccessReader,
} from "./breeding";
import { privateWorldviewSchema } from "@thoughtline/shared";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const requestSchema = z.object({
  parentTokenIdA: z.string().regex(/^\d+$/),
  parentTokenIdB: z.string().regex(/^\d+$/),
  callerAddress: addressSchema,
  childName: z.string().min(1).max(100),
  childBrief: z.string().trim().min(1).max(1000).optional(),
  unlockSignature: z.string().min(1),
  parentWorldviewA: privateWorldviewSchema.optional(),
  parentWorldviewB: privateWorldviewSchema.optional(),
});

export interface AuthorizedBreedDeps {
  accessReader?: BreedingAccessReader;
  llm?: LLMProvider;
  archive?: AgentArchive;
  storage?: StorageProvider;
  chain?: ThoughtLineChainReader;
  env?: Record<string, string | undefined>;
}

export async function createAuthorizedBreedResponse(
  request: Request,
  deps: AuthorizedBreedDeps = {}
): Promise<Response> {
  return createSseStream(async (send) => {
    const body = requestSchema.parse(await request.json());
    if (body.parentTokenIdA === body.parentTokenIdB) {
      throw new Error("Parent token IDs must be distinct");
    }

    await emitProgress(send, "preparing", {
      callerAddress: body.callerAddress,
    });
    const encryptionKey = await deriveUnlockKey(body.unlockSignature);

    const storage = deps.storage ?? createRuntimeStorage();
    const archive =
      deps.archive ??
      createAgentArchive(storage, undefined, buildArchiveOptionsFromEnv(deps.env));
    const chain = deps.chain ?? createThoughtLineChainReader(deps.env);
    const accessReader =
      deps.accessReader ??
      createChainBreedingAccessReader({
        chain,
        storage,
        archive,
        privateWorldviews: {
          ...(body.parentWorldviewA
            ? { [body.parentTokenIdA]: body.parentWorldviewA }
            : {}),
          ...(body.parentWorldviewB
            ? { [body.parentTokenIdB]: body.parentWorldviewB }
            : {}),
        },
      });
    const llm = deps.llm ?? createProviderForUseCaseFromEnv("breeding-worldview");
    const runtime = createAuthorizedBreedingRuntime({
      accessReader,
      llm,
      archive,
    });

    await emitProgress(send, "loading-parents");
    const child = await runtime.breed({
      parentTokenIdA: body.parentTokenIdA,
      parentTokenIdB: body.parentTokenIdB,
      callerAddress: body.callerAddress,
      childName: body.childName,
      childBrief: body.childBrief,
      encryptionKey,
      emit: send,
    });

    const artifact = createChildMintArtifact(
      {
        publicProfile: child.publicProfile,
        privateWorldview: child.privateWorldview,
        publicUri: child.publicUri,
        publicHash: child.publicHash,
        privateUri: child.privateUri,
        dataHash: child.dataHash,
        parentTokenIdA: body.parentTokenIdA,
        parentTokenIdB: body.parentTokenIdB,
      },
      deps.env
    );

    await emitProgress(send, "ready", artifact);
  });
}

function buildArchiveOptionsFromEnv(env?: Record<string, string | undefined>) {
  const source = env ?? process.env;
  return {
    runtimePublicKeyJwk: source.AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK
      ? parseJwk(
          source.AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK,
          "AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK"
        )
      : undefined,
    runtimePrivateKeyJwk: source.AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK
      ? parseJwk(
          source.AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK,
          "AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK"
        )
      : undefined,
  };
}
