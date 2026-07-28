import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("keeps section navigation aligned with the visible reading level", async () => {
    const factsheet = findFactsheet("sertraline");
    if (!factsheet) throw new Error("Expected the sertraline factsheet fixture");

    render(<FactsheetDetailPage factsheet={factsheet} />);
    const navigation = screen.getByRole("navigation", { name: "On this factsheet" });
    expect(within(navigation).getByRole("link", { name: "At a glance" })).toHaveAttribute(
      "href",
      "#factsheet-at-a-glance",
    );
    expect(document.getElementById("factsheet-at-a-glance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Standard" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Standard" })).toHaveAttribute("aria-pressed", "true"),
    );

    for (const link of within(navigation).getAllByRole("link")) {
      const targetId = link.getAttribute("href")?.slice(1);
      expect(targetId).toBeTruthy();
      expect(document.getElementById(targetId ?? "")).toBeInTheDocument();
    }
  });
});
