/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallSearchBox } from "@/components/on-call/on-call-search-box";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";

afterEach(cleanup);

function entry(section: OnCallSection, slug: string, title: string, overrides: Partial<OnCallEntry> = {}): OnCallEntry {
  return {
    id: slug,
    slug,
    section,
    title,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  } as unknown as OnCallEntry;
}

const ED = entry("contacts", "ed-registrar", "ED registrar", {
  details: { role: "Emergency registrar", phone: "(08) 9224 1000" },
  tags: ["ward"],
});

const TEACHING = entry("education", "ward-teaching", "Ward teaching", {
  details: { recurrence: "Weekly", presenter: "Dr Halsey" },
});

const PRIVATE = entry("contacts", "okafor", "Dr M. Okafor — ward direct", {
  details: { role: "Consultant", phone: "0412 000 111" },
  isPersonal: true,
});

const ENTRIES = [ED, TEACHING, PRIVATE];

function type(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: /search on call/i }), { target: { value } });
}

describe("OnCallSearchBox — the box itself", () => {
  it("gives the field an accessible name", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    expect(screen.getByRole("searchbox", { name: /search on call/i })).toBeInTheDocument();
  });

  it("renders no results furniture at all until something is typed", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    expect(screen.queryByTestId("on-call-search-results")).not.toBeInTheDocument();
    expect(screen.queryByTestId("on-call-search-empty")).not.toBeInTheDocument();
    expect(screen.queryByText(/ward teaching/i)).not.toBeInTheDocument();
  });
});

describe("OnCallSearchBox — results", () => {
  it("groups matches under the section's own display title", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("ward");
    expect(screen.getByTestId("on-call-search-group-contacts")).toHaveTextContent("Contacts");
    // `education` is titled "Teaching" everywhere a reader sees it.
    expect(screen.getByTestId("on-call-search-group-education")).toHaveTextContent("Teaching");
  });

  it("makes a dialable contact row a one-tap tel: link showing the number", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("registrar");
    const row = screen.getByTestId("on-call-search-row-ed-registrar");
    expect(row.tagName).toBe("A");
    expect(row).toHaveAttribute("href", "tel:0892241000");
    expect(row).toHaveTextContent("(08) 9224 1000");
    expect(row).toHaveTextContent("Emergency registrar");
  });

  it("sends a row with no number to that section's page instead", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("teaching");
    const row = screen.getByTestId("on-call-search-row-ward-teaching");
    expect(row).toHaveAttribute("href", "/on-call/education");
  });

  it("never prints a personal number, and links to the section instead", () => {
    render(<OnCallSearchBox entries={[PRIVATE]} />);
    type("okafor");
    const row = screen.getByTestId("on-call-search-row-okafor");
    expect(row).toHaveAttribute("href", "/on-call/contacts");
    expect(row).toHaveTextContent("Dr M. Okafor — ward direct");
    expect(screen.queryByText(/0412 000 111/)).not.toBeInTheDocument();
  });

  it("clears back to nothing", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("ward");
    expect(screen.getByTestId("on-call-search-results")).toBeInTheDocument();
    type("");
    expect(screen.queryByTestId("on-call-search-results")).not.toBeInTheDocument();
  });
});

describe("OnCallSearchBox — nothing matched", () => {
  it("says so quietly and names the query", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("cardiology");
    const empty = screen.getByTestId("on-call-search-empty");
    expect(empty).toHaveTextContent(/cardiology/);
    expect(screen.queryByTestId("on-call-search-results")).not.toBeInTheDocument();
  });
});

describe("OnCallSearchBox — announcements", () => {
  it("announces the count out of sight, not on the visible list", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("ward");
    const status = screen.getByTestId("on-call-search-status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.className).toContain("sr-only");
    expect(status).toHaveTextContent("3 results");
    expect(screen.getByTestId("on-call-search-results")).not.toHaveAttribute("aria-live");
  });

  it("uses the singular for one match, and announces an empty result", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    type("teaching");
    expect(screen.getByTestId("on-call-search-status")).toHaveTextContent("1 result");
    type("cardiology");
    expect(screen.getByTestId("on-call-search-status")).toHaveTextContent(/nothing matched/i);
  });

  it("says nothing at all while the box is empty", () => {
    render(<OnCallSearchBox entries={ENTRIES} />);
    expect(screen.getByTestId("on-call-search-status")).toBeEmptyDOMElement();
  });
});
