import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-handover.dom.test.tsx, ward-escalation.dom.test.tsx,
// ward-screen.dom.test.tsx): `ClinicalRail` renders next/link anchors and this suite checks the
// result row's href directly rather than actually navigating, so a plain <a> avoids an App Router
// context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Raises the same `ADVANCE_CLOCK` demo event the real demo controls dispatch, so this suite can
 * move the shared clock without reaching into the reducer directly — mirrors `ClockAdvancer` in
 * ward-handover.dom.test.tsx and ward-escalation.dom.test.tsx. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

function renderSearch() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
      <ClockAdvancer minutes={100} />
    </WardFlowProvider>,
  );
}

const { movements } = seedWardFlowState();
const openCount = movements.filter(isOpen).length;

describe("PatientSearchPage", () => {
  it("renders the root, the three labelled fields, and the results section", () => {
    renderSearch();

    expect(screen.getByTestId("ward-patient-search")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-results")).toBeInTheDocument();
  });

  // This page owns its own single search field, a stage select and a department select — never a
  // second, shell-mounted composer. Asserted directly: exactly one text input and exactly one
  // <form> exist anywhere on the rendered page.
  it("owns exactly one search composer: one text input, one form", () => {
    renderSearch();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(document.querySelectorAll("form")).toHaveLength(1);
  });

  it("shows every open movement with no filters applied, matching the measured open count", () => {
    renderSearch();
    const rows = within(screen.getByTestId("ward-patient-search-results")).getAllByRole("row");
    // One header row plus one row per open movement.
    expect(rows.length - 1).toBe(openCount);
    expect(screen.getByRole("heading", { name: `${openCount} matches` })).toBeInTheDocument();
  });

  it("narrows to the matching movement when searching by id, and links to its patient page", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "wf-003" } });

    const results = screen.getByTestId("ward-patient-search-results");
    expect(within(results).getByText("WF-003")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 match" })).toBeInTheDocument();

    const link = within(results).getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/patients/WF-003");
  });

  it('renders the explicit "No matches" note — never a bare empty table — for a query nothing fits', () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzz-no-such-movement" } });

    expect(screen.getByTestId("ward-patient-search-empty")).toHaveTextContent("No matches");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0 matches" })).toBeInTheDocument();
  });

  // THE ABSOLUTE RULE, proven on the rendered page rather than only against the pure function:
  // WF-007 is closed in the real fixture (see tests/ward-patient-search.test.ts's own comment for
  // its exact closure fields). Searching its own id, verbatim, must render the explicit "No
  // matches" note — a closed patient must never surface as though still in the system.
  it("never renders a closed movement, even when the query is the closed movement's own id", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "wf-007" } });

    expect(screen.getByTestId("ward-patient-search-empty")).toHaveTextContent("No matches");
    expect(screen.queryByText("WF-007")).not.toBeInTheDocument();
  });

  it("narrows by the stage select alone", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "bed_held" } });

    // Measured (tests/ward-patient-search.test.ts): exactly seven OPEN movements are "bed_held".
    expect(screen.getByRole("heading", { name: "7 matches" })).toBeInTheDocument();
    const results = screen.getByTestId("ward-patient-search-results");
    expect(within(results).getAllByText("Bed held").length).toBe(7);
  });

  it("narrows by the department select alone", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "arm-ed" } });

    // Measured (tests/ward-patient-search.test.ts): exactly four OPEN movements originate at
    // "arm-ed".
    expect(screen.getByRole("heading", { name: "4 matches" })).toBeInTheDocument();
  });

  // This board is deliberately live, like the escalation board and unlike the frozen shift
  // handover: advancing the shared clock must move the "Since arrival" column forward.
  it("stays live: the results table advances when the shared clock advances", () => {
    renderSearch();

    const before = screen.getByTestId("ward-patient-search-results").textContent ?? "";
    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));
    const after = screen.getByTestId("ward-patient-search-results").textContent ?? "";

    expect(after).not.toBe(before);
  });
});

describe("search finds PEOPLE, including ones the movement search structurally cannot", () => {
  /*
   * WHY THIS IS A DIFFERENT CLAIM FROM THE TESTS ABOVE. `searchMovements` applies `isOpen` first and
   * unconditionally, so it can only ever return somebody mid-journey. A patient who has been
   * referred but not moved, one who has arrived on a ward, and one who has just been added and has
   * nothing attached at all are all invisible to it.
   *
   * The last is the case the owner's flow turns on: "search a patient, and if nobody comes up, ADD
   * them." You cannot know that nobody came up if the search can only see people already in transit
   * — it would report "no match" for somebody sitting in the system, and the clinician would add a
   * duplicate.
   */
  it("finds a person by record number even though they have no movement at all", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "UM100001" } });

    const people = screen.getByTestId("ward-patient-search-people-list");
    expect(
      within(people).getByText(/Halloway/),
      "a seeded patient with no open movement must still be findable. If this fails, search is still " +
        "looking at journeys rather than people, and 'if nobody comes up, add them' cannot be trusted.",
    ).toBeInTheDocument();
  });

  it("finds related spellings, not just exact ones", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "hallow" } });

    const people = screen.getByTestId("ward-patient-search-people-list");
    expect(within(people).getByText(/Talia Halloway/)).toBeInTheDocument();
    expect(
      within(people).getByText(/Marcus Hallowin/),
      "the near-miss pair is seeded for exactly this. A search that returned only the exact spelling " +
        "would look correct on this fixture and hide the person a clinician was actually looking for.",
    ).toBeInTheDocument();
  });

  it("says plainly that nobody is known, rather than showing an empty list", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzznobody" } });

    expect(
      screen.getByTestId("ward-patient-search-people-empty"),
      "an empty result must SAY nobody is known and what that means. A blank space reads as a page " +
        "that has not loaded, and the decision resting on it is whether to add a person.",
    ).toHaveTextContent("need adding before they can be referred");
  });

  it("prompts rather than listing everybody before anything is typed", () => {
    // A search that returned every patient on an empty query would make the "nobody came up" signal
    // meaningless — and would put the whole synthetic patient list on screen unasked.
    renderSearch();
    expect(screen.getByTestId("ward-patient-search-people-idle")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-people-list")).toBeNull();
  });
});
