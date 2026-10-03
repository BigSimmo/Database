import type { RosterManageOpenShift, RosterManageSwap } from "@/lib/roster/team/model";

/**
 * What is waiting on the manager's decision, in the Inbox's order: swaps two
 * people agreed that need the manager, open shifts someone has taken, then
 * shifts someone has said they can't make.
 *
 * Kept apart from the Inbox itself so the "Manage" entry row on Settings can
 * show the same count from its own `manage` read without loading the tab.
 *
 * With `decisionsInStrip`, the calendar's Needs you strip is deciding swaps on
 * the same page and leaves out the reader's own (the server refuses them), so
 * they are left out here too and the two counts agree.
 */
export function managerWaiting(
  data: { swaps: readonly RosterManageSwap[]; openShifts: readonly RosterManageOpenShift[] },
  { decisionsInStrip = false, actorId = null }: { decisionsInStrip?: boolean; actorId?: string | null } = {},
) {
  const swaps = data.swaps.filter(
    (swap) =>
      swap.status === "accepted" &&
      (!decisionsInStrip || (swap.requesterId !== actorId && swap.counterpartyId !== actorId)),
  );
  const claimed = data.openShifts.filter((shift) => shift.status === "claimed");
  const reported = data.openShifts.filter((shift) => shift.status === "reported");
  return { swaps, claimed, reported, count: swaps.length + claimed.length + reported.length };
}

/** The words a waiting count is read as, on the badge and in the Inbox's section row. */
export function waitingWords(count: number): string {
  return `${count} waiting`;
}

/**
 * A small count pill beside "Manage" or "Inbox". The figure alone is shown;
 * a screen reader hears "3 waiting". Renders nothing when nothing is waiting.
 */
export function RosterWaitingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid="roster-waiting-badge"
      className="nums ml-2 inline-grid min-w-5 place-items-center rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-1.5 align-middle text-xs font-semibold text-[color:var(--warning-text)] forced-colors:border"
    >
      <span aria-hidden="true">{count}</span>
      {/* The leading space keeps "Manage 3 waiting" from reading as "Manage3". */}
      <span className="sr-only">{` ${waitingWords(count)}`}</span>
    </span>
  );
}
