import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FactsheetDetailPage } from "@/components/factsheets/factsheet-detail-page";
import { findFactsheet } from "@/components/factsheets/factsheets-data";
import { savedFactsheetsStorageKey } from "@/lib/saved-registry-storage";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/**
 * Save moved out of the page's own action bar and into the shared header's
 * actions sheet, so reaching it now costs one disclosure. Returns the open
 * sheet so assertions stay scoped to it.
 */
async function openActionsSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Open factsheet actions" }));
  return screen.findByTestId("factsheet-actions-sheet");
}

describe("factsheet saved state", () => {
  it("persists a saved factsheet across remounts", async () => {
    const user = userEvent.setup();
    const factsheet = findFactsheet("sertraline");
    if (!factsheet) throw new Error("Expected the sertraline factsheet fixture");

    const first = render(<FactsheetDetailPage factsheet={factsheet} />);
    const sheet = await openActionsSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    // The sheet deliberately stays open: the control you pressed is the one
    // that has to show the new state.
    expect(within(sheet).getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem(savedFactsheetsStorageKey) ?? "[]")).toContain(factsheet.slug);
    first.unmount();

    render(<FactsheetDetailPage factsheet={factsheet} />);
    const reopened = await openActionsSheet(user);
    await waitFor(() =>
      expect(within(reopened).getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("announces a save failure inside the open actions sheet", async () => {
    // Denied storage must not rely on a live region in the inert page subtree
    // behind the open Sheet — assistive technology would hear nothing.
    const user = userEvent.setup();
    const factsheet = findFactsheet("sertraline");
    if (!factsheet) throw new Error("Expected the sertraline factsheet fixture");

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    render(<FactsheetDetailPage factsheet={factsheet} />);
    const sheet = await openActionsSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "Save" }));

    expect(
      within(sheet).getByText("Save failed. Check browser storage permissions and try again."),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
  });
});
