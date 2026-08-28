import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Same reason as every sibling dom suite (ward-discharge-board.dom.test.tsx,
// ward-handover.dom.test.tsx, ward-ed-screen.dom.test.tsx): `ClinicalRail` renders next/link
// anchors and this suite never checks routing, so a plain <a> avoids an App Router context
// jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_SOURCES,
  SEXES,
  URGENCY_LEVELS,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { referrals } from "@/components/ward-management/ward-movements";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import {
  INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  travelBand,
  TRAVEL_BAND_LABELS,
  TRAVEL_BANDS,
  unitTravelBand,
  type TravelBand,
} from "@/components/ward-management/ward-distance";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * Phase 8, Task 4. The order the match view renders units in once they are grouped by travel band:
 * the fixed band order (`TRAVEL_BANDS`, then not-recorded), and INSIDE each band the site table's
 * own order — the property spec D10 turns on, that a row never moves because it accepts the
 * referral.
 *
 * Derived from `unitTravelBand` directly and NEVER from `groupCandidatesByTravelBand`. An
 * expectation computed by calling the very derivation the screen calls would move with it, so a
 * screen that grouped by something else entirely would still agree with its own expectation.
 */
function expectedGroupedUnitIds(referral: Referral): string[] {
  const units = allUnits();
  const bandsInOrder: (TravelBand | undefined)[] = [...TRAVEL_BANDS, undefined];
  return bandsInOrder.flatMap((band) =>
    units.filter((unit) => unitTravelBand(referral, unit) === band).map((unit) => unit.id),
  );
}

/** Every unit id the match view actually rendered, in DOM order. Read with `querySelectorAll`
 *  rather than a role query on purpose: the band groups are `<details>`, and a role query would
 *  quietly return nothing for a shut group, turning a completeness assertion into a vacuous one. */
function renderedUnitIds(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll("li[data-testid]")).map((row) =>
    (row.getAttribute("data-testid") ?? "").replace(/^ward-referral-match-row-/, ""),
  );
}

/** The accept controls the match view rendered, found without a role query for the same reason. */
function acceptButtons(list: HTMLElement): HTMLButtonElement[] {
  return Array.from(list.querySelectorAll("button")).filter((button) =>
    /^Accept at /.test(button.textContent ?? ""),
  ) as HTMLButtonElement[];
}

/** The seeded referral behind a board row, so a test can compute the band order for the very
 *  referral the screen is showing rather than for one it assumes matches. */
function seededReferral(id: string): Referral {
  const found = referrals.find((referral) => referral.id === id);
  expect(found, `the seed no longer contains ${id} — this test can no longer prove anything`).toBeDefined();
  return found!;
}

/** Mirrors `ward-discharge-board.dom.test.tsx`'s own harness pattern: a real reducer-backed
 *  count, read off shared context, so a test can prove a dispatch actually happened (or did
 *  not) rather than only inspecting what the form's own DOM renders. */
function RejectionCount() {
  const { rejections } = useWardFlow();
  return <span data-testid="rejection-count">{rejections.length}</span>;
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
      <RejectionCount />
    </WardFlowProvider>,
  );
}

const EXPECTED_FIELD_TESTIDS = [
  "ward-referral-intake-ageBand",
  "ward-referral-intake-sex",
  "ward-referral-intake-homeRegion",
  "ward-referral-intake-secureBedNeeded",
  "ward-referral-intake-involuntaryBedNeeded",
  "ward-referral-intake-source",
  "ward-referral-intake-urgency",
  "ward-referral-intake-originSiteCode",
  "ward-referral-intake-transportNeeded",
];

function optionValues(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value);
}

describe("ReferralIntakeForm", () => {
  it("renders exactly one control for every field the model permits, and nothing else", () => {
    renderForm();

    for (const testId of EXPECTED_FIELD_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.getByTestId("ward-referral-intake-submit")).toBeInTheDocument();

    // Every data-testid on the page is unique — a duplicate is a guaranteed strict-mode
    // failure in the browser test (this already happened once this phase). getByTestId
    // itself throws on more than one match, so a bare call for each id above already proves
    // uniqueness for those; this asserts it for the DOM as a whole too.
    const { container } = renderForm();
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no free-text input of any kind anywhere on the form", () => {
    renderForm();

    const form = screen.getByTestId("ward-referral-intake-form");
    const freeTextControls = form.querySelectorAll(
      'input[type="text"], input[type="search"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]',
    );
    expect(freeTextControls).toHaveLength(0);
  });

  it("offers every age band from COHORTS — the four-time defect class this phase keeps hitting", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-ageBand");
    expect(optionValues(select)).toEqual([...COHORTS]);
  });

  it("offers every home region from HOME_REGIONS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-homeRegion");
    expect(optionValues(select)).toEqual([...HOME_REGIONS]);
  });

  it("offers every referral source from REFERRAL_SOURCES", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-source");
    expect(optionValues(select)).toEqual([...REFERRAL_SOURCES]);
  });

  it("offers every real network site as an origin option", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-originSiteCode");
    expect(optionValues(select)).toEqual(wardSites.map((site) => site.code));
  });

  it("offers every sex from SEXES — Task 5's fix for the same defect class COHORTS already closed", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-sex");
    expect(optionValues(select)).toEqual([...SEXES]);
  });

  it("offers every urgency tier from URGENCY_LEVELS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    expect(optionValues(select)).toEqual(URGENCY_LEVELS.map(String));
  });

  /**
   * Phase 7 Task 8, found by looking at the screen rather than by any test. The picker rendered a
   * bare "1", "2", "3" while the referral board rendered "Tier 2 · urgent" for the very same
   * field — two screens describing one field in two different words, which is this project's most
   * expensive defect class. It matters most here: this is the one screen where a human CHOOSES
   * the value rather than reading it back, on a phone, possibly from a police car, and neither
   * the digit nor the direction of the scale is self-evident to someone meeting it for the first
   * time.
   *
   * The existing test above could not catch it: it reads each option's `value` attribute, which
   * was correct throughout and is deliberately still the bare tier. This one reads the TEXT.
   *
   * Asserted against `urgencyTierLabel` itself rather than against three hard-coded strings, so
   * the guard is "the picker and the boards use one spelling", not "the picker uses the spelling
   * this test happens to remember". Two copies agreeing is what failed here; one export is why it
   * cannot fail the same way again.
   */
  it("labels every urgency option with its direction, in the same words the boards use", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    const optionText = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    // Non-vacuity: the labels really do carry a direction, so a future `urgencyTierLabel`
    // returning the bare tier again would fail here even though the line above still matched.
    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });

  /**
   * Review finding I4. Every `<select>` on this form used to sit inside a `<fieldset>` with a
   * `<legend>` — which names the fieldset's own `group` role and NOT the control inside it, so
   * all six announced as unnamed combo boxes. This is the phone-first screen spec D12 puts in
   * front of a police or ambulance officer, and the six unnamed controls carried the five
   * permitted facts about a person.
   *
   * `getByLabelText` is the assertion that matters: it resolves through the accessible name
   * only, so a `<legend>` (or a `<div>` that merely LOOKS like a label) cannot satisfy it. Each
   * name is then required to resolve to the very control the rest of this suite drives by
   * `data-testid`, so a label pointing at the wrong `id` — a real and silent failure mode of
   * `htmlFor` — fails here rather than reading as a pass.
   */
  it("gives every select a real accessible name, resolving to that same control", () => {
    renderForm();

    const named: [string, string][] = [
      ["Age band", "ward-referral-intake-ageBand"],
      ["Sex", "ward-referral-intake-sex"],
      ["Home region", "ward-referral-intake-homeRegion"],
      ["Referral source", "ward-referral-intake-source"],
      ["Urgency", "ward-referral-intake-urgency"],
      ["Origin site", "ward-referral-intake-originSiteCode"],
    ];
    for (const [name, testId] of named) {
      expect(screen.getByLabelText(name)).toBe(screen.getByTestId(testId));
    }

    // Non-vacuity: the list above must cover every combobox the form renders, so a seventh
    // picker added later without a name is caught rather than simply going unlisted here.
    expect(screen.getAllByRole("combobox")).toHaveLength(named.length);
  });

  it("describes the request, never the person, for the two need toggles", () => {
    renderForm();

    // The wording rule: "needs a secure bed", never "is a risk"; "needs a bed that can hold
    // someone involuntarily", never "is involuntary" — the requirement attaches to the
    // request, the word never attaches to the person.
    expect(screen.getByText(/needs a secure bed/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a bed that can hold someone involuntarily/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bis involuntary\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bis a risk\b/i)).not.toBeInTheDocument();
  });

  it("submits a well-formed referral with no rejection, using the fixed community role", () => {
    renderForm();

    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
    expect(screen.queryByTestId("ward-referral-intake-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-confirmation")).toBeInTheDocument();
  });

  it("surfaces a visible Rejection, rather than swallowing it, when the reducer refuses the intake", () => {
    renderForm();

    // No option on the real network carries an empty code, so setting the origin site select
    // to a value with no matching <option> leaves the DOM's own resolved value at "" (per the
    // HTMLSelectElement value-setter algorithm: no matching option -> selectedIndex -1 ->
    // value ""). `siteByCode("")` then resolves to nothing, and RECEIVE_REFERRAL's own
    // membership check (ward-flow-reducer.ts) refuses the event — a real reducer refusal, not
    // a fabricated one.
    fireEvent.change(screen.getByTestId("ward-referral-intake-originSiteCode"), {
      target: { value: "no-such-site" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("1");
    const rejection = screen.getByTestId("ward-referral-intake-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/must resolve to a real site/i);
    expect(screen.queryByTestId("ward-referral-intake-confirmation")).not.toBeInTheDocument();
  });
});

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralBoard />
    </WardFlowProvider>,
  );
}

