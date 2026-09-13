/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallContactsSection } from "@/components/on-call/on-call-contacts-section";
import { OnCallFilterChips } from "@/components/on-call/on-call-filter-chips";
import { ON_CALL_FILTER_ALL } from "@/lib/on-call/entry-filters";
import { type OnCallEntry } from "@/lib/on-call/entry-model";

afterEach(cleanup);

const NOW = new Date("2026-09-04T00:00:00.000Z");

function contact(slug: string, title: string, tags: string[], phone: string): OnCallEntry {
  return {
    id: slug,
    slug,
    section: "contacts",
    title,
    subtitle: null,
    body: null,
    details: { role: title, phone },
    linkedDocumentIds: [],
    tags,
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: NOW.toISOString(),
  } as unknown as OnCallEntry;
}

const ED = contact("ed-registrar", "ED registrar", ["Emergency"], "5107");
const WARD = contact("ward-4b", "Ward 4B nurses' station", ["Wards"], "5210");

describe("OnCallFilterChips", () => {
  it("renders nothing when there is nothing to choose between", () => {
    // The row is furniture when every entry falls under one chip, and a
    // control that changes nothing on a 3am hub is worse than no control.
    const { container } = render(
      <OnCallFilterChips options={[]} active={ON_CALL_FILTER_ALL} onChange={() => {}} label="Filter" testId="chips" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks exactly the active chip pressed", () => {
    render(
      <OnCallFilterChips
        options={[ON_CALL_FILTER_ALL, "Emergency", "Wards"]}
        active="Emergency"
        onChange={() => {}}
        label="Filter contacts"
        testId="chips"
      />,
    );
    expect(screen.getByRole("button", { name: "Emergency" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Wards" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });

  it("names the row for assistive technology", () => {
    render(
      <OnCallFilterChips
        options={[ON_CALL_FILTER_ALL, "Emergency"]}
        active={ON_CALL_FILTER_ALL}
        onChange={() => {}}
        label="Filter contacts by area"
        testId="chips"
      />,
    );
    expect(screen.getByRole("group", { name: "Filter contacts by area" })).toBeInTheDocument();
  });
});

describe("Contacts filtered by its chip row", () => {
  it("shows the row only when the entries offer a real choice", () => {
    render(<OnCallContactsSection entries={[ED]} now={NOW} />);
    expect(screen.queryByTestId("on-call-contacts-filters")).not.toBeInTheDocument();

    cleanup();
    render(<OnCallContactsSection entries={[ED, WARD]} now={NOW} />);
    expect(screen.getByTestId("on-call-contacts-filters")).toBeInTheDocument();
  });

  it("narrows the list to the chosen area and back again", () => {
    render(<OnCallContactsSection entries={[ED, WARD]} now={NOW} />);
    expect(screen.getByTestId("on-call-contact-row-ed-registrar")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-contact-row-ward-4b")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("on-call-contacts-filters-wards"));
    expect(screen.queryByTestId("on-call-contact-row-ed-registrar")).not.toBeInTheDocument();
    expect(screen.getByTestId("on-call-contact-row-ward-4b")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("on-call-contacts-filters-all"));
    expect(screen.getByTestId("on-call-contact-row-ed-registrar")).toBeInTheDocument();
  });

  it("keeps the chip row when a filter empties the list", () => {
    // Filtering to nothing must not remove the way back. The empty branch is
    // keyed on the unfiltered set for exactly this reason.
    render(<OnCallContactsSection entries={[ED, WARD]} now={NOW} />);
    fireEvent.click(screen.getByTestId("on-call-contacts-filters-emergency"));
    expect(screen.getByTestId("on-call-contacts-filters")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-contacts-filters-all")).toBeInTheDocument();
  });

  it("gives a dialable row the drawing's call affordance without a nested control", () => {
    render(<OnCallContactsSection entries={[ED, WARD]} now={NOW} />);
    const row = screen.getByTestId("on-call-contact-row-ed-registrar");
    expect(row.tagName).toBe("A");
    // One target for one action: the disc is decoration inside the link.
    expect(row.querySelector("button")).toBeNull();
    expect(row.querySelector('[aria-hidden="true"].rounded-full')).not.toBeNull();
  });
});
