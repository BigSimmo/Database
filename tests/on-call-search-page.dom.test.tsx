/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnCallSearchPage } from "@/components/on-call/on-call-search-page";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/search",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const onCallEntriesState = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  signedOut: false,
  cachedAt: null as string | null,
}));

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => onCallEntriesState,
}));

function entry(
  overrides: Partial<OnCallEntry> & { id: string; slug: string; section: OnCallEntry["section"] },
): OnCallEntry {
  return {
    title: overrides.title ?? "Untitled",
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
  };
}

const HAEMATOLOGY_CONTACT = entry({
  id: "11111111-1111-1111-1111-111111111111",
  slug: "haematology",
  section: "contacts",
  title: "Haematology on-call",
  details: { role: "Haematology registrar", phone: "9224 8888" },
  tags: ["Clozapine monitoring"],
});

const CLOZAPINE_CLINIC = entry({
  id: "22222222-2222-2222-2222-222222222222",
  slug: "clozapine-clinic",
  section: "referrals",
  title: "Clozapine clinic",
  details: { accepts: [], exclusions: [], phone: "9346 1234" },
});

const NEUTROPENIA_PLAYBOOK = entry({
  id: "33333333-3333-3333-3333-333333333333",
  slug: "neutropenia",
  section: "playbook",
  title: "Fever on clozapine",
  details: {
    trigger: "Temp > 38 in a patient on clozapine",
    escalationSteps: [{ order: 1, whoToCall: "On-call consultant", when: "Immediately" }],
  },
});

const CAR_PARK_LOGISTICS = entry({
  id: "44444444-4444-4444-4444-444444444444",
  slug: "car-park",
  section: "logistics",
  title: "After-hours car park access",
  details: { category: "Parking" },
});

const JOURNAL_CLUB = entry({
  id: "55555555-5555-5555-5555-555555555555",
  slug: "journal-club",
  section: "education",
  title: "Weekly journal club",
  details: { presenter: "Dr Amara Okafor" },
});

function resetOnCallEntriesState() {
  onCallEntriesState.entries = [];
  onCallEntriesState.loading = false;
  onCallEntriesState.isOffline = false;
  onCallEntriesState.signedOut = false;
  onCallEntriesState.cachedAt = null;
}

afterEach(() => {
  cleanup();
  resetOnCallEntriesState();
});

