import type { RosterOpenShift, RosterSwap } from "@/lib/roster/team/model";

/** Plain status labels for a request visible to its team. */
export function requestStatusWords(item: RosterSwap | RosterOpenShift, me: string, now = new Date()): string {
  if ("requesterId" in item) {
    switch (item.status) {
      case "requested":
        return item.counterpartyId === me ? "Needs you" : `Waiting for ${item.counterpartyName || "your colleague"}`;
      case "accepted":
        return "Waiting for your manager";
      case "approved":
        return item.autoApproved && item.decidedAt && now.getTime() < Date.parse(item.decidedAt) + 600_000
          ? "Approved itself"
          : "Approved";
      case "declined":
        return "Declined";
      case "expired":
        return "Expired";
      case "undone":
        return "Undone";
      case "cancelled":
        return {
          withdrawn: "Withdrawn",
          roster_changed: "Cancelled: the roster changed",
          member_left: "Cancelled: they left the team",
          no_longer_fits: "Cancelled: it no longer fits",
        }[item.cancelReason || "withdrawn"];
    }
  }
  switch (item.status) {
    case "reported":
      return "Your manager has been told";
    case "open":
      return item.mine ? "Offered to your team" : "Open to take";
    case "claimed":
      return "Waiting for your manager";
    case "approved":
      return "Taken";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
  }
}
