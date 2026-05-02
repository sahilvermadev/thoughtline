import { createPayUsageResponse } from "@/lib/authorized-runtime/access-terms-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ tokenId: string }> }
): Promise<Response> {
  const params = await context.params;
  return createPayUsageResponse(request, params.tokenId);
}
