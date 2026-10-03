import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { managerWaiting, RosterWaitingBadge } from "@/components/roster/manage/roster-manage-waiting";
import type { RosterManageOpenShift, RosterManageSwap } from "@/lib/roster/team/model";

/* The manager's waiting count, shared by the Inbox, Today and the Settings "Manage" row. Invented data only. */

afterEach(cleanup);

const swap = (id: string, status: string, requesterId = "sam", counterpartyId = "noor") =>
  ({ id, status, requesterId, counterpartyId }) as unknown as RosterManageSwap;
const open = (id: string, status: string) => ({ id, status }) as unknown as RosterManageOpenShift;

describe("managerWaiting", () => {
  it("counts agreed swaps, taken shifts and shifts someone can't make, nothing else", () => {
    const waiting = managerWaiting({
      swaps: [swap("a", "accepted"), swap("b", "approved"), swap("c", "pending")],
      openShifts: [open("d", "claimed"), open("e", "reported"), open("f", "open")],
    });
    expect(waiting.count).toBe(3);
    expect(waiting.swaps.map((row) => row.id)).toEqual(["a"]);
  });

  it("leaves out the reader's own swaps while the strip decides them, so the two counts agree", () => {
    const data = { swaps: [swap("a", "accepted", "alex"), swap("b", "accepted")], openShifts: [] };
    expect(managerWaiting(data).count).toBe(2);
    expect(managerWaiting(data, { decisionsInStrip: true, actorId: "alex" }).count).toBe(1);
  });
});

describe("RosterWaitingBadge", () => {
  it("shows the figure and is read as 'N waiting'", () => {
    render(<RosterWaitingBadge count={3} />);
    expect(screen.getByTestId("roster-waiting-badge")).toHaveTextContent("3 waiting");
  });

  it("renders nothing when nothing is waiting", () => {
    const { container } = render(<RosterWaitingBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
