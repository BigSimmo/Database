import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TherapyFilterSheet } from "@/components/therapy-compass/filter-sheet";

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