describe("OnCallSearchPage", () => {
  it("matches one query across every section at once, each result naming its own section", () => {
    onCallEntriesState.entries = [HAEMATOLOGY_CONTACT, CLOZAPINE_CLINIC, NEUTROPENIA_PLAYBOOK, CAR_PARK_LOGISTICS];
    render(<OnCallSearchPage initialQuery="clozapine" />);

    const contactRow = screen.getByTestId(`on-call-search-result-${HAEMATOLOGY_CONTACT.id}`);
    const referralRow = screen.getByTestId(`on-call-search-result-${CLOZAPINE_CLINIC.id}`);
    const playbookRow = screen.getByTestId(`on-call-search-result-${NEUTROPENIA_PLAYBOOK.id}`);
    expect(screen.queryByTestId(`on-call-search-result-${CAR_PARK_LOGISTICS.id}`)).toBeNull();

    expect(within(contactRow).getByTestId("on-call-search-result-section")).toHaveTextContent("Contacts");
    expect(within(referralRow).getByTestId("on-call-search-result-section")).toHaveTextContent("Referrals");
    expect(within(playbookRow).getByTestId("on-call-search-result-section")).toHaveTextContent("Playbook");

    // Legible without opening anything: the clinic's own phone number, and the
    // haematology contact's, are both readable straight off the result list.
    expect(within(contactRow).getByText(/9224 8888/)).toBeInTheDocument();
    expect(within(referralRow).getByText(/9346 1234/)).toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent("3");
  });

  it("matches a section-specific detail field (a presenter), not just the title", () => {
    onCallEntriesState.entries = [JOURNAL_CLUB, CAR_PARK_LOGISTICS];
    render(<OnCallSearchPage initialQuery="Okafor" />);

    expect(screen.getByTestId(`on-call-search-result-${JOURNAL_CLUB.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`on-call-search-result-${CAR_PARK_LOGISTICS.id}`)).toBeNull();
  });

  it("renders NO COUNT AT ALL for a faulted search — offline with nothing cached to search over", () => {
    onCallEntriesState.entries = [];
    onCallEntriesState.loading = false;
    onCallEntriesState.isOffline = true;
    onCallEntriesState.signedOut = false;
    render(<OnCallSearchPage initialQuery="clozapine" />);

    const status = screen.getByRole("status");
    // Not zero, not any other number: no digit reaches the DOM at all.
    expect(status.textContent).not.toMatch(/\d/);
    expect(status).not.toHaveTextContent("0");

    expect(screen.getByRole("alert")).toBeInTheDocument();
    // No result list, and no filter/sort controls asserting a trustworthy
    // count beneath a search that never actually ran.
    expect(screen.queryByRole("region", { name: "On Call search results" })).toBeNull();
    expect(screen.queryByTestId("search-query-ribbon-filters")).toBeNull();
  });

  it("renders no count while the initial fetch is still loading", () => {
    onCallEntriesState.loading = true;
    render(<OnCallSearchPage initialQuery="" />);
    expect(screen.getByRole("status").textContent).not.toMatch(/\d/);
  });

  it("renders no count when signed out", () => {
    onCallEntriesState.signedOut = true;
    render(<OnCallSearchPage initialQuery="clozapine" />);
    expect(screen.getByRole("status").textContent).not.toMatch(/\d/);
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("never renders a native select for the section filter — a badged trigger opening a sheet instead", async () => {
    onCallEntriesState.entries = [HAEMATOLOGY_CONTACT, CAR_PARK_LOGISTICS];
    const { container } = render(<OnCallSearchPage initialQuery="" />);

    expect(container.querySelectorAll("select")).toHaveLength(0);

    const trigger = screen.getByTestId("on-call-search-filter-trigger-phone");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const user = userEvent.setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const sheet = screen.getByTestId("on-call-search-filter-sheet");
    const sectionGroup = within(sheet).getByRole("radiogroup", { name: "Section" });
    expect(within(sectionGroup).getByRole("radio", { name: /^Contacts/ })).toBeInTheDocument();
    expect(within(sectionGroup).getByRole("radio", { name: /^Logistics/ })).toBeInTheDocument();

    // Selecting a section narrows the list without ever touching a select.
    await user.click(within(sectionGroup).getByRole("radio", { name: /^Logistics/ }));
    expect(screen.getByTestId(`on-call-search-result-${CAR_PARK_LOGISTICS.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`on-call-search-result-${HAEMATOLOGY_CONTACT.id}`)).toBeNull();
  });

  it("renders sort as an aria-pressed group, hidden below the tablet breakpoint", () => {
    onCallEntriesState.entries = [HAEMATOLOGY_CONTACT];
    render(<OnCallSearchPage initialQuery="" />);

    const sortGroup = screen.getByRole("group", { name: "Sort results" });
    // `sm:inline-flex` on a `hidden` base — the band's own tablet-and-up idiom
    // for this control (`ResultSortControl`).
    expect(sortGroup.className).toMatch(/\bhidden\b/);
    expect(sortGroup.className).toMatch(/\bsm:inline-flex\b/);

    const options = within(sortGroup).getAllByRole("button");
    expect(options).toHaveLength(2);
    for (const option of options) expect(option).toHaveAttribute("aria-pressed");
    expect(options.some((option) => option.getAttribute("aria-pressed") === "true")).toBe(true);
  });

  it("shows the browse-all state (every entry) for an empty query", () => {
    onCallEntriesState.entries = [HAEMATOLOGY_CONTACT, CAR_PARK_LOGISTICS, JOURNAL_CLUB];
    render(<OnCallSearchPage initialQuery="" />);

    expect(screen.getByTestId(`on-call-search-result-${HAEMATOLOGY_CONTACT.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`on-call-search-result-${CAR_PARK_LOGISTICS.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`on-call-search-result-${JOURNAL_CLUB.id}`)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3");
  });

  it("renders a real empty state, not a bare zero, when nothing matches", () => {
    onCallEntriesState.entries = [CAR_PARK_LOGISTICS];
    render(<OnCallSearchPage initialQuery="vestibular migraine" />);

    expect(screen.getByRole("status")).toHaveTextContent("0");
    expect(screen.queryByTestId(`on-call-search-result-${CAR_PARK_LOGISTICS.id}`)).toBeNull();
    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
  });

  it("links each result to its section as internal navigation (an <a> from next/link, not a button)", () => {
    onCallEntriesState.entries = [HAEMATOLOGY_CONTACT];
    render(<OnCallSearchPage initialQuery="" />);

    const row = screen.getByTestId(`on-call-search-result-${HAEMATOLOGY_CONTACT.id}`);
    expect(row.tagName).toBe("A");
    expect(row).toHaveAttribute("href", "/on-call/contacts");
  });
});
