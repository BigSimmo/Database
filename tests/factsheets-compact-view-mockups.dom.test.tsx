import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FactsheetsCompactViewMockupsPage } from "@/components/factsheets/factsheets-compact-view-mockups";

const SPECIMEN_COUNT = 5;

function advertisedMatchCount(option: HTMLElement): number {
  const count = option.querySelector(".search-band-count");
  if (!count?.textContent) throw new Error("Expected a search band match count");
  return Number.parseInt(count.textContent, 10);
}

function renderedResultCount(results: HTMLElement): number {
  return results.querySelectorAll("[data-factsheet-result]").length;
}

describe("factsheets compact view mockups", () => {
  it("renders every specimen when the comfortable list advertises the full match count", async () => {
    const user = userEvent.setup();
    render(<FactsheetsCompactViewMockupsPage />);

    const optionA = screen.getByTestId("option-a");
    await user.click(within(optionA).getByRole("button", { name: "List" }));

    const results = within(optionA).getByLabelText("Factsheet results");
    expect(advertisedMatchCount(optionA)).toBe(SPECIMEN_COUNT);
    expect(renderedResultCount(results)).toBe(SPECIMEN_COUNT);
    expect(results).toHaveAttribute("data-list-variant", "comfortable");
  });

  it("switches card density when compact is off in option B", async () => {
    const user = userEvent.setup();
    render(<FactsheetsCompactViewMockupsPage />);

    const optionB = screen.getByTestId("option-b");
    await user.click(within(optionB).getByRole("button", { name: "Cards" }));
    const results = within(optionB).getByLabelText("Factsheet results");
    expect(results).toHaveAttribute("data-card-variant", "compact");

    await user.click(within(optionB).getByRole("button", { name: "Compact density on" }));
    const comfortableResults = within(optionB).getByLabelText("Factsheet results");
    expect(comfortableResults).toHaveAttribute("data-card-variant", "comfortable");
    expect(advertisedMatchCount(optionB)).toBe(SPECIMEN_COUNT);
    expect(renderedResultCount(comfortableResults)).toBe(SPECIMEN_COUNT);
  });

  it("switches card density in option D nested controls", async () => {
    const user = userEvent.setup();
    render(<FactsheetsCompactViewMockupsPage />);

    const optionD = screen.getByTestId("option-d");
    await user.click(within(optionD).getByRole("button", { name: "Cards" }));
    const results = within(optionD).getByLabelText("Factsheet results");
    expect(results).toHaveAttribute("data-card-variant", "compact");

    await user.click(within(optionD).getByRole("button", { name: "Comfortable" }));
    const comfortableResults = within(optionD).getByLabelText("Factsheet results");
    expect(comfortableResults).toHaveAttribute("data-card-variant", "comfortable");
    expect(advertisedMatchCount(optionD)).toBe(SPECIMEN_COUNT);
    expect(renderedResultCount(comfortableResults)).toBe(SPECIMEN_COUNT);
  });
});
