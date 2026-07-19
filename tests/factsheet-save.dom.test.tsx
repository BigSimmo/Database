import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FactsheetDetailPage } from "@/components/factsheets/factsheet-detail-page";
import { findFactsheet } from "@/components/factsheets/factsheets-data";
import { savedFactsheetsStorageKey } from "@/lib/saved-registry-storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("factsheet saved state", () => {
  it("persists a saved factsheet across remounts", async () => {
    const factsheet = findFactsheet("sertraline");
    if (!factsheet) throw new Error("Expected the sertraline factsheet fixture");

    const first = render(<FactsheetDetailPage factsheet={factsheet} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem(savedFactsheetsStorageKey) ?? "[]")).toContain(factsheet.slug);
    first.unmount();

    render(<FactsheetDetailPage factsheet={factsheet} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true"));
  });
});
