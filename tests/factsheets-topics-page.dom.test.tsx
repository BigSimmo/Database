/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FactsheetsTopicsPage } from "@/components/factsheets/factsheets-topics-page";
import {
  factsheetCategories,
  factsheetTopicQueryValue,
  factsheets,
  topicSectionId,
} from "@/components/factsheets/factsheets-data";

describe("FactsheetsTopicsPage", () => {
  it("lists the four topics as a directory with no page-level search or chip rail", () => {
    render(<FactsheetsTopicsPage />);

    const page = screen.getByTestId("factsheets-topics-page");
    expect(within(page).getByRole("heading", { level: 1, name: "Topics" })).toBeInTheDocument();
    expect(page.querySelector("input")).toBeNull();
    expect(screen.queryByTestId("factsheets-topics-chips")).not.toBeInTheDocument();
    expect(page.querySelector('[class*="overflow-x-auto"]')).toBeNull();

    const directory = screen.getByTestId("factsheets-topics-directory");
    expect(page).toHaveTextContent("4 topics");
    expect(page).toHaveTextContent(`${factsheets.length} sheets`);

    for (const category of factsheetCategories) {
      expect(within(directory).getByRole("heading", { level: 2, name: new RegExp(category) })).toBeInTheDocument();
      const trigger = screen.getByTestId(`factsheets-topics-topic-${factsheetTopicQueryValue(category)}`);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }

    expect(screen.queryByTestId("factsheets-result")).not.toBeInTheDocument();
  });

  it("opens one topic at a time from the directory", async () => {
    const user = userEvent.setup();
    render(<FactsheetsTopicsPage />);

    await user.click(screen.getByTestId("factsheets-topics-topic-medications"));

    const medications = factsheets.filter((sheet) => sheet.category === "Medications");
    const conditions = factsheets.filter((sheet) => sheet.category === "Conditions");
    const section = screen.getByTestId(topicSectionId("Medications"));
    expect(screen.getByTestId("factsheets-topics-topic-medications")).toHaveAttribute("aria-expanded", "true");
    expect(within(section).getAllByTestId("factsheets-result")).toHaveLength(medications.length);
    for (const sheet of medications) {
      expect(section.querySelector(`a[href="/factsheets/${sheet.slug}"]`)).not.toBeNull();
    }
    expect(screen.queryByTestId(topicSectionId("Conditions"))).not.toBeInTheDocument();

    await user.click(screen.getByTestId("factsheets-topics-topic-conditions"));
    expect(screen.queryByTestId(topicSectionId("Medications"))).not.toBeInTheDocument();
    expect(within(screen.getByTestId(topicSectionId("Conditions"))).getAllByTestId("factsheets-result")).toHaveLength(
      conditions.length,
    );
  });

  it("opens the requested topic when ?topic= is resolved, without hiding the directory", () => {
    render(<FactsheetsTopicsPage selectedTopic="Medications" />);

    expect(screen.getByTestId("factsheets-topics-topic-medications")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("factsheets-topics-topic-conditions")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId(topicSectionId("Medications"))).toBeInTheDocument();
    expect(screen.queryByTestId(topicSectionId("Conditions"))).not.toBeInTheDocument();
    expect(screen.getByTestId("factsheets-topics-directory")).toBeInTheDocument();
  });

  it("updates the open topic when client navigation changes the selected topic", () => {
    const { rerender } = render(<FactsheetsTopicsPage selectedTopic="Medications" />);

    rerender(<FactsheetsTopicsPage selectedTopic="Conditions" />);

    expect(screen.getByTestId("factsheets-topics-topic-medications")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("factsheets-topics-topic-conditions")).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByTestId(topicSectionId("Medications"))).not.toBeInTheDocument();
    expect(screen.getByTestId(topicSectionId("Conditions"))).toBeInTheDocument();
  });

  it("collapses long topic lists behind a Show all control", async () => {
    const user = userEvent.setup();
    render(<FactsheetsTopicsPage selectedTopic="Medications" previewLimit={1} />);

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
});
