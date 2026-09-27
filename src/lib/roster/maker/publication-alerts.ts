import "server-only";
import type { z } from "zod";
import type { RosterAdminClient } from "@/lib/roster/team/api";
import { activeRecipientIds } from "@/lib/roster/alerts/recipients";
import { sendRosterAlerts, webPushConfigured } from "@/lib/roster/alerts/send";
import type { rosterMakerPublicationReceiptSchema } from "./workflow-model";

/** Only a validated first publication receipt can cause generic change alerts. */
export async function sendMakerPublicationAlerts(
  client: RosterAdminClient,
  actorId: string,
  serviceId: string,
  receipt: z.infer<typeof rosterMakerPublicationReceiptSchema>,
) {
  if (receipt.replayed) return { status: "not_retried" as const, sent: 0, skipped: 0, failed: 0 };
  if (!webPushConfigured()) return { status: "not_configured" as const, sent: 0, skipped: 0, failed: 0 };
  const recipients = [
    ...new Set([
      ...receipt.changedUserIds,
      ...receipt.swapsCancelled.flatMap((swap) => [swap.requesterId, swap.counterpartyId]),
    ]),
  ].filter((id) => id !== actorId);
  const totals = { sent: 0, skipped: 0, failed: 0 };
  try {
    const active = await activeRecipientIds(client, serviceId, recipients);
    const eligible = recipients.filter((id) => active.has(id));
    totals.skipped = recipients.length - eligible.length;
    for (let offset = 0; offset < eligible.length; offset += 500) {
      const part = await sendRosterAlerts(client, eligible.slice(offset, offset + 500), "changed");
      totals.sent += part.sent;
      totals.skipped += part.skipped;
      totals.failed += part.failed;
    }
    return {
      ...totals,
      status: totals.failed ? (totals.sent ? ("partial" as const) : ("failed" as const)) : ("processed" as const),
    };
  } catch {
    totals.failed += Math.max(1, recipients.length - totals.sent - totals.skipped - totals.failed);
    return { ...totals, status: totals.sent ? ("partial" as const) : ("failed" as const) };
  }
}