describe("ReferralBoard", () => {
  it("renders exactly the real fixture's two queued referrals, in urgency-then-longest-wait order", () => {
    renderBoard();
    // RF-001 (raised 40 min ago) and RF-005 (raised 20 min ago) are both tier 2 in the real
    // fixture — RF-001 goes first because it has waited longer. See
    // tests/ward-referral-model.test.ts for the pure-function proof this table order is built on.
    const table = screen.getByTestId("ward-referral-board-queued-table");
    const ids = within(table)
      .getAllByRole("row")
      .slice(1) // drop the header row
      .map((row) => row.querySelector("td button")?.textContent);
    expect(ids).toEqual(["RF-001", "RF-005"]);
  });

  /**
   * Task 6. The intake form is deliberately absent from the rail (recorded against
   * `WARD_REFERRAL_INTAKE_HREF` in `WARD_NAV_INTENTIONALLY_UNLISTED`), which makes this board the
   * only way a coordinator reaches it. That makes the link load-bearing rather than decorative:
   * delete it and the intake route becomes unreachable from inside the running app while every
   * structural nav test stays green, because the exemption map still explains the absence.
   *
   * Asserted as an anchor with a real `href`, not merely as text: `router.push` from a click
   * handler would satisfy a "the words New referral appear" check while breaking middle-click,
   * hover preview and every static reachability scan.
   */
  it("offers the intake form as a real link, the only way into it now the rail deliberately omits it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const link = screen.getByTestId("ward-referral-board-new");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", WARD_REFERRAL_INTAKE_HREF);
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/referrals/new");
    expect(link.textContent?.trim()).toBe("New referral");
  });

  // M1 (fix round C): the figure must be bound to its OWN referral, not merely present. The
  // previous `/waiting/i` matched "40m waiting", "20m waiting", "0m waiting" and the bare word,
  // so rendering `referralWaitLabel(queued[0], now)` on every row — RF-001's wait shown against
  // RF-005 — survived it untouched. The real fixture raises RF-001 at NOW_ANCHOR - 40 and RF-005
  // at NOW_ANCHOR - 20, and this is the board's headline requirement, so the values are pinned.
  it("renders each queued referral's own waiting figure, not just the word 'waiting'", () => {
    renderBoard();
    expect(screen.getByTestId("ward-referral-board-wait-RF-001")).toHaveTextContent("40m waiting");
    expect(screen.getByTestId("ward-referral-board-wait-RF-005")).toHaveTextContent("20m waiting");
  });

  it("renders the real fixture's six decided referrals, most recently decided first", () => {
    renderBoard();
    // Real fixture decidedAt offsets from NOW_ANCHOR: RF-002 -10, RF-003 -15, RF-004 -25,
    // RF-006 -5, RF-007 -8, RF-008 -45 (Phase 8 Task 2's added out-of-area seed) — most recent
    // (smallest offset) first, so RF-008 sits last.
    const table = screen.getByTestId("ward-referral-board-decided-table");
    const ids = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td")?.textContent);
    expect(ids).toEqual(["RF-006", "RF-007", "RF-002", "RF-003", "RF-004", "RF-008"]);
  });

  /**
   * M3 (fix round C): `QueuedSection` and `DecidedSection` each map their array TWICE — once into
   * a table (the desk view) and once into `.cardList` (the corridor view at narrow widths). Both
   * existing order tests read only the tables, so a mutation reversing just the card `.map()` was
   * invisible to the whole suite. The module's own CSS comment says "a table is right at a desk
   * and wrong in a corridor"; the corridor view was the untested one. Card testids are asserted
   * rather than text because the card's own markup interleaves the id with the tier qualifier.
   */
  it("renders the queued cards in the same order as the queued table, for the phone view", () => {
    const { container } = renderBoard();
    const cards = Array.from(container.querySelectorAll("[data-testid^='ward-referral-board-card-select-']"));
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "ward-referral-board-card-select-RF-001",
      "ward-referral-board-card-select-RF-005",
    ]);
  });

  it("renders the decided cards in the same order as the decided table, for the phone view", () => {
    const { container } = renderBoard();
    const cards = Array.from(container.querySelectorAll("[data-testid^='ward-referral-board-decided-card-']"));
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "ward-referral-board-decided-card-RF-006",
      "ward-referral-board-decided-card-RF-007",
      "ward-referral-board-decided-card-RF-002",
      "ward-referral-board-decided-card-RF-003",
      "ward-referral-board-decided-card-RF-004",
      "ward-referral-board-decided-card-RF-008",
    ]);
  });

  it("selecting a queued referral opens its match view, and none is open before that", () => {
    renderBoard();
    expect(screen.queryByTestId("ward-referral-match-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
    const panel = screen.getByTestId("ward-referral-match-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("RF-001");
  });

  /**
   * M7 (fix round C): the brief requires the "not a medical device" prose on BOTH screens. The
   * board's banner sits at the top of `<main>`, above two sections and two tables — the match
   * view mounts below all of it, so on a phone the coordinator taking the accept decision has
   * scrolled past it. Asserted on the match panel specifically, not on the document, so deleting
   * the match view's own copy cannot be masked by the board's.
   */
  it("the match view carries its own 'not a medical device' statement, where the decision is taken", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));

    const panel = screen.getByTestId("ward-referral-match-panel");
    const governance = within(panel).getByTestId("ward-referral-match-governance");
    expect(governance).toHaveTextContent(/not a medical device/i);
    expect(governance).toHaveTextContent(/never ranks units by suitability/i);
  });

  /**
   * M5 (fix round C): a `<button>`'s content model is phrasing content, and the queued card's
   * select button wrapped a `<div>` and a `<p>`. No sibling ward screen does this — the discharge
   * board's cards carry no button at all — so it was a new pattern rather than an inherited one.
   */
  it("the queued card's select button contains no flow content", () => {
    renderBoard();
    const button = screen.getByTestId("ward-referral-board-card-select-RF-001");
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelectorAll("div, p, ul, ol, section, h1, h2, h3")).toHaveLength(0);
  });

  it("every data-testid is unique, including with a match view open", () => {
    const { container } = renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("RF-001's match view: no bed accepts, and every unit still carries a reason — never an empty list", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));

    expect(screen.getByTestId("ward-referral-match-no-bed")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-structural-gap")).not.toBeInTheDocument();
    // M2: the denominator is pinned to the real network size. `/^0 of \d+ units/` also matched
    // "0 of 0 units", so a mutation rendering `{accepting.length} of {accepting.length}` — or one
    // excluding forensic beds from the denominator — passed it.
    expect(screen.getByTestId("ward-referral-match-accepting-count")).toHaveTextContent(
      `0 of ${allUnits().length} units accept this referral right now.`,
    );

    const list = screen.getByTestId("ward-referral-match-list");
    // I1 (fix round C, F4): the phase's headline clinical-safety property — every unit renders in
    // the network's own fixed order, and a row NEVER moves because it accepts the referral (spec
    // D10: an ordering that looked like a recommendation would be one). `referralCandidates`'
    // order preservation is well tested as a pure function; what this component RENDERS was not.
    // A row count alone survives sorting every accepting unit to the top, because the count, the
    // test ids, the reason strings and the uniqueness check are all unchanged by a reorder. This
    // one assertion pins order, completeness and non-truncation together, and subsumes the row
    // count it replaces.
    //
    // Phase 8, Task 4: the rows are now grouped by travel band, so the flat expectation became the
    // BAND order with the site table's order preserved inside each band — the same three
    // properties, restated for the layout that now renders them. `expectedGroupedUnitIds` is total
    // over the network (every unit falls in exactly one band bucket), asserted here so a helper
    // that silently dropped units could not make the comparison agree with itself.
    const expected = expectedGroupedUnitIds(seededReferral("RF-001"));
    expect(expected).toHaveLength(allUnits().length);
    expect(renderedUnitIds(list)).toEqual(expected);
    expect(list.querySelectorAll("button")).toHaveLength(0);
  });

  /**
   * I1 (fix round C, F4) — SECOND HALF, and the half that actually bites. The review proposed
   * this assertion on the RF-001 test alone. It was run against the mutation the review itself
   * names (sorting every accepting unit to the top of `referral-match.tsx`'s list) and the whole
   * suite stayed GREEN: RF-001 has ZERO accepting units, so an accepting-first sort is a no-op
   * there and the RF-001 assertion cannot see it. RF-005 has four accepting units, so the same
   * mutation genuinely reorders this list.
   *
   * The RF-001 assertion is kept — it still pins completeness and non-truncation for the
   * zero-accepting case — but this is the one that guards spec D10's headline property: a row
   * NEVER moves because it accepts the referral, because that ordering would read as a
   * recommendation.
   */
  it("RF-005's match view renders every unit in the network's own fixed order, accepting units NOT floated to the top", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const list = screen.getByTestId("ward-referral-match-list");
    const expected = expectedGroupedUnitIds(seededReferral("RF-005"));
    expect(expected).toHaveLength(allUnits().length);
    expect(renderedUnitIds(list)).toEqual(expected);
    // The guard is only meaningful if some unit DOES accept — otherwise an accepting-first sort
    // is a no-op and this test proves nothing, which is exactly how the RF-001 version failed.
    expect(acceptButtons(list).length).toBeGreaterThan(1);
    // Phase 8, Task 4: and only meaningful against the GROUPED layout if at least one band holds a
    // mixture, since a sort inside a single-verdict band is a no-op there too.
    const bandOfMixedVerdicts = [...TRAVEL_BANDS, "not_recorded"].find((band) => {
      const group = screen.getByTestId(`ward-referral-match-band-group-${band}`);
      const rows = Array.from(group.querySelectorAll("li[data-testid]"));
      const accepts = rows.filter((row) => row.querySelector("button") !== null);
      return accepts.length > 0 && accepts.length < rows.length;
    });
    expect(
      bandOfMixedVerdicts,
      "no band holds both an accepting and a non-accepting unit — an accepting-first sort inside a band would be invisible",
    ).toBeDefined();
  });

  it("accepting an eligible unit for RF-005 moves it from queued to recently decided", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const list = screen.getByTestId("ward-referral-match-list");
    const acceptControls = acceptButtons(list);
    // I2 (fix round C, F5): RF-005 has FOUR accepting units, so `/^Accepted at /` alone matched
    // whichever ward the system happened to record. Making `handleAccept` ignore its `unitId`
    // argument and dispatch a different accepting unit kept the old assertion green while the
    // coordinator pressed "Accept at RPH Older Adult" and the record said Bentley. The clicked
    // button's own label is captured here so the decided text has to name THAT unit.
    expect(acceptControls.length).toBeGreaterThan(1);
    const clickedUnitName = acceptControls[0].textContent?.replace(/^Accept at /, "") ?? "";
    expect(clickedUnitName).not.toBe("");
    fireEvent.click(acceptControls[0]);

    expect(screen.queryByTestId("ward-referral-board-select-RF-005")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-decided-row-RF-005")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decided")).toHaveTextContent(`Accepted at ${clickedUnitName}.`);
  });

  /**
   * Review finding I1 / Task 8 finding B: the branch's most embarrassing defect. The match view
   * rendered a bare `Tier 2` inline in its summary line while the board row directly above it —
   * same page, same field, same moment — read "Tier 2 · urgent". This asserts BOTH halves,
   * because either one alone can pass while the screen is still wrong: the tier element must
   * carry `urgencyTierLabel`'s own output, AND the summary line must no longer carry a tier at
   * all (substituting the shared label back into that dot-separated run would produce
   * "Adult · Female · Tier 2 · urgent · Perth Metropolitan", a worse screen, not a better one).
   *
   * Read against `urgencyTierLabel` itself, never a hard-coded string, so this is a guard on
   * "one spelling", not on the spelling this test happens to remember.
   */
  it("the match view spells the urgency tier exactly as the board does, and never inside the summary line", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const referral = referrals.find((candidate) => candidate.id === "RF-005")!;
    const expected = urgencyTierLabel(referral.urgency);
    expect(screen.getByTestId("ward-referral-match-tier")).toHaveTextContent(expected);

    // The very same spelling is on the board row above it — the two strings this defect had
    // disagreeing, asserted together rather than one at a time.
    expect(screen.getByTestId("ward-referral-board-row-RF-005")).toHaveTextContent(expected);

    // And the summary line carries no tier of any kind. Exact text, not `toContainText`: a
    // summary that put the tier back would still "contain" the three fields below.
    expect(screen.getByTestId("ward-referral-match-summary")).toHaveTextContent(
      `${referral.ageBand} · ${referral.sex} · ${referral.homeRegion}`,
    );
    expect(screen.getByTestId("ward-referral-match-summary").textContent).not.toMatch(/Tier/);
  });

  /**
   * Review finding I3, and spec D14's own Risks sentence: "An accepted referral goes nowhere
   * (D14). Deliberate, and the board must say so rather than implying a handover happened."
   * Nothing on either referral screen said so. `ACCEPT_REFERRAL` creates no `Movement`, holds no
   * bed and arranges no transfer — a colleague shown "RF-006 | Accepted" and nothing else could
   * reasonably conclude otherwise.
   */
  it("the decided section says plainly that an acceptance holds no bed and creates no movement", () => {
    renderBoard();
    const note = screen.getByTestId("ward-referral-board-decided-note");
    expect(note).toHaveTextContent(/no bed is held/i);
    expect(note).toHaveTextContent(/no movement is created/i);
  });

  /**
   * The other half of I3: the decided rows named no unit and gave no reason, and the ONE screen
   * that carried either (the match view's decided panel) was reachable only in the moment
   * straight after deciding a referral you had selected — select anything else, or reload, and
   * it was gone for good. A decline reason that cannot be read back makes the fixed reason list,
   * the entire mechanism by which this phase justifies holding no free text, worthless here.
   *
   * Both outcome kinds, from the shipped fixture: RF-006 accepted (names its unit) and RF-004
   * declined `belongs_to_another_service` (names the reason, in `DECLINE_REASON_LABELS`' own
   * words).
   */
  it("every decided row names its accepting unit, or its decline reason", () => {
    renderBoard();

    const acceptedUnitId = referrals.find((candidate) => candidate.id === "RF-006")!.acceptedUnitId!;
    const acceptedUnitName = allUnits().find((unit) => unit.id === acceptedUnitId)!.name;
    expect(screen.getByTestId("ward-referral-board-decided-detail-RF-006")).toHaveTextContent(acceptedUnitName);

    const declineReason = referrals.find((candidate) => candidate.id === "RF-004")!.declineReason!;
    expect(screen.getByTestId("ward-referral-board-decided-detail-RF-004")).toHaveTextContent(
      DECLINE_REASON_LABELS[declineReason],
    );

    // Non-vacuity, and the phone view too: every decided referral carries a detail on both
    // renderings, so a row that silently lost one cannot hide behind these two named cases.
    const decided = referrals.filter((candidate) => candidate.state !== "queued");
    expect(decided.length).toBeGreaterThan(1);
    for (const referral of decided) {
      expect(screen.getByTestId(`ward-referral-board-decided-detail-${referral.id}`).textContent).not.toBe("");
      expect(screen.getByTestId(`ward-referral-board-decided-detail-card-${referral.id}`).textContent).not.toBe("");
    }
  });

  it("declining a queued referral moves it to recently decided with the chosen reason", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    fireEvent.change(screen.getByTestId("ward-referral-match-decline-reason"), {
      target: { value: "belongs_to_another_service" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-match-decline"));

    expect(screen.queryByTestId("ward-referral-board-select-RF-005")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-decided-row-RF-005")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decided")).toHaveTextContent(
      /^Declined — Belongs to another service\.$/,
    );
  });
});

