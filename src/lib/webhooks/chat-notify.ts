import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeErrorLogDetails } from "@/lib/privacy";

// Outbound chat forwarder shared by the /api/webhooks/* receivers. Posts a single
// notification to whichever of Slack / Discord incoming webhooks are configured via
// env (SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL). It NEVER throws: a webhook receiver
// must still return 2xx to its provider even when a downstream chat post fails, so
// delivery problems are logged and reported in the return value instead.

export type ChatSeverity = "info" | "success" | "warning" | "error";

export type ChatNotification = {
  title: string;
  text: string;
  severity?: ChatSeverity;
  fields?: { label: string; value: string }[];
  // Optional context link (e.g. a Railway deploy or GitHub run URL).
  url?: string;
};

export type ChatChannelResult = { configured: boolean; ok: boolean; status?: number };

export type ChatDeliveryResult = {
  delivered: boolean;
  slack: ChatChannelResult;
  discord: ChatChannelResult;
};

const CHAT_POST_TIMEOUT_MS = 5_000;
const DISCORD_CONTENT_LIMIT = 2_000;

const severityEmoji: Record<ChatSeverity, string> = {
  info: "🔵",
  success: "✅",
  warning: "⚠️",
  error: "🔴",
};

function renderPlainMessage(notification: ChatNotification): string {
  const severity = notification.severity ?? "info";
  const lines = [`${severityEmoji[severity]} *${notification.title}*`, notification.text];
  for (const field of notification.fields ?? []) {
    lines.push(`• *${field.label}:* ${field.value}`);
  }
  if (notification.url) lines.push(notification.url);
  return lines.filter(Boolean).join("\n");
}

async function postJson(url: string, body: unknown): Promise<ChatChannelResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CHAT_POST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn("Chat webhook delivery failed", { status: response.status });
    }
    return { configured: true, ok: response.ok, status: response.status };
  } catch (error) {
    logger.warn("Chat webhook delivery errored", { ...safeErrorLogDetails(error) });
    return { configured: true, ok: false };
  }
}

export async function postChatNotification(notification: ChatNotification): Promise<ChatDeliveryResult> {
  const message = renderPlainMessage(notification);
  const severity = notification.severity ?? "info";

  const slackUrl = env.SLACK_WEBHOOK_URL;
  const discordUrl = env.DISCORD_WEBHOOK_URL;

  if (!slackUrl && !discordUrl) {
    // With no destination configured the notification is discarded right here, and until this
    // block existed it was discarded in complete silence: the receiver still answered its
    // provider `200 { "forwarded": false }`, which is indistinguishable from a healthy delivery
    // to anything watching from outside.
    //
    // That is not hypothetical. Between 2026-09-11 and 2026-09-14, 24 consecutive production
    // deploys failed their healthcheck and were rolled back. Each one reached this function at
    // `error` severity, neither variable was set on either Railway service, and every alert was
    // dropped on this line. The outage ran for three days and was found by noticing a missing UI
    // change, not by being told. `docs/webhooks.md` had already described this precise gap in
    // prose; documenting it did not prevent it, so it is reported at runtime instead.
    //
    // For anything warning-or-worse that means `logger.error`, which the logger forwards to
    // privacy-scrubbed Sentry Logs — a destination that does not depend on the variable that is
    // missing. The log self-clears the moment either webhook URL is set.
    const level = severity === "error" || severity === "warning" ? "error" : "info";
    logger[level]("Chat notification discarded: no SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL is configured", {
      notificationTitle: notification.title,
      severity,
    });
  }

  const [slack, discord] = await Promise.all([
    slackUrl
      ? // Slack incoming webhooks render `mrkdwn` in `text`.
        postJson(slackUrl, { text: message })
      : Promise.resolve<ChatChannelResult>({ configured: false, ok: false }),
    discordUrl
      ? // Discord webhooks cap `content` at 2000 chars.
        postJson(discordUrl, { content: message.slice(0, DISCORD_CONTENT_LIMIT) })
      : Promise.resolve<ChatChannelResult>({ configured: false, ok: false }),
  ]);

  return { delivered: (slack.configured && slack.ok) || (discord.configured && discord.ok), slack, discord };
}
