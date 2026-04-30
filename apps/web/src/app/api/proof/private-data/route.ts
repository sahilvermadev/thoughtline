import { createPrivateDataProofResponse } from "@/lib/proof/private-data-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return createPrivateDataProofResponse(request);
}
