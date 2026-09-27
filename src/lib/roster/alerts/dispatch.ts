import type { RosterAdminClient } from "@/lib/roster/team/api";
import type { RosterAction } from "@/lib/roster/team/model";

/**
 * Phone alerts for a team change. Called after the response is sent, so it
 * never slows or fails the change itself. The alerts lane fills this in;
 * until then it does nothing.
 */
export type RosterAlertEvent = {
  readonly serviceId: string;
  readonly actorId: string;
  readonly action: RosterAction | { readonly action: "publish" } | { readonly action: "remind" };
  readonly result: unknown;
  /** `open.decline` clears the claimer in SQL, so the route reads it first. */
  readonly before?: { readonly claimedBy: string | null };
};

export async function dispatchRosterAlerts(client: RosterAdminClient, event: RosterAlertEvent): Promise<void> {
  void client;
  void event;
}
