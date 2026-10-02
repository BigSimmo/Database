/** The only information allowed on a phone's lock screen. */
export const ROSTER_ALERT_TYPES = ["changed", "request", "offer", "manage"] as const;
export type RosterAlertType = (typeof ROSTER_ALERT_TYPES)[number];

export const ROSTER_ALERT_MESSAGES: Readonly<Record<RosterAlertType, { text: string; path: string }>> = {
  changed: { text: "Your roster changed. Open Roster to see what moved.", path: "/roster" },
  request: { text: "Something in Roster is waiting for you.", path: "/roster/swaps" },
  offer: { text: "A shift is open in your team. Open Roster to see it.", path: "/roster/swaps" },
  manage: { text: "Something in Manage is waiting for you.", path: "/roster/manage" },
};
