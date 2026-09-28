import "server-only";

import webpush from "web-push";

import { env } from "@/lib/env";
import { fetchRosterSettings } from "@/lib/roster/settings";
import type { RosterAdminClient } from "@/lib/roster/team/api";

import type { RosterAlertType } from "./messages";
import { removeGoneSubscription, subscriptionsForOwners } from "./subscriptions";

export function webPushConfigured(): boolean {
  return !!(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY && env.WEB_PUSH_SUBJECT);
}

/** Send type codes only; never log an endpoint, person, title or payload. */
export async function sendRosterAlerts(
  client: RosterAdminClient,
  recipientIds: readonly string[],
  type: RosterAlertType,
  quiet = new Set<string>(),
): Promise<{ sent: number; skipped: number; failed: number }> {
  const totals = { sent: 0, skipped: 0, failed: 0 };
  if (!webPushConfigured() || !recipientIds.length) return totals;
  const unique = [...new Set(recipientIds)].slice(0, 500);
  webpush.setVapidDetails(env.WEB_PUSH_SUBJECT!, env.WEB_PUSH_PUBLIC_KEY!, env.WEB_PUSH_PRIVATE_KEY!);
  const enabled = new Set<string>();
  for (const ownerId of unique) {
    try {
      const settings = await fetchRosterSettings(client, ownerId);
      if (
        (type === "changed" ? settings.alerts.changes : settings.alerts.requests) &&
        (type === "changed" || !quiet.has(ownerId))
      ) {
        enabled.add(ownerId);
      } else totals.skipped += 1;
    } catch {
      totals.failed += 1;
    }
  }
  if (!enabled.size) return totals;
  const rows = await subscriptionsForOwners(client, [...enabled]);
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ t: type }),
        { TTL: 6 * 60 * 60 },
      );
      totals.sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) await removeGoneSubscription(client, row).catch(() => {});
      totals.failed += 1;
    }
  }
  return totals;
}
