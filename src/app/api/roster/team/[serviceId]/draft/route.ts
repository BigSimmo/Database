import { z } from "zod";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterApiError, rosterInvalidRequest } from "@/lib/roster/team/errors";
import { buildRosterDraftWorkbook } from "@/lib/roster/maker/draft-export";
import { rosterDraftActionSchema } from "@/lib/roster/maker/model";
import { changeRosterDraft, readRosterDraft } from "@/lib/roster/maker/repository";
import { rosterRead } from "@/lib/roster/team/repository";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };
const uuid = z.string().uuid();
async function serviceIdFrom(context: Context) {
  const parsed = uuid.safeParse((await context.params).serviceId);
  if (!parsed.success) throw rosterInvalidRequest("Unknown team.");
  return parsed.data;
}
export async function GET(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = await serviceIdFrom(context);
    const params = new URL(request.url).searchParams;
    const draftId = uuid.safeParse(params.get("draftId"));
    // `format=xlsx&version=N` downloads that exact draft version as a workbook. It is built here
    // rather than in the browser so exceljs stays out of the client bundle.
    const format = params.get("format");
    const version = z.coerce.number().int().positive().safeParse(params.get("version"));
    const exporting = format === "xlsx";
    if (
      [...params.keys()].some((key) => key !== "draftId" && key !== "format" && key !== "version") ||
      params.getAll("draftId").length !== 1 ||
      !draftId.success ||
      (format !== null && !exporting) ||
      params.getAll("format").length > 1 ||
      params.getAll("version").length !== (exporting ? 1 : 0) ||
      (exporting && !version.success)
    )
      throw rosterInvalidRequest();
    const draft = await readRosterDraft(client, actorId, serviceId, draftId.data);
    if (!exporting) return draft;
    if (draft.draft.version !== version.data) throw rosterApiError({ message: "roster_conflict" });
    const { people } = await rosterRead(client, actorId, serviceId, "people");
    const bytes = await buildRosterDraftWorkbook(draft, people);
    const name = `DRAFT-roster-${draft.draft.periodStart}-to-${draft.draft.periodEnd}-v${draft.draft.version}.xlsx`;
    return new Response(bytes as BlobPart, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
export async function POST(request: Request, context: Context) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = await serviceIdFrom(context);
    const action = await parseJsonBody(request, rosterDraftActionSchema, "Check the draft change and try again.");
    return changeRosterDraft(client, actorId, serviceId, action);
  });
}
