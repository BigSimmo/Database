import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { postChatNotification, type ChatSeverity } from "@/lib/webhooks/chat-notify";
import { verifyWebhookSecret } from "@/lib/webhooks/secret-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receiver for Railway project deploy webhooks. Railway can only be configured
// with a target URL (no custom headers or signing), so the shared secret travels
// as `?token=` on the configured webhook URL and is compared constant-time. The
// route forwards notable deploy status changes for the app + worker services to
// Slack/Discord — the piece GitHub cannot report, since it does not know Railway's
// deploy outcome. See docs/webhooks.md for setup.

const namedEntitySchema = z.object({ name: z.string().optional() }).passthrough();

const railwayWebhookSchema = z
  .object({
    type: z.string().optional(),
    status: z.string().optional(),
    timestamp: z.string().optional(),
    project: namedEntitySchema.optional(),
    environment: namedEntitySchema.optional(),
    service: namedEntitySchema.optional(),
    deployment: z
      .object({ id: z.string().optional(), meta: z.record(z.string(), z.unknown()).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Only forward status changes worth a ping; transient build/deploy phases are
// dropped to keep the channel quiet.
const NOTABLE_STATUSES = new Set(["SUCCESS", "FAILED", "CRASHED", "REMOVED"]);

function severityForStatus(status: string): ChatSeverity {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED" || status === "CRASHED") return "error";
  if (status === "REMOVED") return "warning";
  return "info";
}

function serviceName(payload: z.infer<typeof railwayWebhookSchema>): string {
  const fromService = payload.service?.name;
  if (typeof fromService === "string" && fromService) return fromService;
  const fromMeta = payload.deployment?.meta?.["serviceName"];
  if (typeof fromMeta === "string" && fromMeta) return fromMeta;
  return "unknown service";
}

export async function POST(request: Request) {
  try {
    const auth = verifyWebhookSecret(request, env.RAILWAY_WEBHOOK_SECRET, { allowQueryToken: true });
    if (!auth.ok) {
      if (auth.reason === "misconfigured") {
        return NextResponse.json(
          { error: "Railway webhook receiver is not configured.", code: "webhook_not_configured" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = railwayWebhookSchema.safeParse(rawBody);
    if (!parsed.success) {
      // Authenticated but unrecognised shape: accept so Railway does not retry,
      // and record it for debugging.
      logger.warn("Railway webhook payload did not match expected shape");
      return NextResponse.json({ skipped: true, reason: "unrecognized_payload" });
    }

    const payload = parsed.data;
    const status = (payload.status ?? "").toUpperCase();
    if (!NOTABLE_STATUSES.has(status)) {
      return NextResponse.json({ skipped: true, reason: "status_not_notable", status });
    }

    const project = payload.project?.name ?? "Railway project";
    const environment = payload.environment?.name ?? "unknown environment";
    const service = serviceName(payload);
    const severity = severityForStatus(status);

    const delivery = await postChatNotification({
      title: `Railway deploy ${status.toLowerCase()}: ${service}`,
      text: `Deploy of *${service}* in *${project}* (${environment}) reported status *${status}*.`,
      severity,
      fields: [
        { label: "Project", value: project },
        { label: "Environment", value: environment },
        { label: "Service", value: service },
        { label: "Status", value: status },
      ],
    });

    return NextResponse.json({ forwarded: delivery.delivered, delivery });
  } catch (error) {
    return jsonError(error);
  }
}
