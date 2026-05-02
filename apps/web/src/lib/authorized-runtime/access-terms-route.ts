import { z } from "zod";
import {
  createThoughtLineChainReader,
  type ThoughtLineChainReader,
} from "../chain/reader";
import type { PaymentTransaction } from "../chain/thoughtline";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const feeWeiSchema = z.string().regex(/^(0|[1-9]\d*)$/);
const feeKindSchema = z.enum(["usage", "breeding"]);

export interface AccessTerm {
  feeWei: string;
  isAuthorized: boolean;
  payTransaction: SerializedPaymentTransaction | null;
}

export interface AccessTermsResponseBody {
  usage: AccessTerm;
  breeding: AccessTerm;
}

export interface SerializedPaymentTransaction {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  chainId: number;
}

export interface AccessTermsRouteDeps {
  chain?: ThoughtLineChainReader;
}

export async function createAccessTermsGetResponse(
  request: Request,
  tokenId: string,
  deps: AccessTermsRouteDeps = {}
): Promise<Response> {
  try {
    const parsedTokenId = parseTokenId(tokenId);
    if (parsedTokenId === null) {
      return Response.json({ error: "Invalid tokenId" }, { status: 400 });
    }

    const url = new URL(request.url);
    const callerAddress = addressSchema.parse(
      url.searchParams.get("callerAddress")
    );
    const chain = deps.chain ?? createThoughtLineChainReader();
    const [usageFee, breedingFee, isUsageAuthorized, isBreedingAuthorized] =
      await Promise.all([
        chain.usageFee(parsedTokenId),
        chain.breedingFee(parsedTokenId),
        chain.isAuthorizedUser(parsedTokenId, callerAddress),
        chain.isAuthorizedBreeder(parsedTokenId, callerAddress),
      ]);

    const [usagePayTransaction, breedingPayTransaction] = await Promise.all([
      !isUsageAuthorized && usageFee > 0n
        ? chain.preparePayForUsage(parsedTokenId)
        : Promise.resolve(null),
      !isBreedingAuthorized && breedingFee > 0n
        ? chain.preparePayForBreeding(parsedTokenId)
        : Promise.resolve(null),
    ]);

    return Response.json({
      usage: {
        feeWei: usageFee.toString(),
        isAuthorized: isUsageAuthorized,
        payTransaction: serializeTransaction(usagePayTransaction),
      },
      breeding: {
        feeWei: breedingFee.toString(),
        isAuthorized: isBreedingAuthorized,
        payTransaction: serializeTransaction(breedingPayTransaction),
      },
    } satisfies AccessTermsResponseBody);
  } catch (error) {
    return Response.json({ error: formatRouteError(error) }, { status: 400 });
  }
}

export async function createAccessTermsPostResponse(
  request: Request,
  tokenId: string,
  deps: AccessTermsRouteDeps = {}
): Promise<Response> {
  try {
    const parsedTokenId = parseTokenId(tokenId);
    if (parsedTokenId === null) {
      return Response.json({ error: "Invalid tokenId" }, { status: 400 });
    }

    const body = z
      .object({
        kind: feeKindSchema,
        feeWei: feeWeiSchema,
      })
      .parse(await request.json());
    const chain = deps.chain ?? createThoughtLineChainReader();
    const transaction =
      body.kind === "usage"
        ? await chain.prepareSetUsageFee(parsedTokenId, body.feeWei)
        : await chain.prepareSetBreedingFee(parsedTokenId, body.feeWei);

    return Response.json({
      transaction: serializeTransaction(transaction),
    });
  } catch (error) {
    return Response.json({ error: formatRouteError(error) }, { status: 400 });
  }
}

export async function createPayUsageResponse(
  _request: Request,
  tokenId: string,
  deps: AccessTermsRouteDeps = {}
): Promise<Response> {
  try {
    const parsedTokenId = parseTokenId(tokenId);
    if (parsedTokenId === null) {
      return Response.json({ error: "Invalid tokenId" }, { status: 400 });
    }

    const chain = deps.chain ?? createThoughtLineChainReader();
    const usageFee = await chain.usageFee(parsedTokenId);
    if (usageFee === 0n) {
      return Response.json(
        { error: "Usage payment is disabled for this agent" },
        { status: 400 }
      );
    }

    return Response.json({
      transaction: serializeTransaction(await chain.preparePayForUsage(parsedTokenId)),
    });
  } catch (error) {
    return Response.json({ error: formatRouteError(error) }, { status: 400 });
  }
}

function parseTokenId(tokenId: string): bigint | null {
  if (!/^\d+$/.test(tokenId)) return null;
  return BigInt(tokenId);
}

function serializeTransaction(
  transaction: PaymentTransaction | null
): SerializedPaymentTransaction | null {
  if (!transaction) return null;
  return {
    to: transaction.to,
    data: transaction.data,
    value: transaction.value.toString(),
    chainId: transaction.chainId,
  };
}

function formatRouteError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid request";
  }
  return error instanceof Error ? error.message : String(error);
}
