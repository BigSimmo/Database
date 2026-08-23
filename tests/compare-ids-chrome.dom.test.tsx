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
];

describe("CompareIdsChrome", () => {
  it("opens empty-first and assigns the active slot", async () => {
    const user = userEvent.setup();
    const committed: Array<Array<string | null>> = [];

    render(
      <CompareIdsChrome
        selectedIds={[]}
        maxCount={2}
        items={items}
        emptyTitle="Choose two terms"
        emptyDescription="Search the catalogue, or start from a common pair."
        actionLabel="Choose terms"
        searchPlaceholder="Search term"
        pickerTitle="Choose two terms"
        pickerDescription="Assign a term to A or B."
        pickerId="dictionary-compare-picker"
        pickerTestId="dictionary-compare-picker"
        onCommit={(ids) => committed.push(ids)}
      />,
    );

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
      <CompareIdsChrome
        selectedIds={["mse"]}
        maxCount={2}
        items={items}
        emptyTitle="Choose two terms"
        emptyDescription="Search the catalogue."
        actionLabel="Choose terms"
        searchPlaceholder="Search term"
        pickerTitle="Choose two terms"
        pickerDescription="Assign a term to A or B."
        pickerId="dictionary-compare-picker"
        pickerTestId="dictionary-compare-picker"
        onCommit={(ids) => committed.push(ids)}
      />,
    );

    expect(
      screen.getByRole("option", {
        name: (accessibleName: string) => accessibleName.startsWith("MSE") && !accessibleName.startsWith("MMSE"),
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("option", { name: /MMSE/ }));
    expect(committed.at(-1)).toEqual(["mse", "mmse"]);
  });
});
