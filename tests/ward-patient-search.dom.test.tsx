import { declinedAddressings, referralState } from "../src/components/ward-management/ward-referrals";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";
import type { Referral } from "@/components/ward-management/ward-model";

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

import { PatientSearchPage, ResultsSection } from "@/components/ward-management/search/patient-search";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

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
/** The waiting referrals the search now also covers — see the heading assertion below for why the
 *  heading counts these and the table does not. */
const queuedReferrals = seedWardFlowState().referrals.filter((referral) => referralState(referral) === "queued");

describe("PatientSearchPage", () => {
  it("renders the root, the three labelled fields, and the results section", () => {
    renderSearch();

    expect(screen.getByTestId("ward-patient-search")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-results")).toBeInTheDocument();
  });

  // THE DEFECT this guards against: the page is titled "Patient search" but, before this fix, its
  // own subtitle and placeholder described only a movement lookup ("Find an open movement by id,
  // department, destination, stage or owner." / "Movement id, destination, owner…") even though the
  // same box also finds a PERSON by name or record number (see the "search finds PEOPLE" suite
  // below — that capability already worked). A working feature that describes itself as something
  // else is indistinguishable, to a reader, from a missing one. This test pins that the on-screen
  // copy names the person-finding half of what the box does, not just the movement half.
  it("tells the reader the search finds a person, not only a movement", () => {
    renderSearch();

    expect(screen.getByText(/Find a person by name or record number/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveAttribute("placeholder", expect.stringMatching(/name/i));
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

    /*
     * The heading counts BOTH records and the table counts one, and that is deliberate rather than
     * an inconsistency to reconcile. As of 2026-08-30 the search covers waiting referrals as well
     * as open movements — a person referred and not yet accepted has no movement at all, and the
     * owner's requirement is that they show up. The table above is movement-shaped (stage,
     * department, destination, time since arrival) and referrals have none of those, so they are
     * listed separately; the heading is the count of everything found.
     *
     * Stated as a sum with both halves named rather than re-baselined to whatever the page now
     * prints. A number copied out of a failing test is a screenshot of the current behaviour, and
     * it agrees with a defect exactly as readily as with a fix.
     */
    const queuedReferralCount = queuedReferrals.length;
    expect(queuedReferralCount, "no queued referral seeded — this assertion would prove nothing").toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: `${openCount + queuedReferralCount} matches` })).toBeInTheDocument();
  });

  it("narrows to the matching movement when searching by id, and links to its movement page", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "wf-003" } });

    const results = screen.getByTestId("ward-patient-search-results");
    expect(within(results).getByText("WF-003")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 match" })).toBeInTheDocument();

    const link = within(results).getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/movements/WF-003");
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

    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "pulled" } });

    // Measured (tests/ward-patient-search.test.ts): exactly seven OPEN movements are "pulled".
    expect(screen.getByRole("heading", { name: "7 matches" })).toBeInTheDocument();
    const results = screen.getByTestId("ward-patient-search-results");
    expect(within(results).getAllByText("Bed pulled").length).toBe(7);
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

  // FIX 2: before this fix, `findPatients` matched `umrn` with `===`, so a bare, partial record
  // number found nobody even though the identical partial NAME already worked two tests up. A
  // clinician remembers the digits, not the "UM" prefix — searching just the digits must find the
  // same person the full record number does.
  it("finds the same person by a bare, partial record number — no 'UM' prefix, no full match", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "100001" } });

    const people = screen.getByTestId("ward-patient-search-people-list");
    expect(within(people).getByText(/Halloway/)).toBeInTheDocument();
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

    expectSays(screen.getByTestId("ward-patient-search-people-empty"), "the not-in-system note", [
      "before they can be referred",
      "adding",
    ]);
  });

  it("prompts rather than listing everybody before anything is typed", () => {
    // A search that returned every patient on an empty query would make the "nobody came up" signal
    // meaningless — and would put the whole synthetic patient list on screen unasked.
    renderSearch();
    expect(screen.getByTestId("ward-patient-search-people-idle")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-people-list")).toBeNull();
  });
});

