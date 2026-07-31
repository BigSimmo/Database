import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapyFilterSheet, TherapyFilterTrigger } from "@/components/therapy-compass/filter-sheet";

const baseProps = {
  open: true,
  panelId: "therapy-filter-panel-test",
  onClose: vi.fn(),
  topics: ["CBT", "Anxiety"] as const,
  activeTopics: [] as string[],
  onToggleTopic: vi.fn(),
  reviewedOnly: false,
  onToggleReviewed: vi.fn(),
  briefOnly: false,
  onToggleBrief: vi.fn(),
  onClear: vi.fn(),
  resultCount: 3,
};

describe("TherapyFilterSheet Clear all", () => {
  // `baseProps` holds module-level mocks, so call counts would otherwise leak
  // between cases.
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows Clear all when only a search query is active", () => {
    // Phone Clear lives in this sheet; wide always has a ribbon Clear. Omitting
    // the query from activeCount hid Clear all for the common query-only case.
    render(<TherapyFilterSheet {...baseProps} query="cbt" />);

    expect(screen.getByTestId("therapy-filter-clear")).toBeInTheDocument();
    expect(screen.getByTestId("therapy-filter-clear")).toHaveTextContent("Clear all");
  });

  it("hides Clear all when nothing is narrowing results", () => {
    render(<TherapyFilterSheet {...baseProps} query="   " />);

    expect(screen.queryByTestId("therapy-filter-clear")).toBeNull();
  });

  it("invokes onClear from Clear all in the query-only state", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<TherapyFilterSheet {...baseProps} query="anxiety" onClear={onClear} />);

    await user.click(screen.getByTestId("therapy-filter-clear"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("TherapyFilterTrigger badge", () => {
  // The badge is labelled "N filters active". A search term is not a filter, so
  // it must not be counted here even though it counts toward the sheet's Clear
  // all. Counting it made the trigger announce "1 filter active" on a plain
  // search with nothing filtered — a control describing a state the page is not
  // in, which is the same class of defect this screen's sheet replaced.
  const triggerProps = { panelId: "p", open: false, onToggle: vi.fn() };

  it("announces no filters when only a query is present", () => {
    render(<TherapyFilterTrigger {...triggerProps} activeCount={0} />);

    expect(screen.getByTestId("therapy-filter-trigger")).toHaveAccessibleName(/No filters active/);
    expect(screen.getByTestId("therapy-filter-trigger")).not.toHaveTextContent(/\b1\b/);
  });

  it("counts real filters", () => {
    render(<TherapyFilterTrigger {...triggerProps} activeCount={2} />);

    expect(screen.getByTestId("therapy-filter-trigger")).toHaveAccessibleName(/2 filters active/);
  });
});
