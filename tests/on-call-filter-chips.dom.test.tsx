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

describe("A private contact row", () => {
  const PRIVATE = { ...contact("okafor", "Dr M. Okafor — direct", ["Emergency"], "0412 000 111"), isPersonal: true };

  it("shows the rule and withholds the digits", () => {
    // Board 06: "the private mobile shows as Private · only you with no digits
    // at all, so the rule is visible without the number being." This is the
    // owner's own screen — the number is withheld from the room, not from
    // them, and they can still open the entry to read it.
    render(<OnCallContactsSection entries={[PRIVATE]} now={NOW} />);
    expect(screen.getByTestId("on-call-private-flag")).toHaveTextContent("Private · only you");
    expect(screen.queryByText(/0412 000 111/)).not.toBeInTheDocument();
  });

  it("is not a one-tap dial", () => {
    render(<OnCallContactsSection entries={[PRIVATE]} now={NOW} />);
    expect(screen.getByTestId("on-call-contact-row-okafor").tagName).not.toBe("A");
  });

  it("leaves a shared row's number exactly where it was", () => {
    render(<OnCallContactsSection entries={[ED]} now={NOW} />);
    expect(screen.queryByTestId("on-call-private-flag")).not.toBeInTheDocument();
    expect(screen.getByTestId("on-call-contact-row-ed-registrar").tagName).toBe("A");
  });
});

describe("Contact ordering from the page menu", () => {
  const STALE = {
    ...contact("bed-management", "Bed management, after hours", ["Admin"], "5290"),
    lastVerifiedAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  };

  it("groups by area by default", () => {
    render(<OnCallContactsSection entries={[ED, WARD]} now={NOW} />);
    expect(screen.getByTestId("on-call-contacts-group-emergency")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-contacts-group-wards")).toBeInTheDocument();
  });

  it("sorts by the role, not by the area's own numbering, under 'by role'", () => {
    // `sortOrder` is the owner's ordering WITHIN an area, so flattening the
    // areas and re-sorting on it interleaves them by a number that means
    // nothing across them — an arbitrary order wearing the label "by role".
    const zulu = { ...contact("a-slug", "A row", ["Wards"], "5001"), sortOrder: 0, details: { role: "Zulu ward" } };
    const alpha = { ...contact("z-slug", "Z row", ["Admin"], "5002"), sortOrder: 9, details: { role: "Alpha clinic" } };
    render(<OnCallContactsSection entries={[zulu, alpha]} now={NOW} order="role" />);
    const rows = [
      ...screen.getByTestId("on-call-contacts-group-role").querySelectorAll("[data-testid^='on-call-contact-row-']"),
    ];
    expect(rows[0]).toHaveAttribute("data-testid", "on-call-contact-row-z-slug");
  });

  it("drops the area groups for one flat list under 'by role'", () => {
    render(<OnCallContactsSection entries={[ED, WARD]} now={NOW} order="role" />);
    expect(screen.queryByTestId("on-call-contacts-group-emergency")).not.toBeInTheDocument();
    expect(screen.getByTestId("on-call-contacts-group-role")).toBeInTheDocument();
  });

  it("keeps overdue rows hoisted under 'by role' and 'by area'", () => {
    // A safety property, not a sort: an overdue number left in place among the
    // good ones is invisible.
    for (const order of ["area", "role"] as const) {
      cleanup();
      render(<OnCallContactsSection entries={[ED, STALE]} now={NOW} order={order} />);
      expect(screen.getByTestId("on-call-contacts-group-needs-checking")).toBeInTheDocument();
    }
  });

  it("puts overdue rows first in one ungrouped list under 'overdue first'", () => {
    render(<OnCallContactsSection entries={[ED, STALE]} now={NOW} order="overdue" />);
    expect(screen.queryByTestId("on-call-contacts-group-needs-checking")).not.toBeInTheDocument();
    const list = screen.getByTestId("on-call-contacts-group-overdue");
    const rows = [...list.querySelectorAll("[data-testid^='on-call-contact-row-']")];
    expect(rows[0]).toHaveAttribute("data-testid", "on-call-contact-row-bed-management");
  });
});
