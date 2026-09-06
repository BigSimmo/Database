/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallEducationSection } from "@/components/on-call/on-call-education-section";
import { OnCallLogisticsSection } from "@/components/on-call/on-call-logistics-section";
import { OnCallOrientationSection } from "@/components/on-call/on-call-orientation-section";
import type { OnCallLinkedDocument } from "@/components/on-call/on-call-playbook-section";
import { OnCallPlaybookSection } from "@/components/on-call/on-call-playbook-section";
import { OnCallReferralsSection } from "@/components/on-call/on-call-referrals-section";
import type { OnCallEntry, OnCallSection } from "@/lib/on-call/entry-model";

afterEach(cleanup);

const NOW = new Date("2026-09-04T00:00:00.000Z");

function entry(
  section: OnCallSection,
  overrides: Partial<OnCallEntry> & { id: string; slug: string; title: string },
): OnCallEntry {
  return {
    section,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: NOW.toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Playbook — THE PLAYBOOK RULE. Read this section twice before touching it.
// ---------------------------------------------------------------------------

const AGITATION_GUIDELINE: OnCallLinkedDocument = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  title: "Aggression and Violence Management Policy",
  date: "2025-01-15T00:00:00.000Z",
};

const ACUTE_AGITATION = entry("playbook", {
  id: "bbbbbbbb-0000-0000-0000-000000000001",
  slug: "acute-agitation",
  title: "Acute agitation on the ward",
  details: {
    trigger: "Patient escalating physically, staff safety at risk",
    escalationSteps: [
      {
        order: 2,
        whoToCall: "Consultant psychiatrist",
        when: "If the registrar is unavailable after 10 minutes",
        phone: "0499 999 999",
      },
      {
        order: 1,
        whoToCall: "On-call registrar",
        when: "First point of contact",
        phone: "0412 345 678",
      },
    ],
  },
  linkedDocumentIds: [AGITATION_GUIDELINE.id],
});

// Deliberately content-free, like the search fixtures. What this case tests is
// the ABSENCE of a linked document, not any clinical situation — so it states
// no threshold and no escalation rule of its own. A fixture is how such content
// usually enters a repository: it gets copied into a seed, then a demo.
const UNLINKED_SCENARIO = entry("playbook", {
  id: "bbbbbbbb-0000-0000-0000-000000000002",
  slug: "scenario-with-no-linked-guideline",
  title: "Scenario with no linked guideline",
  details: {
    trigger: "Owner-written trigger text",
    escalationSteps: [{ order: 1, whoToCall: "On-call registrar", when: "As the owner recorded it" }],
  },
  linkedDocumentIds: [],
});

// Clinical language the app must never author in the Playbook's own voice —
// none of it may appear anywhere the component renders text itself. A
// genuinely present drug/dose word would only ever come from a linked
// document's title, which none of this fixture set supplies.
const FORBIDDEN_CLINICAL_LANGUAGE =
  /\b(administer|dosage|titrate|titration|antipsychotic|benzodiazepine|olanzapine|haloperidol|lorazepam|diazepam|IM stat|IV stat|\d+\s?mg)\b/i;

describe("OnCallPlaybookSection", () => {
  it("renders escalation steps as an ordered list of who, when, and a tap-to-call number", () => {
    render(<OnCallPlaybookSection entries={[ACUTE_AGITATION]} now={NOW} />);
    const card = screen.getByTestId("on-call-playbook-card-acute-agitation");
    const list = within(card).getByRole("list");
    expect(list.tagName).toBe("OL");

    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // Genuinely ordered — step 1 (lower `order`) renders first even though it
    // was supplied second in `escalationSteps`.
    const firstRow = within(items[0]!).getByTestId("on-call-playbook-step-acute-agitation-1");
    expect(firstRow).toHaveTextContent("On-call registrar");
    expect(firstRow).toHaveTextContent("First point of contact");
    expect(firstRow).toHaveAttribute("href", "tel:0412345678");

    const secondRow = within(items[1]!).getByTestId("on-call-playbook-step-acute-agitation-2");
    expect(secondRow).toHaveTextContent("Consultant psychiatrist");
    expect(secondRow).toHaveAttribute("href", "tel:0499999999");
  });

  it("shows each linked document's own title and date as the only clinical content", () => {
    render(
      <OnCallPlaybookSection
        entries={[ACUTE_AGITATION]}
        documents={{ [AGITATION_GUIDELINE.id]: AGITATION_GUIDELINE }}
        now={NOW}
      />,
    );
    const card = screen.getByTestId("on-call-playbook-card-acute-agitation");
    const link = within(card).getByRole("link", { name: /Aggression and Violence Management Policy/ });
    expect(link).toHaveAttribute("href", `/documents/${AGITATION_GUIDELINE.id}`);
    expect(link).toHaveTextContent("15/01/2025");
    expect(within(card).queryByTestId(`on-call-playbook-no-guideline-${ACUTE_AGITATION.slug}`)).toBeNull();
  });

  it("renders a real EmptyState offering a Documents search when no guideline is linked, with no clinical text at all", () => {
    render(<OnCallPlaybookSection entries={[UNLINKED_SCENARIO]} now={NOW} />);
    const card = screen.getByTestId("on-call-playbook-card-scenario-with-no-linked-guideline");
    const emptyState = within(card).getByTestId(`on-call-playbook-no-guideline-${UNLINKED_SCENARIO.slug}`);
    expect(emptyState).toHaveTextContent(/no local guideline linked/i);

    const searchAction = within(emptyState).getByRole("link", { name: /search documents/i });
    expect(searchAction).toHaveAttribute("href", "/documents/search");

    // The clinical-safety assertion: nowhere on this card — not the empty
    // state, not the trigger/step text, not the trigger label — does the app
    // author a clinical instruction in its own voice.
    expect(card.textContent ?? "").not.toMatch(FORBIDDEN_CLINICAL_LANGUAGE);
    expect(emptyState.textContent ?? "").not.toMatch(/typically|you would|first line|as a rule/i);
  });

  it("renders a real empty state, and no cards at all, when there are no playbook entries", () => {
    render(<OnCallPlaybookSection entries={[]} now={NOW} />);
    expect(screen.getByTestId("on-call-playbook-empty")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

const CRISIS_TEAM_REFERRAL = entry("referrals", {
  id: "cccccccc-0000-0000-0000-000000000001",
  slug: "crisis-team",
  title: "Crisis and Emergency Response Team",
  details: {
    accepts: ["Adults with acute psychosis", "Acute suicidality with a safety plan needed"],
    exclusions: ["Under 18s", "Primary substance intoxication without mental illness"],
    catchment: "Perth metro north",
    hours: "24/7",
    howToRefer: "Phone triage line, then fax the referral form",
    phone: "1300 555 788",
    fax: "08 9222 0000",
  },
});

describe("OnCallReferralsSection", () => {
  it("renders accepts and exclusions as labelled text, never a colour-coded chip alone", async () => {
    const user = userEvent.setup();
    render(<OnCallReferralsSection entries={[CRISIS_TEAM_REFERRAL]} now={NOW} />);

    await user.click(screen.getByRole("button", { name: /Crisis and Emergency Response Team/ }));
    const panel = screen.getByTestId(`on-call-referral-panel-${CRISIS_TEAM_REFERRAL.slug}`);

    // The label itself is a real text node, present regardless of colour.
    expect(within(panel).getByText("Accepts:")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Adults with acute psychosis");
    expect(within(panel).getByText("Does not accept:")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Under 18s");

    // Neither list item is a `<span>`-only colour chip with no accompanying
    // label text — every fact line carries its own bolded label.
    expect(panel).toHaveTextContent("Catchment: Perth metro north");
    expect(panel).toHaveTextContent("Hours: 24/7");
    expect(panel).toHaveTextContent("How to refer: Phone triage line, then fax the referral form");
  });

  it("gives the phone number a tap-to-call row inside the expanded panel", async () => {
    const user = userEvent.setup();
    render(<OnCallReferralsSection entries={[CRISIS_TEAM_REFERRAL]} now={NOW} />);
    await user.click(screen.getByRole("button", { name: /Crisis and Emergency Response Team/ }));
    const phoneRow = screen.getByTestId(`on-call-referral-phone-${CRISIS_TEAM_REFERRAL.slug}`);
    expect(phoneRow).toHaveAttribute("href", "tel:1300555788");
  });

  it("renders a real empty state when there are no referral entries", () => {
    render(<OnCallReferralsSection entries={[]} now={NOW} />);
    expect(screen.getByTestId("on-call-referrals-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Orientation
// ---------------------------------------------------------------------------

const WARD_4B_MANUAL: OnCallLinkedDocument = {
  id: "dddddddd-0000-0000-0000-000000000001",
  title: "Ward 4B Night Orientation Manual",
  date: "2025-03-01T00:00:00.000Z",
};

const WARD_4B_ORIENTATION = entry("orientation", {
  id: "eeeeeeee-0000-0000-0000-000000000001",
  slug: "ward-4b",
  title: "Ward 4B",
  body: "Ring switch first and mention you're on Ward 4B nights — the manual's own sign-in steps are out of date.",
  details: { pinnedSummaryIsOwnerNote: true },
  linkedDocumentIds: [WARD_4B_MANUAL.id],
});

describe("OnCallOrientationSection", () => {
  it("shows the pinned summary above the document link, visibly attributed to the owner", () => {
    render(
      <OnCallOrientationSection
        entries={[WARD_4B_ORIENTATION]}
        documents={{ [WARD_4B_MANUAL.id]: WARD_4B_MANUAL }}
        now={NOW}
      />,
    );
    const note = screen.getByTestId(`on-call-orientation-note-${WARD_4B_ORIENTATION.slug}`);
    // The attribution itself — never presented as the manual's own words.
    expect(note).toHaveTextContent(/your note/i);
    expect(note).toHaveTextContent(/ring switch first/i);

    const docLink = screen.getByRole("link", { name: /Ward 4B Night Orientation Manual/ });
    expect(docLink).toHaveAttribute("href", `/documents/${WARD_4B_MANUAL.id}`);
    expect(docLink).toHaveTextContent("01/03/2025");

    // Document order in the DOM: the note precedes the document link.
    const relativePosition = note.compareDocumentPosition(docLink);
    expect(relativePosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders a real empty state when there are no orientation entries", () => {
    render(<OnCallOrientationSection entries={[]} now={NOW} />);
    expect(screen.getByTestId("on-call-orientation-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Education (displayed as "Teaching")
// ---------------------------------------------------------------------------

const JOURNAL_CLUB = entry("education", {
  id: "ffffffff-0000-0000-0000-000000000001",
  slug: "journal-club",
  title: "Journal club",
  details: { nextOccurrence: "2026-09-10T08:00:00.000Z", topics: ["Clozapine monitoring"] },
});

const GRAND_ROUNDS = entry("education", {
  id: "ffffffff-0000-0000-0000-000000000002",
  slug: "grand-rounds",
  title: "Grand rounds",
  details: {
    nextOccurrence: "2026-10-01T08:00:00.000Z",
    recordingUrl: "https://example-hospital-intranet.test/recordings/grand-rounds",
    topics: [],
  },
});

const AD_HOC_WORKSHOP = entry("education", {
  id: "ffffffff-0000-0000-0000-000000000003",
  slug: "ad-hoc-workshop",
  title: "Ad hoc workshop",
  details: { topics: [] },
});

describe("OnCallEducationSection", () => {
  it("orders sessions by next occurrence, soonest first, with undated sessions last", () => {
    render(<OnCallEducationSection entries={[GRAND_ROUNDS, AD_HOC_WORKSHOP, JOURNAL_CLUB]} now={NOW} />);
    const cards = screen.getAllByTestId(/^on-call-education-card-/).map((card) => card.getAttribute("data-testid"));
    expect(cards).toEqual([
      "on-call-education-card-journal-club",
      "on-call-education-card-grand-rounds",
      "on-call-education-card-ad-hoc-workshop",
    ]);
  });

  it("marks a recording link as leaving the app", () => {
    render(<OnCallEducationSection entries={[GRAND_ROUNDS]} now={NOW} />);
    const card = screen.getByTestId("on-call-education-card-grand-rounds");
    const recordingLink = within(card).getByRole("link", { name: /watch recording/i });
    expect(recordingLink).toHaveAttribute("target", "_blank");
    expect(recordingLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(recordingLink.querySelector("svg")).not.toBeNull();
    expect(recordingLink).toHaveTextContent(/opens in a new tab/i);
  });

  it("renders a real empty state when there are no teaching sessions", () => {
    render(<OnCallEducationSection entries={[]} now={NOW} />);
    expect(screen.getByTestId("on-call-education-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Logistics
// ---------------------------------------------------------------------------

const STAFF_CAR_PARK = entry("logistics", {
  id: "12121212-0000-0000-0000-000000000001",
  slug: "staff-car-park",
  title: "Staff car park",
  details: { category: "Parking", location: "Level 2, Hospital Ave car park", hours: "24/7" },
});

const IT_HELPDESK = entry("logistics", {
  id: "12121212-0000-0000-0000-000000000002",
  slug: "it-helpdesk",
  title: "IT helpdesk",
  details: { category: "IT", phone: "1800 111 222" },
});

describe("OnCallLogisticsSection", () => {
  it("groups rows by category, each row naming a place, an hour range, or a number", () => {
    render(<OnCallLogisticsSection entries={[STAFF_CAR_PARK, IT_HELPDESK]} now={NOW} />);

    // Alphabetical grouping: IT before Parking.
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.indexOf("IT")).toBeLessThan(headings.indexOf("Parking"));

    const parkingGroup = screen.getByTestId("on-call-logistics-group-parking");
    const parkingRow = within(parkingGroup).getByTestId("on-call-logistics-row-staff-car-park");
    expect(parkingRow).toHaveTextContent("Level 2, Hospital Ave car park");
    expect(parkingRow).toHaveTextContent("24/7");

    const itGroup = screen.getByTestId("on-call-logistics-group-it");
    const itRow = within(itGroup).getByTestId("on-call-logistics-row-it-helpdesk");
    expect(itRow).toHaveAttribute("href", "tel:1800111222");
  });

  it("renders a real empty state when there are no logistics entries", () => {
    render(<OnCallLogisticsSection entries={[]} now={NOW} />);
    expect(screen.getByTestId("on-call-logistics-empty")).toBeInTheDocument();
  });
});
