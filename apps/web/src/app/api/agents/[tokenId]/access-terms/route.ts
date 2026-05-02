import {
  createAccessTermsGetResponse,
  createAccessTermsPostResponse,
} from "@/lib/authorized-runtime/access-terms-route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ tokenId: string }> }
): Promise<Response> {
  const params = await context.params;
  return createAccessTermsGetResponse(request, params.tokenId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tokenId: string }> }
): Promise<Response> {
  const params = await context.params;
  return createAccessTermsPostResponse(request, params.tokenId);
}