/** A referral this suite constructs itself, so the structural-gap and rejection-surfacing tests
 *  below can control `units` directly rather than depending on the real fixture happening to
 *  contain the right shape of gap. */
const SYNTHETIC_YOUTH_REFERRAL: Referral = {
  id: "RF-TEST-STRUCTURAL",
  ageBand: "Youth",
  sex: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  homeRegion: "Perth Metropolitan",
  source: "community",
  raisedAt: NOW_ANCHOR - 10,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  state: "queued",
};

/** `ReferralMatchView` takes `units`/`referral` as explicit props (never reading them from
 *  context itself, the same reason `ShortlistPanel` takes `units` as a prop) — this harness is
 *  what lets a test hand it a deliberately different `units` array from the provider's own live
 *  state, either to construct a structural gap the real fixture does not contain, or (in the
 *  rejection-surfacing suite below) to prove the reducer validates independently of what this
 *  component's own props believe. */
function MatchHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

function renderMatch(referral: Referral, units: Unit[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MatchHarness referral={referral} units={units} />
    </WardFlowProvider>,
  );
}

describe("ReferralMatchView — structural vs operational gap", () => {
  it("an age band with no unit anywhere in the network reads as a structural fact, never 'no bed available'", () => {
    const unitsWithoutYouth = allUnits().filter((unit) => unit.cohort !== "Youth");
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, unitsWithoutYouth);

    const banner = screen.getByTestId("ward-referral-match-structural-gap");
    expect(banner).toHaveTextContent("No youth unit exists in this network.");
    expect(banner).not.toHaveTextContent(/no bed available/i);
    expect(screen.queryByTestId("ward-referral-match-no-bed")).not.toBeInTheDocument();
    // I3 (fix round C, F6): the accepting-count paragraph used to render unconditionally, so this
    // screen read "No youth unit exists in this network." followed by "0 of 22 units accept this
    // referral right now." — and "right now" asserts that this may be different later, when there
    // is no youth bed anywhere to free up. That is the structural/operational distinction the
    // banner above exists to make, undone one line beneath it.
    expect(screen.queryByTestId("ward-referral-match-accepting-count")).not.toBeInTheDocument();
  });

  it("the same age band against the real, unmodified network shows no structural gap", () => {
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, allUnits());
    expect(screen.queryByTestId("ward-referral-match-structural-gap")).not.toBeInTheDocument();
  });
});

