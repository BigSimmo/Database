import { localProjectRequestIdentityPayload } from "@/lib/local-project-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return Response.json(localProjectRequestIdentityPayload(request), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
