import { createConverseAgentResponse } from "@/lib/agent-conversation/route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return createConverseAgentResponse(request);
}
