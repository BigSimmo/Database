import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The owner asked the urgent flag to do TWO things: sort to the top, and be VISIBLE.
 *
 * `tests/ward-priority.test.ts` proves the first. This proves the second, and it is not a
 * formality: the flag moves a tier-3 patient with the shortest wait on the board above every
 * tier-1 patient who has waited hours. A coordinator looking at that row with nothing on it to
 * explain the position is being shown a queue that appears to be wrong. The ordering without the
 * label is the worse half of the feature, not half of it.
 */
describe("the urgent flag is visible on the row it moved", () => {
  function renderQueue() {
    render(
      <PriorityQueue
        movements={wardMovements}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
  }

  it("labels the flagged row, in the queue, where the ordering is read", () => {
    renderQueue();
    const flag = screen.getByTestId("ward-queue-flag-WF-018");
    expect(flag).toBeInTheDocument();
    expect(flag, "the label must say what it means, not just colour the row").toHaveTextContent(/flagged urgent/i);
  });

  it("labels ONLY the flagged rows, so the mark still means something", () => {
    renderQueue();
    const flagged = wardMovements.filter((movement) => movement.flaggedUrgent).map((movement) => movement.id);
    expect(flagged.length, "the fixture must carry a flagged movement for this to test anything").toBeGreaterThan(0);

    const unflagged = queueOrder(wardMovements, NOW_ANCHOR).filter((movement) => !movement.flaggedUrgent);
    expect(unflagged.length).toBeGreaterThan(1);
    for (const movement of unflagged) {
      expect(
        screen.queryByTestId(`ward-queue-flag-${movement.id}`),
        `${movement.id} is not flagged but carries the flag label — a mark on everybody marks nobody`,
      ).not.toBeInTheDocument();
    }
  });

  it("shows the flag on the row that LEADS, which is the whole point of showing it", () => {
    renderQueue();
    const leader = queueOrder(wardMovements, NOW_ANCHOR)[0];
    expect(leader.flaggedUrgent, "precondition: the flagged movement leads the queue").toBe(true);
    // The label and the position must be on the same row. A flag rendered somewhere else on the
    // screen would satisfy a naive "is it visible" check while explaining nothing about the order.
    const row = screen.getByTestId(`ward-queue-row-${leader.id}`);
    expect(row).toHaveTextContent(/flagged urgent/i);
    expect(row, "and the row must still say the tier it would otherwise have been ranked by").toHaveTextContent(
      /tier 3/i,
    );
  });
});
