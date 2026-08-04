import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SearchRefineAdaptiveMockupsPage } from "@/components/search-refine-adaptive-mockups";

/**
 * The mockup itself is design scratch and deliberately untested for layout —
 * it will churn. This one behaviour is not layout: a search that fails while
 * focus is elsewhere must still reach the user.
 *
 * The shipped band (`search-results-header-band.tsx`) sets `aria-live="off"`
 * when faulted, so the `searching → error` transition is silent: a screen-reader
 * user is left waiting on a result that is not coming and never learns Retry
 * appeared. This asserts the mockup escalates instead of muting, so the
 * behaviour cannot be lost when the direction is promoted to production.
 */
describe("adaptive refine bar mockup — failure announcement", () => {
  it("announces politely while searching and assertively once the search fails", async () => {
    const user = userEvent.setup();
    render(<SearchRefineAdaptiveMockupsPage />);

    await user.click(screen.getByRole("button", { name: "Searching" }));

    // In flight, the count is a polite status: it must not interrupt whatever
    // the user is reading.
    const inFlight = screen.getAllByRole("status");
    expect(inFlight.length).toBeGreaterThan(0);
    for (const region of inFlight) {
      expect(region).toHaveAttribute("aria-live", "polite");
    }

    await user.click(screen.getByRole("button", { name: "Failed" }));

    // On failure the same region escalates to an assertive alert — never to
    // aria-live="off", which is the regression this test exists to catch.
    const failed = screen.getAllByRole("alert");
    expect(failed.length).toBeGreaterThan(0);
    for (const region of failed) {
      expect(region).toHaveAttribute("aria-live", "assertive");
      expect(region).toHaveTextContent(/Couldn’t search/);
    }
    expect(screen.queryAllByRole("status")).toHaveLength(0);

    // The recovery affordance the announcement is telling the user about.
    expect(screen.getAllByRole("button", { name: "Retry" }).length).toBeGreaterThan(0);
  });
});
