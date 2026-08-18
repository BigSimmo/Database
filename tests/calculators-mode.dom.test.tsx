/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  redirect: navigation.redirect,
}));

import CalculatorsRoute from "@/app/(search-app)/calculators/page";
import CalculatorsSearchRoute from "@/app/(search-app)/calculators/search/page";
import {
  calculatorDomainCandidateCount,
  calculatorProgressCandidateCount,
  calculatorTimeCandidateCount,
  filterCalculatorRecords,
  type CalculatorFilterRecord,
  type CalculatorFilterState,
} from "@/components/calculators/calculator-filters";
import { calculators, type CalculatorFixture } from "@/components/calculators/calculator-fixtures";
import { CalculatorsHomePage } from "@/components/calculators/home-page";
import { CalculatorsSearchPage } from "@/components/calculators/search-page";
import { deriveCalculator, type AnswerMap } from "@/components/calculators/calculator-ui";
import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";

function completeAnswers(calc: CalculatorFixture): AnswerMap {
  return Object.fromEntries(calc.items.map((item) => [item.id, 0]));
}

function recordsWithProgress(): CalculatorFilterRecord[] {
  return calculators.map((calc) => {
    const answers = calc.id === "gad7" ? completeAnswers(calc) : calc.id === "phq9" ? { p1: 1 } : {};
    return { calc, derived: deriveCalculator(calc, answers) };
  });
}

const emptyFilters = (): CalculatorFilterState => ({
  domains: new Set(),
  progress: "all",
  time: "all",
});