/*
 * 🔴 WHAT THIS SCREEN ASSERTS ABOUT A BED, AND WHAT THE RECORD ACTUALLY HOLDS.
 *
 * Both defects below shipped green through fifty-nine passing DOM assertions, because every one of
 * those asserted that a cell RENDERED rather than that it was TRUE. These two assert the property
 * over the fixture and name the row that would break them.
 */
describe("the results table never claims more than the record holds", () => {
  /*
   * ⚠️ THE POPULATION IS FLOORED, NOT THE FINDING. This walks every open movement with live
   * referrals and no acceptance — the only rows that can exhibit the defect. If the fixture stops
   * containing any, this test would pass by walking nothing, so the floor below fails FIRST and
   * says so. Flooring the population walked is the check; flooring the number of violations would
   * be an assertion that the defect exists, which is the opposite of what is wanted.
   */
  it("shows no destination for a patient no ward has accepted, however many wards were asked", () => {
    const referredNotAccepted = wardMovements
      .filter(isOpen)
      .filter((movement) => movement.referredUnitIds.length > 0 && movement.acceptedUnitId === undefined);

    expect(
      referredNotAccepted.length,
      "no open movement has live referrals and no acceptance, so this test walks nothing and proves " +
        "nothing. Do not delete it — find out what changed in the fixture and re-point it.",
    ).toBeGreaterThan(0);

    renderSearch();
    const results = screen.getByTestId("ward-patient-search-results");

    for (const movement of referredNotAccepted) {
      const row = within(results).getByText(movement.id).closest("tr");
      expect(row, `movement ${movement.id} is missing from the results table entirely`).not.toBeNull();
      const cells = [...(row as HTMLTableRowElement).cells].map((cell) => cell.textContent ?? "");

      /*
       * 🔴 THE PROPERTY, WITH NO VOCABULARY IN IT. Rewritten twice on 2026-09-04, and the two
       * discarded versions are why this one is shaped the way it is.
       *
       * v1 asserted that NO referred ward's name may appear anywhere on the row. That was an EXACT
       * proxy while the only way such a name could appear was as the destination, and it caught the
       * real defect — the cell printing the first ward ASKED as though it were the destination. It
       * stopped being exact when the cell began naming the wards asked ALONGSIDE an explicit denial
       * ("2 wards asked, none has accepted — Ward A, Ward B"), which exists because the search
       * haystack matches on a ward's name: without it the coordinator types a ward and the ward
       * vanishes from the row, leaving a result with no visible reason.
       *
       * ⚠️ v2 REPLACED ONE ALLOWED PHRASE WITH THREE AND CALLED IT A PROPERTY. A reviewer listed
       * the truthful denials it would have gone RED on — "not yet accepted by any ward", "awaiting
       * acceptance", "No acceptance recorded", "0 wards have accepted", "Nobody has accepted this
       * patient" — and noted that the movement workspace masthead already says "No ward has
       * accepted this patient", so harmonising the two screens would have turned this red on the
       * harmonisation. It was the same defect as v1, occurring three times less often, sitting
       * under a comment that described it as the property.
       *
       * v3, below, names no wording at all. The population is chosen from the MODEL — referred,
       * never accepted — and the assertion is that this movement's DESTINATION CELL says something
       * beyond ward names. A cell that is nothing but ward names reads as "this is where they are
       * going", which is the false claim; a cell that is empty says nothing at all, which was the
       * other half of the original defect. Both now fail here, and every rewording above passes.
       *
       * ⚠️ Cell-scoped, not row-scoped. v2 tested the joined row, so a denial in any OTHER column
       * satisfied a claim about the destination. Latent today (only this column can carry that
       * text) and live the day anyone adds a column.
       *
       * The column is found from the table's own header rather than by index, so inserting a
       * column ahead of it cannot silently re-point this at the wrong cell.
       */
      const headerTexts = [...results.querySelectorAll("thead th")].map((th) => th.textContent ?? "");
      const destinationColumn = headerTexts.findIndex((text) => /destination/i.test(text));
      expect(
        destinationColumn,
        `the results table has no column whose header matches /destination/i — headers read ` +
          `${JSON.stringify(headerTexts)}. This test cannot locate the cell it is about.`,
      ).toBeGreaterThanOrEqual(0);

      const destinationCellText = (cells[destinationColumn] ?? "").trim();
      let residue = destinationCellText;
      for (const unit of allUnits()) residue = residue.split(unit.name).join("");
      residue = residue.replace(/[\s,;.—–-]+/gu, "");

      expect(
        residue.length,
        `${movement.id} has NOT been accepted anywhere, yet its Destination cell reads ` +
          `${JSON.stringify(destinationCellText)} — which is nothing but ward names` +
          `${destinationCellText === "" ? " (in fact it is empty)" : ""}. A cell containing only ` +
          `the wards that were ASKED reads as the ward they are GOING to, and a coordinator would ` +
          `believe a bed exists. Say something: name the wards if it helps, but say that none has ` +
          `accepted.`,
      ).toBeGreaterThan(0);
    }
  });

  /*
   * `elapsedLabel` measures from `openedAt`, and `Movement` carries no arrival instant — `arrivedAt`
   * was deliberately deleted. `Referral.triagedAt`'s doc comment forbids the wording in terms.
   *
   * ⚠️ This asserts over the HEADER ROW ONLY, deliberately. "Since arrival" is CORRECT on the
   * out-of-area ledger, where it is fed by a real admission, so a repo-wide text ban would be wrong
   * and would go red on truthful copy.
   */
  it("does not word an opened-at clock as an arrival", () => {
    renderSearch();
    const headers = [...screen.getByTestId("ward-patient-search-results").querySelectorAll("thead th")].map(
      (cell) => cell.textContent ?? "",
    );

    expect(headers.length, "the results table has no header row to check").toBeGreaterThan(0);
    expect(
      headers.some((text) => /arriv/i.test(text)),
      "a column here is worded as arrival, but every time on this table is measured from `openedAt` " +
        "and this model records no arrival instant. Triage is not arrival and no screen may word it " +
        "as one (see `Referral.triagedAt`).",
    ).toBe(false);
  });
});