/** Raises a fresh, real referral (via `RECEIVE_REFERRAL`, so it genuinely resolves inside the
 *  live reducer's `state.referrals`) and reviews it against a DECEIVED copy of `units` — every
 *  unit as this harness's own props see it, except the network's one forensic bed
 *  (`brm-adult-secure`), which this harness lies about (`forensic: false`) so the component's own
 *  rendering believes it is eligible and shows an Accept button for it. The live provider's real
 *  internal unit list is untouched, so `ACCEPT_REFERRAL`'s own `referralEligibility` check (inside
 *  the reducer) still sees the real forensic bed and refuses — proving the reducer validates
 *  independently of what the UI believes, the same property `referral-intake.tsx`'s own rejection
 *  test proves for `RECEIVE_REFERRAL`. */
function RaiseAndReviewForensicHarness() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const created = referrals.find((referral) => referral.id === "RF-901");
  return (
    <div>
      <button
        type="button"
        data-testid="raise-forensic-test-referral"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            sex: "Male",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            homeRegion: "Kimberley",
            source: "police",
            urgency: 2,
            originSiteCode: "BRM",
            transportNeeded: false,
          })
        }
      >
        Raise
      </button>
      {created ? (
        <ReferralMatchView
          referral={created}
          units={units.map((unit) => (unit.id === "brm-adult-secure" ? { ...unit, forensic: false } : unit))}
          now={now}
          dispatch={dispatch}
          rejections={rejections}
        />
      ) : null}
    </div>
  );
}

