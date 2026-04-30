import { createStorageObjectResponse } from "@/lib/storage/object-route";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return createStorageObjectResponse(request);
}
