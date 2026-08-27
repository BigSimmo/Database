/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { CompareIdsChrome } from "@/components/compare";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

afterEach(() => {
  cleanup();
});

const items = [
  { id: "mse", title: "MSE", snippet: "Mental state examination" },
  { id: "mmse", title: "MMSE", snippet: "Mini-mental state examination" },
  { id: "mood", title: "Mood", snippet: "Sustained emotional climate" },
];

const chromeProps = {
  items,
  emptyTitle: "Choose two terms",
  emptyDescription: "Search the catalogue, or start from a common pair.",
  actionLabel: "Choose terms",
  searchPlaceholder: "Search term",
  pickerTitle: "Choose two terms",
  pickerDescription: "Assign a term to A or B.",
  pickerId: "dictionary-compare-picker",
  pickerTestId: "dictionary-compare-picker",
};

describe("CompareIdsChrome", () => {
  it("opens empty-first and assigns the active slot", async () => {
    const user = userEvent.setup();
    const committed: Array<Array<string | null>> = [];

    render(<CompareIdsChrome selectedIds={[]} maxCount={2} onCommit={(ids) => committed.push(ids)} {...chromeProps} />);

    expect(screen.getAllByText("Choose two terms").length).toBeGreaterThan(0);
    expect(screen.getByTestId("dictionary-compare-picker")).toBeVisible();

    await user.click(
      screen.getByRole("option", {
        name: (accessibleName: string) => accessibleName.startsWith("MSE") && !accessibleName.startsWith("MMSE"),
      }),
    );
    expect(committed.at(-1)).toEqual(["mse", null]);
  });

  it("assigns the empty slot and disables a duplicate", async () => {
    const user = userEvent.setup();
    const committed: Array<Array<string | null>> = [];

    render(
      <CompareIdsChrome selectedIds={["mse"]} maxCount={2} onCommit={(ids) => committed.push(ids)} {...chromeProps} />,
    );

    expect(
      screen.getByRole("option", {
        name: (accessibleName: string) => accessibleName.startsWith("MSE") && !accessibleName.startsWith("MMSE"),
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("option", { name: /MMSE/ }));
    expect(committed.at(-1)).toEqual(["mse", "mmse"]);
  });

  it("swaps a filled pair through the labelled control", async () => {
    const user = userEvent.setup();
    const committed: Array<Array<string | null>> = [];

    render(
      <CompareIdsChrome
        selectedIds={["mse", "mmse"]}
        maxCount={2}
        swapLabel="Swap compared specifiers"
        onCommit={(ids) => committed.push(ids)}
        {...chromeProps}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Swap compared specifiers" }));
    expect(committed.at(-1)).toEqual(["mmse", "mse"]);
  });

  it("keeps a pick in slot C instead of collapsing it to A", async () => {
    const user = userEvent.setup();
    const committed: Array<Array<string | null>> = [];

    render(<CompareIdsChrome selectedIds={[]} maxCount={3} onCommit={(ids) => committed.push(ids)} {...chromeProps} />);

    await user.click(screen.getAllByRole("tab")[2]);
    await user.click(screen.getByRole("option", { name: /Mood/ }));
    expect(committed.at(-1)).toEqual([null, null, "mood"]);
  });

  it("removes one filled slot without clearing the rest", async () => {
    const user = userEvent.setup();
    const committed: Array<Array<string | null>> = [];

    render(
      <CompareIdsChrome
        selectedIds={["mse", "mmse", "mood"]}
        maxCount={3}
        onCommit={(ids) => committed.push(ids)}
        {...chromeProps}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove MMSE" }));
    expect(committed.at(-1)).toEqual(["mse", null, "mood"]);
  });

  it("closes the picker once a completed comparison arrives without remounting", () => {
    const view = render(<CompareIdsChrome selectedIds={[]} maxCount={2} onCommit={() => {}} {...chromeProps} />);

    expect(screen.getByTestId("dictionary-compare-picker")).toBeVisible();

    view.rerender(<CompareIdsChrome selectedIds={["mse", "mmse"]} maxCount={2} onCommit={() => {}} {...chromeProps} />);

    expect(screen.queryByTestId("dictionary-compare-picker")).not.toBeInTheDocument();
  });

  it("lets a completed comparison reopen without remounting", async () => {
    const user = userEvent.setup();
    const view = render(<CompareIdsChrome selectedIds={[]} maxCount={2} onCommit={() => {}} {...chromeProps} />);

    view.rerender(<CompareIdsChrome selectedIds={["mse", "mmse"]} maxCount={2} onCommit={() => {}} {...chromeProps} />);
    expect(screen.queryByTestId("dictionary-compare-picker")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change selection" }));
    expect(screen.getByTestId("dictionary-compare-picker")).toBeVisible();
  });

  it("suppresses the dashed empty state on hybrid phone when nothing is selected", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("639px"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }),
    });

    render(
      <CompareIdsChrome
        selectedIds={[]}
        maxCount={4}
        minCount={2}
        phoneLayout="hybrid"
        onCommit={() => {}}
        {...chromeProps}
      />,
    );

    expect(screen.getByTestId("compare-slot-strip-pip-summary")).toBeInTheDocument();
    expect(screen.queryByText("Search the catalogue, or start from a common pair.")).toBeNull();
  });
});