describe("ReferralMatchView — reducer refusal surfaces visibly, never swallowed", () => {
  it("an acceptance the reducer refuses (forensic bed) surfaces as a visible Rejection naming the failing gate", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaiseAndReviewForensicHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("raise-forensic-test-referral"));

    fireEvent.click(screen.getByTestId("ward-referral-match-accept-brm-adult-secure"));

    const rejection = screen.getByTestId("ward-referral-match-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/forensic/i);
    // A refused acceptance never silently succeeds — the referral still reads as queued.
    expect(screen.getByTestId("ward-referral-match-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decided")).not.toBeInTheDocument();
  });
});

/**
 * Phase 8, Task 4 — the match view's travel-band grouping, its collapse, and the optional
 * local-bed step.
 *
 * The same boundary `tests/ward-travel-bands.test.ts` and `tests/ward-travel-grouping.test.ts` set
 * for themselves applies to every test below, and for the same reason: every value in
 * `SYNTHETIC_TRAVEL_BANDS` is invented, sits beside REAL hospital names, and nobody has measured
 * one. So no test here asserts a specific band for a specific hospital. Where a test needs a home
 * region with a particular shape it SEARCHES the fixture for one and fails loudly by name if none
 * exists, so on the day the placeholders are replaced with checked values this file either stays
 * green or fails honestly.
 */
const BAND_GROUP_KEYS: string[] = [...TRAVEL_BANDS, "not_recorded"];

/** Written out as a literal on purpose — see `tests/ward-travel-grouping.test.ts` for the full
 *  reasoning. `BAND_GROUP_KEYS` is derived from `TRAVEL_BANDS`, so comparing its length against
 *  itself could not fail; pinning the count independently makes adding or removing a band a
 *  decision somebody takes in a test. It counts groups on a screen and is not a clinical, legal or
 *  measured figure. */
const EXPECTED_BAND_GROUP_COUNT = 5;

function bandReferral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-TEST-BANDS",
    ageBand: "Adult",
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    homeRegion: "Perth Metropolitan",
    source: "community",
    raisedAt: NOW_ANCHOR - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    state: "queued",
    ...overrides,
  };
}

/** The bands the fixture records across the whole network for one home region, read through
 *  `unitTravelBand` — never through the rendered screen, which is the thing under test. */
function bandsAcrossNetwork(homeRegion: Referral["homeRegion"]): (TravelBand | undefined)[] {
  const subject = bandReferral({ homeRegion });
  return allUnits().map((unit) => unitTravelBand(subject, unit));
}

function regionWhere(predicate: (bands: (TravelBand | undefined)[]) => boolean): Referral["homeRegion"] | null {
  return HOME_REGIONS.find((homeRegion) => predicate(bandsAcrossNetwork(homeRegion))) ?? null;
}

function bandGroup(band: string): HTMLElement {
  return screen.getByTestId(`ward-referral-match-band-group-${band}`);
}

/** The heading a coordinator reads for a group key, from the exported labels — never a second
 *  spelling written out in this file. */
function bandGroupHeading(band: string): string {
  return band === "not_recorded" ? NOT_RECORDED_LABEL : TRAVEL_BAND_LABELS[band as TravelBand];
}

