import type { RosterManageSwap, RosterSwap } from "./model";

/**
 * Where a swap has got to, in plain steps, and who it is waiting on. "Manager
 * approved" is a step only for a swap that needs the manager. A swap that is
 * still `requested` after its `expiresAt` reads as Expired and offers no
 * Accept; the server marks it expired on its next sweep, but the reader should
 * not be offered a swap that can no longer be accepted.
 */

export type SwapStep = {
  label: "Requested" | "Accepted" | "Manager approved" | "Done";
  state: "done" | "current" | "todo";
};

type Ended = null | "Declined" | "Cancelled" | "Expired" | "Undone";
type Tab = "needs_you" | "sent" | "history";

function steps(needsManager: boolean, done: number, current: number | null): SwapStep[] {
  const labels: SwapStep["label"][] = needsManager
    ? ["Requested", "Accepted", "Manager approved", "Done"]
    : ["Requested", "Accepted", "Done"];
  return labels.map((label, index) => ({
    label,
    state: index < done ? "done" : index === current ? "current" : "todo",
  }));
}

export function swapProgress(
  swap: RosterSwap | RosterManageSwap,
  meId: string,
  now: Date,
): { steps: SwapStep[]; waitingOn: string | null; ended: Ended; tab: Tab } {
  const needsManager = swap.needsManagerBecause !== null;
  const iAmCounterparty = swap.counterpartyId === meId;
  const iAmInvolved = iAmCounterparty || swap.requesterId === meId;
  const ended = (label: NonNullable<Ended>, done: number) => ({
    steps: steps(needsManager, done, null),
    waitingOn: null,
    ended: label,
    tab: "history" as const,
  });

  switch (swap.status) {
    case "requested": {
      if ("expiresAt" in swap && Date.parse(swap.expiresAt) <= now.getTime()) return ended("Expired", 1);
      return {
        steps: steps(needsManager, 1, 1),
        waitingOn: iAmCounterparty ? "You" : (swap.counterpartyName ?? "Your colleague"),
        ended: null,
        tab: iAmCounterparty ? "needs_you" : "sent",
      };
    }
    case "accepted": {
      return {
        steps: steps(needsManager, 2, 2),
        waitingOn: needsManager ? (iAmInvolved ? "Your manager" : "You") : null,
        ended: null,
        tab: needsManager && !iAmInvolved ? "needs_you" : "sent",
      };
    }
    case "approved":
      return {
        steps: steps(needsManager, needsManager ? 4 : 3, null),
        waitingOn: null,
        ended: null,
        tab: "history",
      };
    case "declined":
      return ended("Declined", 1);
    case "cancelled":
      return ended("Cancelled", 1);
    case "expired":
      return ended("Expired", 1);
    case "undone":
      return ended("Undone", needsManager ? 3 : 2);
  }
}
