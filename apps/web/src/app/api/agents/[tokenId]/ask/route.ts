import { createAuthorizedAskResponse } from "@/lib/authorized-runtime/ask-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ tokenId: string }> }
): Promise<Response> {
  const params = await context.params;
  return createAuthorizedAskResponse(request, params.tokenId);
}