describe("ReferralMatchView — travel bands are grouped, and every group is on the screen", () => {
  it("renders all five band headings, including the ones no unit sits in", () => {
    const emptyBandOf = (bands: (TravelBand | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(
      homeRegion,
      "no home region in the fixture leaves a band empty — this test can no longer prove empty groups render",
    ).not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());

    // Every group, in the grouping's own order, present on the screen.
    expect(BAND_GROUP_KEYS).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    const list = screen.getByTestId("ward-referral-match-list");
    const renderedGroups = Array.from(list.querySelectorAll("[data-testid^='ward-referral-match-band-group-']")).map(
      (group) => (group.getAttribute("data-testid") ?? "").replace(/^ward-referral-match-band-group-/, ""),
    );
    expect(renderedGroups).toEqual(BAND_GROUP_KEYS);

    // Each heading is the exported label, never a second spelling written here.
    for (const band of TRAVEL_BANDS) {
      expect(bandGroup(band)).toHaveTextContent(TRAVEL_BAND_LABELS[band]);
    }
    expect(bandGroup("not_recorded")).toHaveTextContent(NOT_RECORDED_LABEL);

    // The band no unit in the whole network sits in is a heading plus a plain line — never an
    // omitted section. "There is nothing available within an hour" is the answer a coordinator
    // came for, and a missing heading cannot give it; it reads as a rendering fault instead.
    const empty = bandGroup(emptyBand);
    expect(empty).toBeInTheDocument();
    expect(within(empty).getByTestId(`ward-referral-match-band-empty-${emptyBand}`)).toHaveTextContent(
      "No unit in this band.",
    );
    expect(empty.querySelectorAll("li")).toHaveLength(0);
  });

  it("carries both counts on every heading — shut, and for an empty group", () => {
    const emptyBandOf = (bands: (TravelBand | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(homeRegion, "no home region leaves a band empty — the zero-count case is untestable").not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    // The jsdom setup's default matchMedia stub reports no match, so the groups mount SHUT — the
    // phone default. This is the binding condition on collapsing at all: the heading and both
    // counts render whether the group is open or shut, including for an empty group.
    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());
    for (const group of BAND_GROUP_KEYS) {
      expect(bandGroup(group)).not.toHaveAttribute("open");
    }

    expect(screen.getByTestId(`ward-referral-match-band-counts-${emptyBand}`)).toHaveTextContent(
      "0 units in this band · 0 accept this referral",
    );

    // The five headings between them account for the whole network — a count that disagreed with
    // the rows beneath it, or a group quietly counting a narrowed list, breaks this.
    const total = BAND_GROUP_KEYS.reduce((running, band) => {
      const text = screen.getByTestId(`ward-referral-match-band-counts-${band}`).textContent ?? "";
      const units = Number(/^(\d+) units? in this band/.exec(text)?.[1]);
      expect(units, `heading for ${band} does not state a unit count: ${text}`).not.toBeNaN();
      return running + units;
    }, 0);
    expect(total).toBe(allUnits().length);
  });

  it("puts the heading and both counts INSIDE the summary, the only part a shut group paints", () => {
    // THE assertion the binding condition rests on, and the one that was missing. A closed
    // `<details>` paints its `<summary>` and nothing else — but jsdom does not model that, so every
    // other test in this file proves only that the counts are in the DOCUMENT. Move the counts span
    // one line down, below `</summary>`, and all of them stay green while a coordinator on a phone
    // sees five bare bars with no numbers at all: exactly the outcome the metro/rural toggle was
    // declined to prevent. Containment in the summary is the structural fact that rules it out, and
    // it is checkable where visibility is not.
    const emptyBandOf = (bands: (TravelBand | undefined)[]) => TRAVEL_BANDS.find((band) => !bands.includes(band));
    const homeRegion = regionWhere((bands) => emptyBandOf(bands) !== undefined);
    expect(homeRegion, "no home region leaves a band empty — the empty-group case is untestable").not.toBeNull();
    const emptyBand = emptyBandOf(bandsAcrossNetwork(homeRegion!))!;

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());

    for (const band of BAND_GROUP_KEYS) {
      const group = bandGroup(band);
      expect(group).not.toHaveAttribute("open");
      const summary = group.querySelector("summary");
      expect(summary, `band group ${band} renders no summary — its heading would sit inside the fold`).not.toBeNull();
      // The heading itself.
      expect(summary!.textContent ?? "").toContain(bandGroupHeading(band));
      // And BOTH counts, as an element genuinely contained by the summary — not merely somewhere
      // inside the details.
      const counts = screen.getByTestId(`ward-referral-match-band-counts-${band}`);
      expect(summary).toContainElement(counts);
      expect(counts.textContent ?? "").toContain("in this band");
      expect(counts.textContent ?? "").toContain("this referral");
    }

    // Including the empty group, which is the case a coordinator most needs answered without
    // opening anything: "there is nothing available within an hour".
    const emptySummary = bandGroup(emptyBand).querySelector("summary");
    expect(emptySummary!.textContent ?? "").toContain("0 units in this band");
    expect(emptySummary!.textContent ?? "").toContain("0 accept this referral");

    // No heading may ever assert temporality: "right now" is what made the earlier global
    // accepting-count line an operational claim, and a band heading must never carry it.
    for (const band of BAND_GROUP_KEYS) {
      expect(bandGroup(band).querySelector("summary")!.textContent ?? "").not.toMatch(/right now/i);
    }
  });

  it("opens the groups at desktop width and keeps every heading and count in place", () => {
    installMatchMediaStub(true);
    renderMatch(bandReferral(), allUnits());

    for (const group of BAND_GROUP_KEYS) {
      expect(bandGroup(group)).toHaveAttribute("open");
      expect(screen.getByTestId(`ward-referral-match-band-counts-${group}`)).toBeInTheDocument();
    }
  });

  it("names an unrecorded band in words on the row itself, never as a blank", () => {
    // A blank cell in a distance column is read as "close", which is the one reading an unrecorded
    // pair must never produce.
    const homeRegion = regionWhere(
      (bands) => bands.some((band) => band === undefined) && bands.some((band) => band !== undefined),
    );
    expect(
      homeRegion,
      "no home region has both banded and unbanded units — the unrecorded row case is untestable",
    ).not.toBeNull();

    const subject = bandReferral({ homeRegion: homeRegion! });
    renderMatch(subject, allUnits());

    const unbanded = allUnits().filter((unit) => unitTravelBand(subject, unit) === undefined);
    expect(unbanded.length).toBeGreaterThan(0);
    const notRecordedGroup = bandGroup("not_recorded");
    for (const unit of unbanded) {
      const band = screen.getByTestId(`ward-referral-match-band-${unit.id}`);
      // The exact words, not merely "some text" — an empty string, a dash or a space would pass a
      // presence check while reading as a blank cell.
      expect(band.textContent).toBe(NOT_RECORDED_LABEL);
      expect(notRecordedGroup).toContainElement(band);
    }

    // And every banded unit carries its own band, so "not recorded" is never the screen's default.
    for (const unit of allUnits()) {
      const recorded = unitTravelBand(subject, unit);
      if (recorded === undefined) continue;
      expect(screen.getByTestId(`ward-referral-match-band-${unit.id}`).textContent).toBe(TRAVEL_BAND_LABELS[recorded]);
    }
  });

  it("states once, at the top of the list, when every candidate landed in the not-recorded group", () => {
    const homeRegion = regionWhere((bands) => bands.every((band) => band === undefined));
    expect(
      homeRegion,
      "no home region is unrecorded at every site — the whole-region-gap sentence is untestable",
    ).not.toBeNull();

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());

    const sentence = screen.getByTestId("ward-referral-match-all-not-recorded");
    expect(sentence).toHaveTextContent(NOT_RECORDED_LABEL);
    expect(sentence).toHaveTextContent(
      "This prototype holds no travel time between this person's home region and these sites. That is a gap in the invented data, not a statement that these beds are far away.",
    );
    // Once for the whole list, never once per row.
    expect(screen.getAllByTestId("ward-referral-match-all-not-recorded")).toHaveLength(1);
  });

  it("does not state the whole-region gap when some candidate does carry a band", () => {
    const homeRegion = regionWhere((bands) => bands.some((band) => band !== undefined));
    expect(homeRegion, "no home region records any band at all").not.toBeNull();

    renderMatch(bandReferral({ homeRegion: homeRegion! }), allUnits());
    expect(screen.queryByTestId("ward-referral-match-all-not-recorded")).not.toBeInTheDocument();
  });

  it("renders the invented-travel-times notice exactly once, imported and not retyped", () => {
    renderMatch(bandReferral(), allUnits());

    const notices = screen.getAllByTestId("ward-referral-match-synthetic-notice");
    expect(notices).toHaveLength(1);
    expect(notices[0].textContent).toBe(SYNTHETIC_TRAVEL_TIMES_NOTICE);

    // A band is rendered on this screen, so the sentence must be on it — and exactly once, so a
    // second copy per group cannot creep in unnoticed.
    const panel = screen.getByTestId("ward-referral-match-panel");
    expect(screen.getAllByTestId(/^ward-referral-match-band-group-/)).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    const occurrences = (panel.textContent ?? "").split(SYNTHETIC_TRAVEL_TIMES_NOTICE).length - 1;
    expect(occurrences).toBe(1);
  });

  it("puts the structural-gap banner before every word of distance wording", () => {
    // A gap of the kind "no unit of this type exists anywhere in the network" is not a distance
    // problem and must never be dressed as one, so it is met first.
    const unitsWithoutYouth = allUnits().filter((unit) => unit.cohort !== "Youth");
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, unitsWithoutYouth);

    const banner = screen.getByTestId("ward-referral-match-structural-gap");
    const notice = screen.getByTestId("ward-referral-match-synthetic-notice");
    const firstGroup = bandGroup(BAND_GROUP_KEYS[0]);
    const precedes = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(banner, notice)).toBe(true);
    expect(precedes(banner, firstGroup)).toBe(true);
    // The banner itself carries no distance wording of any kind.
    expect(banner.textContent).not.toMatch(/hour|travel|air|home/i);
  });

  it("uses no comparative proximity word anywhere on the screen", () => {
    renderMatch(bandReferral(), allUnits());
    const comparative =
      /nearest|closest|furthest|most remote|hardest to reach|\bbest\b|optimal|recommend|preferred|suggested/i;

    // Applied to the WHOLE panel, minus exactly one paragraph: the governance disclaimer, which
    // says this view "never suggests which bed is best". That sentence denies a comparative claim
    // rather than making one, and it predates this phase — excluding it is what lets the rule be
    // enforced over everything else instead of abandoned. The exclusion cannot quietly widen: the
    // split proves that wording occurs exactly ONCE, so a second copy of it, or a band heading that
    // borrowed it, lands back inside the assertion.
    const panel = screen.getByTestId("ward-referral-match-panel");
    const governance = screen.getByTestId("ward-referral-match-governance").textContent ?? "";
    expect(governance).toMatch(comparative);
    const rest = (panel.textContent ?? "").split(governance);
    expect(rest).toHaveLength(2);
    expect(rest.join(" ")).not.toMatch(comparative);

    // And named individually, so no group heading, count, band label or the local-bed offer can
    // ever carry one.
    for (const band of BAND_GROUP_KEYS) {
      expect(bandGroup(band).textContent ?? "").not.toMatch(comparative);
    }
    expect(screen.getByTestId("ward-referral-match-synthetic-notice").textContent ?? "").not.toMatch(comparative);
    expect(screen.getByTestId("ward-referral-match-local-bed").textContent ?? "").not.toMatch(comparative);
  });

  it("groups the WHOLE network — every unit in it reaches the screen", () => {
    // The gap `groupCandidatesByTravelBand` cannot close for itself: it groups whatever list it is
    // given and will happily group a truncated one. The derivation-level test proves grouping the
    // full unit list yields the full count; only a call-site assertion can prove this SCREEN passed
    // the full list. Without it, a later change handing it three units of many goes unnoticed.
    const units = allUnits();
    expect(
      units.length,
      "the network shrank — re-check that this floor still means 'every unit', not 'one site's worth'",
    ).toBeGreaterThanOrEqual(10);

    const subject = bandReferral();
    renderMatch(subject, units);

    const list = screen.getByTestId("ward-referral-match-list");
    const rendered = renderedUnitIds(list);
    expect(rendered).toHaveLength(units.length);
    expect(new Set(rendered).size).toBe(units.length);
    expect([...rendered].sort()).toEqual(units.map((unit) => unit.id).sort());
    // And in the grouped order, with the site table's order preserved inside each band.
    expect(rendered).toEqual(expectedGroupedUnitIds(subject));
  });
});

