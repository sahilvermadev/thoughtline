import { createPublicAgentsResponse } from "@/lib/gallery/public-agents-route";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return createPublicAgentsResponse();
}