/*
 * 🔴 THE REFERRAL ROW NEVER SAID HOW MANY DESTINATIONS HAD ALREADY DECLINED.
 *
 * Every queued-referral row rendered the same sentence — "waiting for a decision, no bed accepted
 * yet" — whether nobody had been asked yet or several destinations had already said no. Those are
 * opposite clinical situations and the sentence could not tell them apart. `declinedAddressings`
 * already existed for exactly this and this row never called it.
 *
 * Both fixtures below are built from a REAL seeded referral (RF-011: two queued destinations, one
 * ward and one ED) rather than invented from scratch, so the shape stays whatever `Referral`
 * actually requires. Only `destinations` is touched.
 *
 * ⚠️ THE EXPECTED COUNTS ARE COMPUTED FROM THE MODEL, NEVER HAND-TYPED. `declinedAddressings` is
 * the same function the component must call — asserting a hand-typed "1" would pass even if the
 * component counted something else that happened to also be 1 on this fixture.
 */
describe("the referral row states how many destinations have declined", () => {
  const seededReferrals = seedWardFlowState().referrals;
  const baseReferral = seededReferrals.find((referral) => referral.id === "RF-011");
  if (!baseReferral) {
    throw new Error("fixture RF-011 (two queued destinations) is required by this suite and is missing");
  }
  // Guards the fixture assumption this whole suite is built on: two destinations, neither declined.
  if (baseReferral.destinations.length !== 2 || declinedAddressings(baseReferral).length !== 0) {
    throw new Error("RF-011 no longer has two queued destinations with none declined — re-point this fixture");
  }

  const noneDeclinedReferral: Referral = baseReferral;

  const partiallyDeclinedReferral: Referral = {
    ...baseReferral,
    id: "RF-011-TEST-partial-decline",
    destinations: [
      {
        ...baseReferral.destinations[0],
        state: "declined",
        declineReason: "belongs_to_another_service",
        decidedAt: NOW_ANCHOR - 10,
        decidedBy: "Flow coordinator",
      },
      baseReferral.destinations[1],
    ],
  };
  // Guards that the mutation actually produced a still-QUEUED referral with exactly one decline —
  // the case this fix is for. If this ever fails, the built fixture no longer exercises the row
  // this suite exists to check.
  if (
    referralState(partiallyDeclinedReferral) !== "queued" ||
    declinedAddressings(partiallyDeclinedReferral).length !== 1
  ) {
    throw new Error("the constructed partial-decline fixture is no longer queued-with-one-decline");
  }

  function renderRow(referral: Referral) {
    render(<ResultsSection results={[{ kind: "referral", referral }]} units={allUnits()} now={NOW_ANCHOR} />);
    return screen.getByTestId(`ward-patient-search-referral-${referral.id}`);
  }

  it("says nothing has declined when declinedAddressings is empty", () => {
    const row = renderRow(noneDeclinedReferral);
    const declinedCount = declinedAddressings(noneDeclinedReferral).length;

    expect(declinedCount, "this fixture is the zero-decline case; if it is not 0 the test proves nothing").toBe(0);
    expect(row).not.toHaveTextContent(/declined/i);
  });

  it("states the exact number of destinations that have declined, computed from declinedAddressings", () => {
    const row = renderRow(partiallyDeclinedReferral);
    const declinedCount = declinedAddressings(partiallyDeclinedReferral).length;
    const totalCount = partiallyDeclinedReferral.destinations.length;

    expect(row).toHaveTextContent(String(declinedCount));
    expect(row).toHaveTextContent(new RegExp(`\\b${declinedCount}\\b.*declined`, "i"));
    // The referral is still QUEUED — at least one destination has not declined — so a sentence
    // claiming every destination declined would be a false claim this data cannot support.
    expect(row).not.toHaveTextContent(/all.*declined/i);
    expect(row).toHaveTextContent(String(totalCount));
  });

  it("uses different wording for zero declines than for one or more — not the same template with a swapped number", () => {
    const zeroRow = renderRow(noneDeclinedReferral);
    const zeroText = zeroRow.textContent ?? "";
    document.body.innerHTML = "";
    const declinedRow = renderRow(partiallyDeclinedReferral);
    const declinedText = declinedRow.textContent ?? "";

    // Strip the shared prefix (origin/age/region, which both rows legitimately share) and compare
    // only the clause this fix actually changes.
    const zeroClause = zeroText.split("—")[1] ?? zeroText;
    const declinedClause = declinedText.split("—")[1] ?? declinedText;
    expect(declinedClause).not.toBe(zeroClause);
  });

  it("never claims a declined destination is a 'ward' when the model does not say so — a declined destination can be an ED or a community team", () => {
    // RF-011's first destination (the one mutated to declined above) is a psychiatric ward, so this
    // fixture alone cannot prove the word "ward" is safe in general. The row must not assert
    // "ward" from `declinedAddressings` alone, since a declined addressing can be any of the three
    // destination kinds and the component has no per-kind branch.
    const edDeclinedReferral: Referral = {
      ...baseReferral,
      id: "RF-011-TEST-ed-decline",
      destinations: [
        baseReferral.destinations[0],
        {
          ...baseReferral.destinations[1],
          state: "declined",
          declineReason: "belongs_to_another_service",
          decidedAt: NOW_ANCHOR - 10,
          decidedBy: "Flow coordinator",
        },
      ],
    };
    expect(referralState(edDeclinedReferral)).toBe("queued");
    expect(declinedAddressings(edDeclinedReferral).length).toBe(1);

    const row = renderRow(edDeclinedReferral);
    expect(
      row,
      "the declined destination here is an emergency department, not a ward — the row must not say " +
        '"ward" for a count that includes non-ward destinations.',
    ).not.toHaveTextContent(/\bwards?\b/i);
  });
});
