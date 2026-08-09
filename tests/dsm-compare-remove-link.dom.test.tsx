import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DsmCompareRemoveLink } from "@/components/dsm/dsm-compare-remove-link";

describe("DsmCompareRemoveLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("assigns the href on click so same-route search-param removals cannot stall", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    render(
      <DsmCompareRemoveLink
        href="/dsm/compare?ids=bipolar-ii-disorder"
        aria-label="Remove Major depressive disorder from comparison"
      >
        Remove
      </DsmCompareRemoveLink>,
    );

    const link = screen.getByRole("link", { name: "Remove Major depressive disorder from comparison" });
    fireEvent.click(link);

    expect(assign).toHaveBeenCalledWith("/dsm/compare?ids=bipolar-ii-disorder");
  });
});
