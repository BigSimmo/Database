import "server-only";

import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import {
  feedbackOpenSchema,
  feedbackTotalsSchema,
  importCommittedSchema,
  pendingConfirmations,
  readinessSchema,
  supervisionReadSchema,
  teachReadSchema,
  unloggedReviewRows,
  type CpdReviewBody,
  type CpdReviewResult,
  type ImportPreview,
  type SheetRow,
  type SupervisionPairingView,
  type TeachingDepthAction,
  type TeachingDepthInput,
  type TeachingDepthQuery,
} from "@/lib/teaching/depth-model";
import { previewRows } from "@/lib/teaching/import-sheet";
import {
  parseTeachingResult,
  payloadOf,
  readLogbook,
  readOrganise,
  readWeek,
  saveTeachingCpdEntry,
  teachingCommand,
  teachingErrors,
  teachingRpcError,
} from "@/lib/teaching/repository";
import { perthToday } from "@/lib/teaching/time";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/** Where teachingErrors' general words would mislead for this action. */
const depthMessages: Partial<Record<TeachingDepthAction, Record<string, string>>> = {
  "supervision.read": { teaching_not_found: "This pairing isn't available." },
  "supervision.log": {
    teaching_not_found: "This pairing isn't available.",
    teaching_role_denied: "Only the registrar in this pairing logs its sessions.",
    teaching_invalid_request: "Choose a date inside the pairing, today or earlier.",
  },
  "supervision.confirm": {
    teaching_not_found: "These sessions aren't waiting for you any more. Reload to see the latest.",
  },
  "supervision.note": {
    teaching_not_found: "This session isn't yours to correct.",
    teaching_limit: "This session already has 5 corrections waiting.",
  },
  "supervision.note.confirm": { teaching_not_found: "This correction isn't waiting for you any more." },
  "supervision.target.set": { teaching_role_denied: "Only the registrar sets this target." },
  "pairing.save": { teaching_role_denied: "A pairing that includes you needs a Teaching admin." },
  "pairing.reassign": { teaching_role_denied: "A pairing that includes you needs a Teaching admin." },
  "readiness.set": { teaching_role_denied: "Only this session's presenter changes its checklist." },
  "readiness.deid.confirm": { teaching_role_denied: "Only this session's presenter confirms its cases." },
  "feedback.submit": {
    teaching_not_attended: "Feedback is for people who checked in to this session.",
    teaching_window_closed: "Feedback is open for 7 days after the session.",
    teaching_limit: "You've already answered for this session.",
  },
  "feedback.totals": { teaching_role_denied: "Only the presenter and organisers see these totals." },
  "import.commit": { teaching_invalid_request: "A row was refused, so nothing was saved. Preview the file again." },
};

const writeResults = {
  "pairing.save": z.object({ pairingId: z.uuid() }),
  "pairing.reassign": z.object({ pairingId: z.uuid(), pendingMoved: z.number().int() }),
  "supervision.target.set": z.object({ pairingId: z.uuid(), targetHours: z.number().nullable() }),
  "supervision.log": z.object({ entryId: z.uuid() }),
  "supervision.confirm": z.object({ confirmed: z.number().int() }),
  "supervision.note": z.object({ noteId: z.uuid() }),
  "supervision.note.confirm": z.object({ noteId: z.uuid() }),
  "readiness.set": readinessSchema,
  "readiness.deid.confirm": readinessSchema,
  // `{}` only: no responder id, marker or time comes back (master plan R22).
  "feedback.submit": z.object({}),
  "import.commit": importCommittedSchema,
} satisfies Record<Exclude<TeachingDepthInput["action"], "import.preview">, z.ZodType>;

/** Actor from requireAuthenticatedUser only, never from a payload (as teachingCommand). */
export async function teachingDepthCommand(
  client: AdminClient,
  actorId: string,
  serviceId: string,
  action: TeachingDepthAction,
  payload: object = {},
): Promise<unknown> {
  if (!actorId)
    throw new PublicApiError(teachingErrors.teaching_auth_required.message, 401, { code: "teaching_auth_required" });
  const { data, error } = await client.rpc("teaching_depth_command", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_action: action,
    p_payload: payload,
  });
  if (!error) return data;
  const plain = depthMessages[action]?.[error.message];
  const known = teachingErrors[error.message];
  if (plain && known) throw new PublicApiError(plain, known.status, { code: error.message });
  throw teachingRpcError(error);
}