describe("calculator mode routing", () => {
  /*
   * Calculators has no home page of its own any more: `/calculators` redirects to
   * the shared lightweight home and results moved to `/calculators/search`. These
   * cases pin that split, because routing a submitted query back at the bare path
   * would bounce through the redirect and loop.
   */
  it("forwards the bare path to the shared home", () => {
    navigation.redirect.mockClear();
    expect(() => CalculatorsRoute()).toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith("/?mode=calculators");
  });

  it("renders results only once a non-empty search is submitted", async () => {
    navigation.redirect.mockClear();
    await expect(CalculatorsSearchRoute({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenLastCalledWith("/?mode=calculators");

    await expect(CalculatorsSearchRoute({ searchParams: Promise.resolve({ run: "1", q: "  " }) })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenLastCalledWith("/?mode=calculators");

    const results = await CalculatorsSearchRoute({
      searchParams: Promise.resolve({ run: "1", q: " depression " }),
    });
    expect(results.type).toBe(CalculatorsSearchPage);
    expect(results.props.initialQuery).toBe("depression");
  });

  it("normalizes the legacy query parameter to the canonical q URL", async () => {
    navigation.redirect.mockClear();
    await expect(
      CalculatorsSearchRoute({
        searchParams: Promise.resolve({ run: "1", query: "PHQ-9", focus: "1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith("/calculators/search?run=1&focus=1&q=PHQ-9");
  });

  it("removes empty and redundant legacy query parameters", async () => {
    navigation.redirect.mockClear();
    await expect(CalculatorsSearchRoute({ searchParams: Promise.resolve({ query: "   " }) })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenLastCalledWith("/calculators/search");

    await expect(CalculatorsSearchRoute({ searchParams: Promise.resolve({ q: "GAD-7", query: "" }) })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenLastCalledWith("/calculators/search?q=GAD-7");
  });

  it("mounts the universal hero composer slot and canonical starter searches", () => {
    const { container } = render(<CalculatorsHomePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Clinical Calculators" })).toBeVisible();
    expect(container.querySelector(".mode-home-composer-slot")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Depression severity/ })).toHaveAttribute(
      "href",
      "/calculators/search?q=depression&run=1",
    );
    expect(screen.getByRole("link", { name: "PHQ-9" })).toHaveAttribute("href", "/calculators/search?q=PHQ-9&run=1");
  });
});

describe("calculator filter predicates", () => {
  it("applies OR within domains and AND across domain, progress, time, and query", () => {
    const records = recordsWithProgress();
    const filters: CalculatorFilterState = {
      domains: new Set(["mood", "anxiety"]),
      progress: "completed",
      time: "quick",
    };

    expect(filterCalculatorRecords(records, "anxiety", filters).map(({ calc }) => calc.id)).toEqual(["gad7"]);
    expect(filterCalculatorRecords(records, "depression", filters)).toEqual([]);
  });

  it("keeps not-started, in-progress, and completed boundaries exclusive", () => {
    const records = recordsWithProgress();
    const states = ["not-started", "in-progress", "completed"] as const;
    const ids = Object.fromEntries(
      states.map((progress) => [
        progress,
        filterCalculatorRecords(records, "", { ...emptyFilters(), progress }).map(({ calc }) => calc.id),
      ]),
    );

    expect(ids["in-progress"]).toEqual(["phq9"]);
    expect(ids.completed).toEqual(["gad7"]);
    expect(ids["not-started"]).not.toContain("phq9");
    expect(ids["not-started"]).not.toContain("gad7");
    expect(new Set(Object.values(ids).flat()).size).toBe(calculators.length);
  });

  it("buckets completion time by the fixture's numeric maximum", () => {
    const records = recordsWithProgress();
    const idsFor = (time: "quick" | "standard" | "extended") =>
      filterCalculatorRecords(records, "", { ...emptyFilters(), time }).map(({ calc }) => calc.id);

    expect(idsFor("quick")).toEqual(["gad7", "cage", "auditc", "sadpersons"]);
    expect(idsFor("standard")).toEqual(["phq9", "k10", "mdq"]);
    expect(idsFor("extended")).toEqual(["ybocs"]);
  });

  it("derives candidate counts from the same predicates", () => {
    const records = recordsWithProgress();
    const filters: CalculatorFilterState = {
      domains: new Set(["mood"]),
      progress: "all",
      time: "all",
    };

    expect(calculatorDomainCandidateCount(records, "", filters, "anxiety")).toBe(4);
    expect(calculatorProgressCandidateCount(records, "", filters, "in-progress")).toBe(1);
    expect(calculatorTimeCandidateCount(records, "", filters, "quick")).toBe(0);
  });
});

describe("calculator results surface", () => {
  it("uses the shared results band and filter sheet without a page-owned composer", async () => {
    const user = userEvent.setup();
    const { container } = render(<CalculatorsSearchPage initialQuery="depression" />);

    expect(screen.getByRole("heading", { level: 1, name: "depression" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 calculators");
    expect(container.querySelector('[data-testid="calculators-phone-dock"]')).toBeNull();

    await user.click(screen.getByTestId("calculators-filter-trigger-phone"));
    const sheet = screen.getByTestId("calculators-filter-sheet");
    expect(within(sheet).getByRole("group", { name: "Clinical domain" })).toBeVisible();
    expect(within(sheet).getByRole("radiogroup", { name: "Session progress" })).toBeVisible();
    expect(within(sheet).getByRole("radiogroup", { name: "Completion time" })).toBeVisible();
  });

  it("labels applied filters, removes one chip, and clears filters without clearing the query", async () => {
    const user = userEvent.setup();
    render(<CalculatorsSearchPage initialQuery="depression" />);

    await user.click(screen.getByTestId("calculators-filter-trigger-phone"));
    const sheet = screen.getByTestId("calculators-filter-sheet");
    await user.click(within(sheet).getByRole("button", { name: /Mood/ }));
    expect(screen.getByRole("button", { name: "Remove Clinical domain: Mood filter" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "depression" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Remove Clinical domain: Mood filter" }));
    expect(screen.queryByRole("button", { name: "Remove Clinical domain: Mood filter" })).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: /Mood/ }));
    await user.click(screen.getByTestId("calculators-filter-sheet-clear"));
    expect(screen.queryByRole("button", { name: "Remove Clinical domain: Mood filter" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "depression" })).toBeVisible();
  });

  it("distinguishes filtered and query-only empty recovery", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchCommandProvider value={{ query: "", modeId: "calculators" }}>
        <CalculatorsSearchPage />
      </SearchCommandProvider>,
    );

    await user.click(screen.getByTestId("calculators-filter-trigger-phone"));
    await user.click(within(screen.getByTestId("calculators-filter-sheet")).getByRole("button", { name: /Mood/ }));
    rerender(
      <SearchCommandProvider value={{ query: "anxiety", modeId: "calculators" }}>
        <CalculatorsSearchPage />
      </SearchCommandProvider>,
    );
    expect(screen.getByText("No calculators match the selected filter")).toBeVisible();
    expect(screen.getByTestId("search-results-empty-remove-filter")).toBeVisible();

    await user.click(screen.getByTestId("calculators-filter-sheet-clear"));
    rerender(
      <SearchCommandProvider value={{ query: "no-such-calculator", modeId: "calculators" }}>
        <CalculatorsSearchPage />
      </SearchCommandProvider>,
    );
    expect(screen.getByText("No matches for “no-such-calculator”")).toBeVisible();
    await user.click(screen.getByTestId("search-results-empty-clear-search"));
    expect(navigation.push).toHaveBeenCalledWith("/?mode=calculators&focus=1");
  });

  it("opens, updates, completes, closes, and resumes a scoring session", async () => {
    const user = userEvent.setup();
    Element.prototype.scrollTo = vi.fn();
    render(<CalculatorsSearchPage initialQuery="PHQ-9" />);

    await user.click(screen.getByRole("button", { name: /^Open PHQ-9/ }));
    let dialog = screen.getByRole("dialog", { name: "PHQ-9 calculator" });
    const firstItem = within(dialog).getByRole("group", { name: "Little interest or pleasure in doing things" });
    await user.click(within(firstItem).getByRole("button", { name: "Several days (1 point)" }));
    expect(within(dialog).getAllByText("1 of 9 answered")[0]).toBeVisible();

    for (const option of within(dialog).getAllByRole("button", { name: "Not at all (0 points)" })) {
      await user.click(option);
    }
    expect(within(dialog).getAllByText("9 of 9 answered")[0]).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: /^Close$/ }));
    await user.click(screen.getAllByRole("button", { name: /^Open PHQ-9/ })[0]);
    dialog = screen.getByRole("dialog", { name: "PHQ-9 calculator" });
    expect(within(dialog).getAllByText("9 of 9 answered")[0]).toBeVisible();
  });
});
