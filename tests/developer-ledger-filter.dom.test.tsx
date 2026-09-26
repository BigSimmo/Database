/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LedgerFilter, type LedgerFilterGroup } from "@/components/developer-area/hub/ledger-filter";
import type { LedgerOpenItem } from "@/lib/developer-area/ledger-snapshot";

function item(overrides: Partial<LedgerOpenItem> & Pick<LedgerOpenItem, "id">): LedgerOpenItem {
  return {
    priority: "P2",
    type: "task",
    summary: "A summary",
    detail: "Some detail",
    source: "test",
    added: "2026-09-26",
    ...overrides,
  };
}

const GROUPS: LedgerFilterGroup[] = [
  {
    key: "P1",
    heading: "P1 — blocking",
    note: "Blocking.",
    items: [item({ id: "#AAA111", priority: "P1", type: "issue", summary: "Broken retry route" })],
  },
  {
    key: "P2",
    heading: "P2 — important",
    note: "Important.",
    items: [
      item({ id: "#BBB222", priority: "P2", type: "task", summary: "Write the hub spec" }),
      item({
        id: "#CCC333",
        priority: "P2",
        type: "rec",
        summary: "Consider caching",
        detail: "Mentions LITHIUM here",
      }),
    ],
  },
  {
    key: "P3",
    heading: "P3 — background",
    note: "Background.",
    items: [item({ id: "#DDD444", priority: "P3", type: "task", summary: "Tidy weights" })],
  },
  {
    key: "other",
    heading: "Other",
    note: "Unrecognised priority.",
    items: [item({ id: "#EEE555", priority: "P9", type: "issue", summary: "Odd priority row" })],
  },
];

function renderedIds() {
  return within(screen.getByTestId("developer-ledger-open"))
    .queryAllByTestId(/^developer-ledger-item-/)
    .map((node) => node.getAttribute("data-testid"));
}

afterEach(cleanup);

describe("ledger search and filter", () => {
  it("shows every item, in group order, when nothing is filtered", () => {
    render(<LedgerFilter groups={GROUPS} />);
    expect(renderedIds()).toEqual([
      "developer-ledger-item-AAA111",
      "developer-ledger-item-BBB222",
      "developer-ledger-item-CCC333",
      "developer-ledger-item-DDD444",
      "developer-ledger-item-EEE555",
    ]);
    expect(screen.getByTestId("developer-ledger-showing")).toHaveTextContent("Showing 5 of 5");
  });

  it("searches id, summary and detail case-insensitively", () => {
    render(<LedgerFilter groups={GROUPS} />);
    const search = screen.getByLabelText("Search the task list");

    fireEvent.change(search, { target: { value: "lithium" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-CCC333"]);

    fireEvent.change(search, { target: { value: "bbb222" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-BBB222"]);

    fireEvent.change(search, { target: { value: "RETRY" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-AAA111"]);
    expect(screen.getByTestId("developer-ledger-showing")).toHaveTextContent("Showing 1 of 5");
  });

  it("filters by priority and by type, and combines both with the search", () => {
    render(<LedgerFilter groups={GROUPS} />);

    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "P2" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-BBB222", "developer-ledger-item-CCC333"]);
    // A group with nothing left drops its heading rather than showing "· 0".
    expect(screen.queryByRole("heading", { name: /P1 — blocking/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "P2 — important · 2" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "rec" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-CCC333"]);

    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "All" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "issue" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-AAA111", "developer-ledger-item-EEE555"]);

    fireEvent.change(screen.getByLabelText("Search the task list"), { target: { value: "odd" } });
    expect(renderedIds()).toEqual(["developer-ledger-item-EEE555"]);
    expect(screen.getByTestId("developer-ledger-showing")).toHaveTextContent("Showing 1 of 5");
  });

  it("says so in words when nothing matches", () => {
    render(<LedgerFilter groups={GROUPS} />);
    fireEvent.change(screen.getByLabelText("Search the task list"), { target: { value: "no such thing" } });
    expect(renderedIds()).toEqual([]);
    expect(screen.getByTestId("developer-ledger-no-match")).toHaveTextContent(/No open items match/);
    expect(screen.getByTestId("developer-ledger-showing")).toHaveTextContent("Showing 0 of 5");
  });

  it("offers the documented priority and type options, and uses no buttons", () => {
    const { container } = render(<LedgerFilter groups={GROUPS} />);
    const optionText = (label: string) =>
      Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.value);
    expect(optionText("Priority")).toEqual(["All", "P1", "P2", "P3"]);
    expect(optionText("Type")).toEqual(["All", "issue", "task", "rec"]);
    expect(container.querySelector("button")).toBeNull();
  });

  it("keeps controls at the 48 px tap floor and its own group headings at weight 600 or lighter", () => {
    const { container } = render(<LedgerFilter groups={GROUPS} />);
    for (const control of container.querySelectorAll("input, select")) {
      expect(control.getAttribute("class")).toContain("h-tap");
    }
    // Scoped to what this component draws itself; the shared item card's own
    // badge weights are out of scope here.
    for (const heading of screen.getAllByRole("heading", { level: 3 })) {
      expect(heading.getAttribute("class")).not.toMatch(/font-(bold|extrabold|black)\b/);
    }
  });
});
