import "server-only";
import type { RosterAdminClient } from "./api";
import { rosterCommand, rosterRead, rosterReadTeams } from "./repository";
import { perthDateOf } from "../shifts/perth-time";
import { rosterUnavailable } from "./errors";

/** Leave the team's historical assignments intact; withdraw only the actor's unfinished requests. */
export async function withdrawRosterRequests(client: RosterAdminClient, ownerId: string, now = new Date()) {
  const teams = await rosterReadTeams(client, ownerId);
  let skippedTeams = 0;
  for (const team of teams.filter((row) => row.enabled)) {
    try {
      const requests = await rosterRead(client, ownerId, team.serviceId, "requests");
      for (const swap of requests.swaps) {
        if (swap.requesterId === ownerId && ["requested", "accepted"].includes(swap.status))
          await rosterCommand(client, ownerId, team.serviceId, { action: "swap.cancel", swapId: swap.id });
        else if (swap.counterpartyId === ownerId && swap.status === "requested")
          await rosterCommand(client, ownerId, team.serviceId, { action: "swap.decline", swapId: swap.id });
      }
      for (const open of requests.openShifts.filter(
        (row) => row.mine && ["reported", "open", "claimed"].includes(row.status),
      ))
        await rosterCommand(client, ownerId, team.serviceId, { action: "open.cancel", openShiftId: open.id });
      // The ordinary RPC permits only a manager to decline an accepted swap or
      // a claim. Data deletion still has to release this actor's pending role.
      const { error: acceptedSwapError } = await client
        .from("roster_swaps")
        .update({
          status: "cancelled",
          cancel_reason: "member_left",
          decided_at: now.toISOString(),
          decided_by: ownerId,
        })
        .eq("service_id", team.serviceId)
        .eq("counterparty_id", ownerId)
        .eq("status", "accepted");
      if (acceptedSwapError) throw rosterUnavailable();
      const { error: claimError } = await client
        .from("roster_open_shifts")
        .update({ status: "open", claimed_by: null, claimed_at: null })
        .eq("service_id", team.serviceId)
        .eq("claimed_by", ownerId)
        .eq("status", "claimed");
      if (claimError) throw rosterUnavailable();
      // There is no date horizon in SQL; the per-member cap is 120 entries.
      const today = perthDateOf(now);
      const { data: dates, error } = await client
        .from("roster_unavailability")
        .select("on_date")
        .eq("user_id", ownerId)
        .eq("service_id", team.serviceId)
        .gte("on_date", today)
        .limit(120);
      if (error || !dates) throw rosterUnavailable();
      const clear = dates.map((row: { on_date: string }) => row.on_date);
      if (clear.length)
        await rosterCommand(client, ownerId, team.serviceId, { action: "unavailability.set", set: [], clear });
    } catch {
      skippedTeams++;
    }
  }
  return { skippedTeams };
}

export async function removeAllOwnerLeave(client: RosterAdminClient, ownerId: string) {
  const { error } = await client.from("roster_leave").delete().eq("owner_id", ownerId);
  if (error) throw rosterUnavailable();
}