export async function teachingDepthRead(
  client: AdminClient,
  actorId: string,
  serviceId: string,
  query: TeachingDepthQuery,
): Promise<unknown> {
  const data = await teachingDepthCommand(client, actorId, serviceId, query.action, payloadOf(query));
  return query.action === "supervision.read"
    ? parseTeachingResult(supervisionReadSchema, data)
    : parseTeachingResult(feedbackTotalsSchema, data);
}

/**
 * Master plan R25: the rows the browser read, checked against the organiser's own groups. Nothing is
 * saved; `organise.read` refuses anyone who does not organise (or administer) this service.
 */
async function previewImport(
  client: AdminClient,
  actorId: string,
  serviceId: string,
  rows: readonly SheetRow[],
): Promise<ImportPreview> {
  const { groups } = await readOrganise(client, actorId, serviceId);
  return previewRows(rows, groups);
}

export async function teachingDepthMutation(
  client: AdminClient,
  actorId: string,
  serviceId: string,
  input: TeachingDepthInput,
): Promise<unknown> {
  if (input.action === "import.preview") return previewImport(client, actorId, serviceId, input.rows);
  return parseTeachingResult(
    writeResults[input.action],
    await teachingDepthCommand(client, actorId, serviceId, input.action, payloadOf(input)),
  );
}

type ServiceLabel = { serviceId: string; serviceName: string; readOnlyUntil: string | null };

/**
 * `supervision.read` needs a service, so read each of the reader's services (week.read's list) and
 * label the rows. With `includeLeft`, a service the reader left in the last 90 days is read too
 * (master plan R28): the database then returns only their own pairings as registrar, read-only.
 * Those services are found from the logbook, the only read that names them.
 */
export async function readSupervisionViews(
  client: AdminClient,
  actorId: string,
  now: Date = new Date(),
  options: { includeLeft?: boolean } = {},
): Promise<SupervisionPairingView[]> {
  const today = perthToday(now);
  const [{ teams }, logbook] = await Promise.all([
    readWeek(client, actorId, { from: today, to: today }),
    options.includeLeft ? readLogbook(client, actorId) : Promise.resolve([]),
  ]);
  const services = new Map<string, ServiceLabel>(
    teams.map((team) => [team.id, { serviceId: team.id, serviceName: team.name, readOnlyUntil: null }]),
  );
  for (const row of logbook)
    if (row.serviceId && row.readOnlyUntil && !services.has(row.serviceId))
      services.set(row.serviceId, {
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        readOnlyUntil: row.readOnlyUntil,
      });

  const perService = await Promise.all(
    [...services.values()].map(async (service) => {
      let data: unknown;
      try {
        data = await teachingDepthCommand(client, actorId, service.serviceId, "supervision.read");
      } catch (error) {
        // A leaver's 90 days can end between the two reads; that service then has nothing to show.
        const code = error instanceof PublicApiError ? error.details?.code : undefined;
        if (service.readOnlyUntil && code === "teaching_access_denied") return [];
        throw error;
      }
      return parseTeachingResult(supervisionReadSchema, data).pairings.map((row) => ({ ...row, ...service }));
    }),
  );
  return perService.flat();
}

/** The supervisor's confirm list. Active services only: a leaver never confirms anything. */
export async function readPendingConfirmations(client: AdminClient, actorId: string) {
  return { items: pendingConfirmations(await readSupervisionViews(client, actorId)) };
}

export async function readTeach(client: AdminClient, actorId: string) {
  return parseTeachingResult(teachReadSchema, await teachingCommand(client, actorId, null, "teach.read"));
}

export async function readFeedbackOpen(client: AdminClient, actorId: string) {
  return parseTeachingResult(feedbackOpenSchema, await teachingCommand(client, actorId, null, "feedback.open"));
}

export async function readCpdReview(client: AdminClient, actorId: string, now: Date = new Date()) {
  return { rows: unloggedReviewRows(await readLogbook(client, actorId), now) };
}

/** One save per row, in order. Each is idempotent by request id and source_ref, so a retry never doubles. */
export async function saveCpdReview(
  client: AdminClient,
  actorId: string,
  body: CpdReviewBody,
): Promise<{ results: CpdReviewResult[] }> {
  const results: CpdReviewResult[] = [];
  for (const row of body.rows) {
    try {
      const saved = await saveTeachingCpdEntry(client, actorId, row);
      results.push({ occurrenceId: row.occurrenceId, entryId: saved.entryId, code: null, message: null });
    } catch (error) {
      if (!(error instanceof PublicApiError) || error.status >= 500) throw error;
      const code = error.details?.code ?? "teaching_invalid_request";
      results.push({ occurrenceId: row.occurrenceId, entryId: null, code, message: error.message });
    }
  }
  return { results };
}
