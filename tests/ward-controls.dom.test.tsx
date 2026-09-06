import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WardFilters, WardSegmented } from "@/components/ward-management/ward-controls";

/**
 * ⚠️ THE COUNT ON A FILTER PILL IS NOT DECORATION. Without it a reader cannot tell how much of the
 * list the filter removed, and on these screens that is the difference between "nobody is waiting
 * on transport today" and "you filtered them out". So the count is required by the type, and it is
 * announced as part of the button's accessible name rather than sitting beside it as an unread
 * decoration.
 *
 * ⚠️ AND AN `activeId` MATCHING NO OPTION IS THE FAILURE THAT LOOKS FINE: every pill renders
 * unpressed, so the bar reads as "no filter applied" while a filter is in fact applied and the list
 * below is short for a reason nobody can see. Both controls refuse it.
 */
const OPTIONS = [
  { id: "all", label: "People waiting", count: 43 },
  { id: "wards", label: "Wards not freeing beds", count: 7 },
  { id: "done", label: "Resolved today", count: 11 },
];

describe("WardFilters", () => {
  it("shows every count, because a filter with no count hides how much it removes", () => {
    render(<WardFilters legend="Show" options={OPTIONS} activeId="all" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "People waiting 43" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Resolved today 11" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the id it was given, not an index", async () => {
    const onChange = vi.fn();
    render(<WardFilters legend="Show" options={OPTIONS} activeId="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Resolved today 11" }));
    expect(onChange).toHaveBeenCalledWith("done");
  });

  it("refuses an activeId that matches no option", () => {
    expect(() => render(<WardFilters legend="Show" options={OPTIONS} activeId="nope" onChange={() => {}} />)).toThrow(
      /matches no option/u,
    );
  });
});

describe("WardSegmented", () => {
  it("presses exactly one option", () => {
    render(
      <WardSegmented
        legend="As at"
        options={[
          { id: "now", label: "Now" },
          { id: "morning", label: "This morning" },
        ]}
        activeId="morning"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "This morning" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Now" })).toHaveAttribute("aria-pressed", "false");
  });

  it("refuses an activeId that matches no option, the same way the filters do", () => {
    expect(() =>
      render(
        <WardSegmented legend="As at" options={[{ id: "now", label: "Now" }]} activeId="later" onChange={() => {}} />,
      ),
    ).toThrow(/matches no option/u);
  });
});
