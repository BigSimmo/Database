/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FactsheetsTopicsPage } from "@/components/factsheets/factsheets-topics-page";
import {
  factsheetCategories,
  factsheetTopicQueryValue,
  factsheets,
  factsheetSlugs,
  topicSectionId,
} from "@/components/factsheets/factsheets-data";
import { OverlayRoot } from "@/components/ui/overlay-root";

describe("FactsheetsTopicsPage", () => {
  it("groups every sheet under the four topic headings and has no page-level search", () => {
    render(<FactsheetsTopicsPage />);

    const page = screen.getByTestId("factsheets-topics-page");
    expect(within(page).getByRole("heading", { level: 1, name: "Topics" })).toBeInTheDocument();
    expect(page.querySelector("input")).toBeNull();

    const chips = screen.getByTestId("factsheets-topics-chips");
    expect(within(chips).getByRole("link", { name: /All topics/ })).toHaveAttribute("aria-current", "page");
    expect(within(chips).getByRole("link", { name: /All topics/ })).toHaveAttribute("href", "/factsheets/topics");

    for (const category of factsheetCategories) {
      expect(screen.getByRole("heading", { level: 2, name: category })).toBeInTheDocument();
      expect(page.querySelector(`#${topicSectionId(category)}`)).not.toBeNull();
      const chip = within(chips).getByRole("link", { name: new RegExp(category) });
      expect(chip).toHaveAttribute("href", `/factsheets/topics?topic=${factsheetTopicQueryValue(category)}`);
    }

    expect(factsheetSlugs()).toHaveLength(factsheets.length);
    for (const sheet of factsheets) {
      const link = page.querySelector(`a[href="/factsheets/${sheet.slug}"]`);
      expect(link, sheet.slug).not.toBeNull();
      expect(link).toHaveTextContent(sheet.title);
    }
  });

  it("isolates one category when ?topic= is resolved", () => {
    render(<FactsheetsTopicsPage selectedTopic="Medications" />);

    const page = screen.getByTestId("factsheets-topics-page");
    expect(within(page).getByRole("heading", { level: 1, name: "Topics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Medications" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Conditions" })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("factsheets-topics-chips")).getByRole("link", { name: /Medications/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(page).toHaveTextContent("in Medications");
  });

  it("collapses long topic lists behind a Show all control", async () => {
    const user = userEvent.setup();
    render(<FactsheetsTopicsPage previewLimit={1} />);

    const medications = factsheets.filter((sheet) => sheet.category === "Medications");
    expect(medications.length).toBeGreaterThan(1);

    const section = screen.getByTestId(topicSectionId("Medications"));
    expect(within(section).getAllByTestId("factsheets-result")).toHaveLength(1);

    const toggle = screen.getByTestId("factsheets-topics-show-all-medications");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent(`Show all ${medications.length} in Medications`);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(section).getAllByTestId("factsheets-result")).toHaveLength(medications.length);
    expect(toggle).toHaveTextContent("Show fewer in Medications");
  });

  it("opens an overflow sheet when the topic index exceeds the chip budget", async () => {
    const user = userEvent.setup();
    render(
      <>
        <OverlayRoot />
        <FactsheetsTopicsPage chipOverflowAfter={2} />
      </>,
    );

    expect(screen.getByTestId("factsheets-topics-more")).toBeInTheDocument();
    await user.click(screen.getByTestId("factsheets-topics-more"));
    const sheet = screen.getByTestId("factsheets-topics-more-sheet");
    expect(within(sheet).getByRole("link", { name: /Therapies/ })).toHaveAttribute(
      "href",
      "/factsheets/topics?topic=therapies",
    );
  });
});
