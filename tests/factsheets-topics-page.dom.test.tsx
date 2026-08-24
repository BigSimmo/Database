/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FactsheetsTopicsPage } from "@/components/factsheets/factsheets-topics-page";
import { factsheetCategories, factsheets, factsheetSlugs } from "@/components/factsheets/factsheets-data";

describe("FactsheetsTopicsPage", () => {
  it("groups every sheet under the four topic headings and has no page-level search", () => {
    render(<FactsheetsTopicsPage />);

    const page = screen.getByTestId("factsheets-topics-page");
    expect(within(page).getByRole("heading", { level: 1, name: "Topics" })).toBeInTheDocument();
    expect(page.querySelector("input")).toBeNull();

    for (const category of factsheetCategories) {
      expect(screen.getByRole("heading", { level: 2, name: category })).toBeInTheDocument();
    }

    expect(factsheetSlugs()).toHaveLength(factsheets.length);
    for (const sheet of factsheets) {
      const link = page.querySelector(`a[href="/factsheets/${sheet.slug}"]`);
      expect(link, sheet.slug).not.toBeNull();
      expect(link).toHaveTextContent(sheet.title);
    }
  });
});
