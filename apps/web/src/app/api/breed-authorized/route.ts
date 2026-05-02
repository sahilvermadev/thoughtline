import { createAuthorizedBreedResponse } from "@/lib/authorized-runtime/breed-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return createAuthorizedBreedResponse(request);
}
