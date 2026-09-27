import { z } from "zod";
import { withRosterApi } from "@/lib/roster/team/api";
import { rosterRead } from "@/lib/roster/team/repository";
import { rosterApiError, rosterInvalidRequest } from "@/lib/roster/team/errors";
import { buildRosterWorkbook } from "@/lib/roster/export";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  return withRosterApi(request, async (client, actorId) => {
    const serviceId = z
      .string()
      .uuid()
      .safeParse((await context.params).serviceId);
    const params = new URL(request.url).searchParams;
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
    const from = date.safeParse(params.get("from"));
    const to = date.safeParse(params.get("to"));
    if (
      !serviceId.success ||
      !from.success ||
      !to.success ||
      [...params.keys()].some((key) => key !== "from" && key !== "to")
    )
      throw rosterInvalidRequest();
    const days = (Date.parse(to.data) - Date.parse(from.data)) / 86_400_000 + 1;
    if (days < 1 || days > 62) throw rosterInvalidRequest("Export at most 62 days at a time.");
    const overview = await rosterRead(client, actorId, serviceId.data, "overview");
    if (overview.me.role !== "manager") throw rosterApiError({ message: "roster_role_denied" });
    const [assignments, people] = await Promise.all([
      rosterRead(client, actorId, serviceId.data, "assignments", { from: from.data, to: to.data }),
      rosterRead(client, actorId, serviceId.data, "people"),
    ]);
    const bytes = await buildRosterWorkbook(assignments.assignments, people.people, { from: from.data, to: to.data });
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="roster-${from.data}-${to.data}.xlsx"`,
      },
    });
  });
}