describe("ReferralMatchView — the optional local-bed step is never owed", () => {
  const COUNTRY_REGION: Referral["homeRegion"] = "Kimberley";
  const METRO_REGION: Referral["homeRegion"] = "Perth Metropolitan";

  it("renders no trace at all of the step's absence", () => {
    renderMatch(bandReferral({ homeRegion: COUNTRY_REGION }), allUnits());

    const region = screen.getByTestId("ward-referral-match-local-bed");
    // Rule 3: absence renders as NOTHING AT ALL. Not "Not recorded", not an empty checkbox, not a
    // grey placeholder, not a warning icon, not an amber row. A referral without the record must
    // look exactly like one that never needed it, because it may be one.
    expect(region.textContent ?? "").not.toMatch(/not recorded/i);
    expect(within(region).queryAllByRole("checkbox")).toHaveLength(0);
    expect(region.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(within(region).queryAllByRole("alert")).toHaveLength(0);
    expect(within(region).queryAllByRole("status")).toHaveLength(0);
    expect(within(region).queryAllByRole("img")).toHaveLength(0);
    expect(region.querySelectorAll("svg")).toHaveLength(0);
    // Rule 5: no figure anywhere counts what is missing — no completeness percentage, no
    // "12 of 40 are missing this step". The region holds no digit at all before the record exists.
    expect(region.textContent ?? "").not.toMatch(/\d/);
    // What IS there is the offer, and only the offer.
    expect(screen.getByTestId("ward-referral-match-local-bed-sought")).toHaveTextContent(
      "Record that a local bed was sought and none was suitable",
    );
    expect(screen.queryByTestId("ward-referral-match-local-bed-sought-record")).not.toBeInTheDocument();
  });

  it("offers the control on a metro referral exactly as on a country one", () => {
    // Rule 4. Offering it only on country referrals would assert that looking closer to home first
    // is a country practice — precisely the thing nobody has established.
    for (const homeRegion of [METRO_REGION, COUNTRY_REGION]) {
      const { unmount } = renderMatch(bandReferral({ homeRegion }), allUnits());
      expect(
        screen.getByTestId("ward-referral-match-local-bed-sought"),
        `the local-bed control is missing for a ${homeRegion} referral`,
      ).toHaveTextContent("Record that a local bed was sought and none was suitable");
      unmount();
    }
  });

  it("creates the record only when the control is taken, and then states it plainly", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    expect(screen.queryByTestId("ward-referral-match-local-bed-sought-record")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-referral-match-local-bed-sought"));

    // The record now exists and the screen says so; the offer is gone because it is a one-shot.
    expect(screen.getByTestId("ward-referral-match-local-bed-sought-record")).toHaveTextContent(
      /^A local bed was sought and none was suitable, at \d{2}:\d{2}\.$/,
    );
    expect(screen.queryByTestId("ward-referral-match-local-bed-sought")).not.toBeInTheDocument();
    // Nothing was refused, and the referral is still queued — this step is not a decision.
    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-select-RF-005")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------------------------- *
 * Phase 8, Task 5: the out-of-area ledger screen.
 * ------------------------------------------------------------------------------------------- */

function renderLedger(admissions?: Admission[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {admissions === undefined ? <OutOfAreaBoard /> : <OutOfAreaBoard admissions={admissions} />}
    </WardFlowProvider>,
  );
}

/**
 * Admissions the band table cannot place at all — built by asking `travelBand` directly, never by
 * calling `outOfAreaLedger`. An expectation computed from the very derivation the screen calls
 * would move with it, so a screen that classified by something else entirely would still agree
 * with its own expectation.
 *
 * This is also the fixture the seeded records cannot produce on their own: a screen where the
 * unclassified count is the only non-zero number. That is the state whose wording goes wrong most
 * easily, because there is nothing else on the page to anchor the reader against.
 */
function unclassifiableAdmissions(): Admission[] {
  const units = allUnits();
  return wardAdmissions.filter((admission) => {
    if (admission.state !== "occupied" || admission.arrivedAt === null) return false;
    const unit = units.find((candidate) => candidate.id === admission.unitId);
    return unit !== undefined && travelBand(admission.homeRegion, unit.siteCode) === undefined;
  });
}

/** Admissions the band table places OUT of area, again asked of `travelBand` directly. */
function outOfAreaAdmissions(): Admission[] {
  const units = allUnits();
  return wardAdmissions.filter((admission) => {
    if (admission.state !== "occupied" || admission.arrivedAt === null) return false;
    const unit = units.find((candidate) => candidate.id === admission.unitId);
    if (unit === undefined) return false;
    const band = travelBand(admission.homeRegion, unit.siteCode);
    return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
  });
}

function ledgerText(): string {
  return screen.getByTestId("ward-out-of-area-board").textContent ?? "";
}

describe("OutOfAreaBoard — the two governance notices", () => {
  it("renders the invented-threshold notice as a whole sentence, not an abbreviation of one", () => {
    // Asserted as the WHOLE string. A `toContain` on its first clause would stay green against a
    // screen that truncated the notice, which is the exact failure this screen cannot afford: the
    // threshold is this prototype's own invention, and the half of the sentence that says so is
    // the half a truncation drops.
    renderLedger();
    expect(screen.getByTestId("ward-out-of-area-threshold-notice").textContent).toBe(
      INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
    );
  });

  it("renders the synthetic-travel-times notice as a whole sentence, because bands are shown here", () => {
    renderLedger();
    expect(screen.getByTestId("ward-out-of-area-synthetic-notice").textContent).toBe(SYNTHETIC_TRAVEL_TIMES_NOTICE);
  });

  it("keeps both notices above the entries rather than in a footnote below them", () => {
    // Position is part of the requirement, not presentation: a disclaimer met only after the
    // number it disclaims has already been read is a footnote, and a footnote is what gets left
    // out of the screenshot somebody pastes into a meeting.
    renderLedger();
    const board = screen.getByTestId("ward-out-of-area-board");
    const order = Array.from(board.querySelectorAll("[data-testid]")).map((node) => node.getAttribute("data-testid"));
    // Presence is asserted before position, or a DELETED notice would satisfy "above the entries"
    // with an index of -1 and this test would pass on the worst possible screen.
    expect(order).toContain("ward-out-of-area-threshold-notice");
    expect(order).toContain("ward-out-of-area-synthetic-notice");
    expect(order).toContain("ward-out-of-area-entries");
    expect(order.indexOf("ward-out-of-area-threshold-notice")).toBeLessThan(order.indexOf("ward-out-of-area-entries"));
    expect(order.indexOf("ward-out-of-area-synthetic-notice")).toBeLessThan(order.indexOf("ward-out-of-area-entries"));
  });

  it("carries the standing not-a-medical-device banner every sibling board carries", () => {
    renderLedger();
    expect(screen.getByTestId("ward-out-of-area-governance")).toHaveTextContent("not a medical device");
  });
});

describe("OutOfAreaBoard — two counts that share no denominator", () => {
  it("states both numbers, each as its own sentence, on the seeded records", () => {
    renderLedger();
    const expectedOutOfArea = outOfAreaAdmissions().length;
    const expectedUnclassified = unclassifiableAdmissions().length;
    // The fixture's own shape is why this screen is dangerous: the unclassified count is far the
    // larger of the two. Asserted as a relation, never as a pinned total — pinning either would
    // pin a consequence of the invented band table.
    expect(expectedUnclassified).toBeGreaterThan(expectedOutOfArea);
    expect(expectedOutOfArea).toBeGreaterThan(0);

    expect(screen.getByTestId("ward-out-of-area-count-people")).toHaveTextContent(
      `${expectedOutOfArea} people are recorded as being in a bed far from home.`,
    );
    expect(screen.getByTestId("ward-out-of-area-count-not-banded")).toHaveTextContent(
      `${expectedUnclassified} more could not be placed in a band because this prototype holds no travel time for their home region.`,
    );
  });

  it("still states the unclassified count when it is the only non-zero number", () => {
    // The state the seeded records cannot reach. A screen that rendered this count only alongside
    // entries would go silent exactly where the gap is total — and a silent gap reads as no gap.
    const unclassifiable = unclassifiableAdmissions();
    expect(unclassifiable.length).toBeGreaterThan(0);
    renderLedger(unclassifiable);

    expect(screen.getByTestId("ward-out-of-area-count-not-banded")).toHaveTextContent(
      `${unclassifiable.length} more could not be placed in a band because this prototype holds no travel time for their home region.`,
    );
    expect(screen.getByTestId("ward-out-of-area-count-people")).toHaveTextContent(
      "0 people are recorded as being in a bed far from home.",
    );
  });

  it("presents neither number as a share, a fraction or a percentage of the other", () => {
    renderLedger();
    const text = ledgerText();
    // No "18 of 235", no "18/235", no "7.7%", and no meter or progress element that would draw one
    // number inside the other. At the seeded ratio of roughly twelve to one, any of those would be
    // the dominant reading of the screen, and it would be false.
    expect(text).not.toMatch(/\d+\s*(?:of|out of|\/)\s*\d+/);
    expect(text).not.toContain("%");
    const board = screen.getByTestId("ward-out-of-area-board");
    expect(board.querySelector("progress")).toBeNull();
    expect(board.querySelector("[role='progressbar']")).toBeNull();
    expect(board.querySelector("[role='meter']")).toBeNull();
  });
});

describe("OutOfAreaBoard — what the screen says it is", () => {
  it("says the list is seeded and not a live count", () => {
    renderLedger();
    const provenance = screen.getByTestId("ward-out-of-area-provenance");
    expect(provenance).toHaveTextContent("This is not a live statewide count.");
    expect(provenance).toHaveTextContent("this prototype does not record admissions as they happen");
  });

  it("never claims that nobody leaves this ledger", () => {
    /*
     * The sentence this task originally mandated, forbidden on 2026-08-29 (D8-9). An `Admission`
     * ends — `state: "left"`, `leftAt` — and `outOfAreaLedger` excludes anybody not currently
     * holding a bed, so a screen saying otherwise would state something false as fact. This guard
     * is the only thing standing between a plausible-sounding sentence and a clinical screen,
     * because it is exactly the kind of claim a reader has no way to check.
     */
    renderLedger();
    const text = ledgerText().toLowerCase();
    for (const forbidden of [
      "no record of anyone leaving",
      "nobody ever leaves",
      "never leaves this ledger",
      "nobody leaves this ledger",
    ]) {
      expect(text, `the ledger screen must not claim "${forbidden}"`).not.toContain(forbidden);
    }
    // The true half is present, so this test cannot be satisfied by the paragraph being deleted.
    expect(screen.getByTestId("ward-out-of-area-provenance")).toHaveTextContent(
      "Somebody who has left their bed is not on this list",
    );
  });
});

describe("OutOfAreaBoard — the entries", () => {
  it("shows home region, unit and band for every out-of-area admission", () => {
    renderLedger();
    const expected = outOfAreaAdmissions();
    expect(expected.length).toBeGreaterThan(0);
    const units = allUnits();
    for (const admission of expected) {
      const row = screen.getByTestId(`ward-out-of-area-row-${admission.id}`);
      const unit = units.find((candidate) => candidate.id === admission.unitId)!;
      expect(row).toHaveTextContent(admission.homeRegion);
      expect(row).toHaveTextContent(unit.name);
      expect(row).toHaveTextContent(TRAVEL_BAND_LABELS[travelBand(admission.homeRegion, unit.siteCode)!]);
    }
  });

  it("renders the entries in the records' own order, ranking nobody", () => {
    /*
     * The expected order is taken from `wardAdmissions` itself, never from `outOfAreaLedger` — an
     * expectation read out of the derivation under test would follow it into any sort it grew.
     *
     * This is the phase's defining hazard in its sharpest form. A sort by elapsed time here would
     * be a ranking of people by how recently they were sent away, which reads as a repatriation
     * priority nobody has decided, and nothing on the screen would look wrong.
     */
    renderLedger();
    const expectedIds = outOfAreaAdmissions().map((admission) => admission.id);
    const renderedIds = Array.from(
      screen.getByTestId("ward-out-of-area-table").querySelectorAll("tr[data-testid]"),
    ).map((row) => (row.getAttribute("data-testid") ?? "").replace(/^ward-out-of-area-row-/, ""));
    expect(renderedIds).toEqual(expectedIds);
  });

  it("shows elapsed time and nothing that reads as a deadline", () => {
    // No countdown, no target, no "overdue", no "left". `formatElapsed` is not reused either: it
    // appends "waiting", and somebody in a bed far from home is not waiting for anything this
    // prototype has recorded.
    renderLedger();
    const entries = (screen.getByTestId("ward-out-of-area-entries").textContent ?? "").toLowerCase();
    for (const word of ["overdue", "target", "deadline", "breach", "waiting", "remaining", " left", " due"]) {
      expect(entries, `"${word.trim()}" reads as a deadline on a screen that has none`).not.toContain(word);
    }
    // And an elapsed duration really is rendered, so the absence above is not absence of the whole
    // column.
    expect(entries).toMatch(/\d+h \d{2}m|\d+m/);
  });

  it("says plainly that nobody is out of area rather than showing an empty region", () => {
    renderLedger([]);
    expect(screen.getByTestId("ward-out-of-area-empty")).toHaveTextContent(
      "Nobody on these records is in a bed far from home.",
    );
    expect(screen.queryByTestId("ward-out-of-area-table")).not.toBeInTheDocument();
  });
});
