import "server-only";

import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";
import type { RosterAdminClient } from "@/lib/roster/team/api";
import { rosterRead } from "@/lib/roster/team/repository";

/** A roster request waits while its recipient is working a night now. */
export async function recipientsOnNightNow(
  client: RosterAdminClient,
  actorId: string,
  serviceId: string,
  recipients: readonly string[],
  now = new Date(),
): Promise<Set<string>> {
  const ids = new Set(recipients);
  if (!ids.size) return new Set();
  const instant = now.toISOString();
  const instantMs = now.getTime();
  const today = perthDateOf(now);
  const team = await rosterRead(client, actorId, serviceId, "assignments", {
    from: addDaysToDate(today, -1),
    to: addDaysToDate(today, 1),
  });
  const quiet = new Set(
    team.assignments
      .filter(
        (row) =>
          row.userId &&
          ids.has(row.userId) &&
          row.kind === "night" &&
          Date.parse(row.startsAt) <= instantMs &&
          Date.parse(row.endsAt) > instantMs,
      )
      .map((row) => row.userId!),
  );
  const { data, error } = await client
    .from("on_call_shifts")
    .select("owner_id")
    .in("owner_id", [...ids])
    .eq("kind", "night")
    .lte("starts_at", instant)
    .gt("ends_at", instant)
    .limit(500);
  if (error || !data) throw new Error("Night-shift check unavailable");
  for (const row of data) quiet.add(row.owner_id);
  return quiet;
}
