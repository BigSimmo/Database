import { appName, localProjectId } from "../../../../scripts/local-server-utils.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    appName,
    projectId: localProjectId(process.cwd()),
  });
}
